//! Writes out the boards the tests hold this crate, and the build of it the game runs, to (see tests/vectors.rs).
//!
//!   cargo run --example vectors > crates/boardgen/tests/vectors.json
//!
//! Only for when the boards are meant to change. Every game then gets different boards than it would have, the
//! day's daily challenge among them, so it is not something to do in passing.

use boardgen::{Guarantee, Request, Seed, generate};
use serde::Serialize;

/// A board on record by a digest of its layout: far more of these fit in the file than whole boards do
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Digest {
    rows: usize,
    cols: usize,
    mines: usize,
    seed: String,
    opening: Option<usize>,
    guess_free: bool,
    opened_on: usize,
    /// whether the board came with the promise that it needs no guess
    promised: bool,
    /// FNV-1a (32 bits) of the layout, a byte per cell, in hex
    layout_digest: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    rows: usize,
    cols: usize,
    mines: usize,
    seed: String,
    opening: Option<usize>,
    guess_free: bool,
    opened_on: usize,
    layout: String,
}

/// Rows, columns, mines, the first byte of the seed (the rest count up from it), and the opening if one is asked for
type Kind = (usize, usize, usize, u8, Option<usize>);

/// The everyday boards and the edges of what can be asked for: the smallest and the biggest, a corner opening and
/// a last-cell one, a board with every allowed cell mined, and seeds whose bytes wrap round
const KINDS: &[Kind] = &[
    (9, 9, 10, 0, None),
    (9, 9, 10, 1, Some(40)),
    (16, 16, 40, 2, None),
    (16, 30, 99, 3, None),
    (16, 30, 99, 4, Some(0)),
    (4, 4, 7, 5, Some(5)),
    (4, 4, 1, 6, None),
    (99, 99, 99, 7, None),
    (5, 40, 60, 8, Some(199)),
    (30, 16, 99, 250, Some(479)),
];

/// Boards so crowded that chance never lays one that needs no guess: these are the ones that get helped along
const CROWDED: &[Kind] =
    &[(16, 16, 99, 9, None), (12, 12, 99, 10, Some(77)), (4, 99, 99, 11, None), (10, 10, 91, 12, Some(0))];

fn case(&(rows, cols, mines, first, opening): &Kind, guarantee: Guarantee) -> Case {
    let seed: Seed = std::array::from_fn(|at| first.wrapping_add(at as u8));
    let board = generate(&Request { rows, cols, mines, seed, opening, guarantee }).expect("a board that can be made");
    let guess_free = guarantee == Guarantee::GuessFree;
    assert_eq!(board.guess_free, guess_free, "{rows} x {cols} with {mines} mines");
    Case {
        rows,
        cols,
        mines,
        seed: hex(&seed),
        opening,
        guess_free,
        opened_on: board.opening,
        layout: board.layout.iter().map(|&mine| if mine == 1 { '1' } else { '0' }).collect(),
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// FNV-1a, 32 bits: short enough to write out again in any language that has to check these
fn fnv1a(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5, |hash, &byte| (hash ^ u32::from(byte)).wrapping_mul(0x0100_0193))
}

/// How many boards are kept by digest
const DIGESTS: u32 = 400;

/// Boards of all shapes and crowdedness, each from its own seed: some opened where chance says and some where
/// they are told to, three in four of them made to need no guess
fn digests() -> Vec<Digest> {
    // a stream of numbers to pick the boards with, nothing to do with the one boards are made from
    let mut state = 0x2545_F491_4F6C_DD1D_u64;
    let mut pick = |bound: usize| {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (state >> 33) as usize % bound
    };
    (0..DIGESTS)
        .map(|number| {
            // mostly boards of a size people play, and now and then a very long or a very big one
            let side = |pick: &mut dyn FnMut(usize) -> usize| if pick(8) == 0 { 4 + pick(96) } else { 4 + pick(27) };
            let (rows, cols) = (side(&mut pick), side(&mut pick));
            let mines = 1 + pick(99.min(rows * cols - 9));
            let opening = (pick(3) > 0).then(|| pick(rows * cols));
            let guarantee = if number % 4 == 0 { Guarantee::None } else { Guarantee::GuessFree };
            let mut seed: Seed = [0; 16];
            seed.iter_mut().for_each(|byte| *byte = pick(256) as u8);
            seed[0] |= 1;
            let board =
                generate(&Request { rows, cols, mines, seed, opening, guarantee }).expect("a board that can be made");
            Digest {
                rows,
                cols,
                mines,
                seed: hex(&seed),
                opening,
                guess_free: guarantee == Guarantee::GuessFree,
                opened_on: board.opening,
                promised: board.guess_free,
                layout_digest: format!("{:08x}", fnv1a(&board.layout)),
            }
        })
        .collect()
}

/// A list as it is written to the file: a line for each thing in it
fn lines<T: Serialize>(items: impl Iterator<Item = T>) -> String {
    let lines: Vec<String> = items.map(|item| serde_json::to_string(&item).expect("a line of the vectors")).collect();
    format!("[\n    {}\n  ]", lines.join(",\n    "))
}

const ABOUT: &str = "Boards made by crates/boardgen. Its own tests and the game's (shared/engine/generate.test.ts) hold it to them: see crates/boardgen/tests/vectors.rs.";
const GENERATOR: &str = "xoshiro128**, seeded with 16 bytes read as four little-endian 32-bit words";
const FIELDS: &str = "seed: hex. opening: the cell asked for (row * cols + col), or null to have one picked. guessFree: whether the board was asked to need no guess, which every one in `cases` that was asked to does. openedOn: the cell the board opens on. layout: one character per cell, row after row, 1 for a mine. In `digests`, promised: whether the board came with the promise that it needs no guess; layoutDigest: FNV-1a (32 bits, hex) of the layout as one byte per cell, 1 for a mine.";

fn main() {
    let by_chance = KINDS.iter().map(|kind| case(kind, Guarantee::None));
    let guess_free = KINDS.iter().chain(CROWDED).map(|kind| case(kind, Guarantee::GuessFree));
    let text = |text: &str| serde_json::to_string(text).expect("text");
    println!("{{");
    println!("  \"about\": {},", text(ABOUT));
    println!("  \"generator\": {},", text(GENERATOR));
    println!("  \"fields\": {},", text(FIELDS));
    println!("  \"cases\": {},", lines(by_chance.chain(guess_free)));
    println!("  \"digests\": {}", lines(digests().into_iter()));
    println!("}}");
}
