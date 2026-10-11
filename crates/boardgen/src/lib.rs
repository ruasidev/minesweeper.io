//! Lays out minesweeper boards: by default, ones that can be cleared without a single guess.
//!
//! [`generate()`] is the whole of it: what the board is to be like and a seed go in, and where the mines are comes
//! out. It is exact. The same request gives the same board, byte for byte, wherever this runs, because all the
//! chance in it comes from the seed.
//!
//! How it goes about it, by where to look:
//!
//! - `random` turns a seed into numbers, and `laying` turns those into mines, keeping clear of the cell the board
//!   opens on and the cells around it.
//! - `solver` plays a board through by reasoning alone, the way a careful player would, to find out whether it
//!   can be cleared without a guess.
//! - `generate` puts boards to the solver until one passes, and `repair` helps along the ones that nearly do.
//! - `grid` and `field` are what all of them keep a board in.
//!
//! The game runs this as WebAssembly, on the server and in the browser alike: `wasm` is the door in. Nothing here
//! depends on that, or on anything else: there are no dependencies but the standard library.

mod field;
mod generate;
mod grid;
mod laying;
mod random;
mod repair;
mod solver;
#[cfg(target_arch = "wasm32")]
mod wasm;

pub use generate::{Board, Effort, Guarantee, Refusal, Request, WORK_MAX, generate, is_guess_free};
pub use grid::SIDE_MAX;
pub use random::{SEED_BYTES, Seed};
