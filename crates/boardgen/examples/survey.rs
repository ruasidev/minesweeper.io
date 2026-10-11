//! How long boards take to make, and how often chance alone gives one that needs no guess.
//!
//!   cargo run --release --example survey              the everyday boards and some awkward ones
//!   cargo run --release --example survey 16 30 99     one board of your choosing
//!   cargo run --release --example survey sweep        boards of every shape the game allows, worst first
//!
//! A column for each thing worth knowing about a kind of board:
//!
//! - `as laid`: how many boards in a hundred need no guess just as chance laid them
//! - `boards`, `repairs`: how many were laid, and how many times one was helped along, for each board made
//! - `mean`, `p99`, `worst`: how long a board took to make, in thousandths of a second
//! - `not found`: how many in a hundred were handed over without the promise that they need no guess

use std::time::{Duration, Instant};

use boardgen::{Guarantee, Request, Seed, generate, is_guess_free};

const BOARDS: u32 = 2000;

const KINDS: &[(usize, usize, usize)] = &[
    (9, 9, 10),
    (16, 16, 40),
    (16, 30, 99),
    (30, 30, 99),
    (99, 99, 99),
    (24, 30, 99),
    (20, 20, 99),
    (18, 18, 99),
    (16, 16, 99),
    (14, 14, 99),
    (12, 12, 99),
    (10, 10, 91),
    (10, 10, 50),
    (9, 9, 35),
    (8, 8, 30),
    (4, 4, 7),
    (5, 5, 16),
    (4, 99, 99),
];

/// a seed for each number, all different and none of them all zeroes
fn seed(number: u32) -> Seed {
    let mut state = u64::from(number) + 1;
    let mut bytes = [0; 16];
    for chunk in bytes.chunks_mut(8) {
        // splitmix64: enough to spread consecutive numbers over the whole of a seed
        state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut mixed = state;
        mixed = (mixed ^ (mixed >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        mixed = (mixed ^ (mixed >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        chunk.copy_from_slice(&(mixed ^ (mixed >> 31)).to_le_bytes());
    }
    bytes
}

/// What making a kind of board came to, over many of them
struct Findings {
    as_laid: f64,
    boards: f64,
    repairs: f64,
    mean_ms: f64,
    p99_ms: f64,
    worst_ms: f64,
    not_found: f64,
    work: f64,
    most_work: u64,
}

fn survey(rows: usize, cols: usize, mines: usize) {
    match findings(rows, cols, mines, BOARDS) {
        None => println!("{rows:>3} x {cols:<3} {mines:>3} mines   can't be made from every opening"),
        Some(found) => println!(
            "{rows:>3} x {cols:<3} {mines:>3} mines   as laid {:>5.1}%   boards {:>6.2}   repairs {:>6.2}   mean {:>6.3}   p99 {:>6.3}   worst {:>6.3}   not found {:>5.2}%   work {:>6.0} (most {:>6})",
            found.as_laid * 100.0,
            found.boards,
            found.repairs,
            found.mean_ms,
            found.p99_ms,
            found.worst_ms,
            found.not_found * 100.0,
            found.work,
            found.most_work,
        ),
    }
}

/// The sizes the game lets a player ask for (shared/engine/generate.ts)
const SIDES: std::ops::RangeInclusive<usize> = 4..=99;
const MINES_MAX: usize = 99;

/// Tries boards of every shape, a few of each, and lists the ones that took longest and the ones that weren't found
fn sweep() {
    let mut kinds = Vec::new();
    for rows in SIDES.step_by(3) {
        for cols in SIDES.filter(|&cols| cols >= rows).step_by(5) {
            let most = MINES_MAX.min(rows * cols - 9);
            for mines in [most, most * 3 / 4, most / 2, most / 4].into_iter().filter(|&mines| mines > 0) {
                if let Some(found) = findings(rows, cols, mines, 200) {
                    kinds.push((rows, cols, mines, found));
                }
            }
        }
    }
    println!("{} kinds of board", kinds.len());
    for (title, key) in [
        ("slowest on average", (|found| found.mean_ms) as fn(&Findings) -> f64),
        ("slowest at worst", |found| found.worst_ms),
        ("least often found", |found| found.not_found),
    ] {
        kinds.sort_by(|a, b| key(&b.3).total_cmp(&key(&a.3)));
        println!("{title}:");
        for (rows, cols, mines, found) in kinds.iter().take(8) {
            println!(
                "  {rows:>3} x {cols:<3} {mines:>3} mines   mean {:>6.3}   worst {:>6.3}   not found {:>5.2}%   repairs {:>6.2}",
                found.mean_ms,
                found.worst_ms,
                found.not_found * 100.0,
                found.repairs
            );
        }
    }
}

fn findings(rows: usize, cols: usize, mines: usize, count: u32) -> Option<Findings> {
    let request = |number: u32, guarantee| Request {
        rows,
        cols,
        mines,
        seed: seed(number),
        // an opening somewhere different each time, edges and corners included
        opening: Some(number as usize * 7919 % (rows * cols)),
        guarantee,
    };

    let mut as_laid = 0;
    for number in 0..count {
        let board = generate(&request(number, Guarantee::None)).ok()?;
        as_laid += u32::from(is_guess_free(rows, cols, &board.layout, board.opening) == Ok(true));
    }

    let mut times = Vec::with_capacity(count as usize);
    let (mut boards, mut repairs, mut not_found, mut work, mut most_work) = (0, 0, 0, 0, 0);
    for number in 0..count {
        let request = request(number, Guarantee::GuessFree);
        let started = Instant::now();
        let board = generate(&request).ok()?;
        times.push(started.elapsed());
        boards += board.effort.boards;
        repairs += board.effort.repairs;
        not_found += u32::from(!board.guess_free);
        work += board.effort.work;
        most_work = most_work.max(board.effort.work);
    }
    times.sort();
    let ms = |time: Duration| time.as_secs_f64() * 1000.0;
    let each = |total: u32| f64::from(total) / f64::from(count);
    Some(Findings {
        as_laid: each(as_laid),
        boards: each(boards),
        repairs: each(repairs),
        mean_ms: ms(times.iter().sum::<Duration>()) / f64::from(count),
        p99_ms: ms(times[times.len() * 99 / 100]),
        worst_ms: ms(times[times.len() - 1]),
        not_found: each(not_found),
        work: work as f64 / f64::from(count),
        most_work,
    })
}

fn main() {
    let words: Vec<String> = std::env::args().skip(1).collect();
    let numbers: Vec<usize> = words.iter().filter_map(|word| word.parse().ok()).collect();
    match (words.first().map(String::as_str), &numbers[..]) {
        (Some("sweep"), _) => sweep(),
        (_, &[rows, cols, mines]) => survey(rows, cols, mines),
        _ => KINDS.iter().for_each(|&(rows, cols, mines)| survey(rows, cols, mines)),
    }
}
