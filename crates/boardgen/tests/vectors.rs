//! Boards this crate is on record as making.
//!
//! `vectors.json` holds requests and the boards they gave. The same file is read by the game's own tests
//! (shared/engine/generate.test.ts), which put the same requests to the WebAssembly build the game runs. So a
//! change to how boards are made can't go unnoticed, and the build can't drift from the source: both are held to
//! these, and whoever changes the boards on purpose has to say so by making the file again
//! (`cargo run --example vectors`).
//!
//! The first ten were made by the TypeScript generator this crate took over from, before it was removed: they are
//! the proof that a board laid by chance alone is still, byte for byte, the board it always was.

use boardgen::{Guarantee, Request, generate};
use serde::Deserialize;

#[derive(Deserialize)]
struct Vectors {
    cases: Vec<Case>,
    digests: Vec<Digest>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Digest {
    rows: usize,
    cols: usize,
    mines: usize,
    seed: String,
    opening: Option<usize>,
    guess_free: bool,
    opened_on: usize,
    promised: bool,
    layout_digest: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    rows: usize,
    cols: usize,
    mines: usize,
    seed: String,
    opening: Option<usize>,
    #[serde(default)]
    guess_free: bool,
    opened_on: usize,
    layout: String,
}

fn bytes_of(hex: &str) -> Vec<u8> {
    (0..hex.len()).step_by(2).map(|at| u8::from_str_radix(&hex[at..at + 2], 16).expect("hex")).collect()
}

fn vectors() -> Vectors {
    serde_json::from_str(include_str!("vectors.json")).expect("the vectors")
}

fn guarantee(guess_free: bool) -> Guarantee {
    if guess_free { Guarantee::GuessFree } else { Guarantee::None }
}

/// FNV-1a, 32 bits
fn fnv1a(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5, |hash, &byte| (hash ^ u32::from(byte)).wrapping_mul(0x0100_0193))
}

#[test]
fn still_makes_the_boards_it_is_on_record_as_making() {
    let vectors = vectors();
    assert!(vectors.cases.iter().any(|case| case.guess_free) && vectors.cases.iter().any(|case| !case.guess_free));
    for case in vectors.cases {
        let request = Request {
            rows: case.rows,
            cols: case.cols,
            mines: case.mines,
            seed: bytes_of(&case.seed).try_into().expect("a seed of 16 bytes"),
            opening: case.opening,
            guarantee: guarantee(case.guess_free),
        };
        let board = generate(&request).expect("a board that was made before");
        let layout: String = board.layout.iter().map(|&mine| if mine == 1 { '1' } else { '0' }).collect();
        let name = format!("{} x {} with {} mines, seed {}", case.rows, case.cols, case.mines, case.seed);
        assert_eq!(board.opening, case.opened_on, "{name}");
        assert_eq!(layout, case.layout, "{name}");
        // every board on record that was asked to need no guess was found to need none
        assert_eq!(board.guess_free, case.guess_free, "{name}");
    }
}

#[test]
fn still_makes_the_many_boards_it_is_on_record_as_making_by_digest() {
    let digests = vectors().digests;
    assert!(digests.len() >= 400);
    for case in digests {
        let request = Request {
            rows: case.rows,
            cols: case.cols,
            mines: case.mines,
            seed: bytes_of(&case.seed).try_into().expect("a seed of 16 bytes"),
            opening: case.opening,
            guarantee: guarantee(case.guess_free),
        };
        let board = generate(&request).expect("a board that was made before");
        let name = format!("{} x {} with {} mines, seed {}", case.rows, case.cols, case.mines, case.seed);
        assert_eq!(board.opening, case.opened_on, "{name}");
        assert_eq!(format!("{:08x}", fnv1a(&board.layout)), case.layout_digest, "{name}");
        assert_eq!(board.guess_free, case.promised, "{name}");
    }
}
