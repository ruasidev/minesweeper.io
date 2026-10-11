//! The door in from WebAssembly.
//!
//! Three functions, taking and giving nothing but numbers, so that no glue code has to be generated for them: the
//! caller reserves some of this module's memory, writes a seed into it, asks for a board, reads the mines back out
//! of it, and releases it. `shared/engine/boardgen.ts` is that caller.

use std::{ptr, slice};

use crate::generate::{Guarantee, Refusal, Request, generate};
use crate::random::{SEED_BYTES, Seed};

/// what `opening` is when the board is to pick its own
const NO_OPENING: i32 = -1;

/// set in the answer when the board is known to need no guess: the rest of the answer is the cell it opens on
const GUESS_FREE: i32 = 1 << 30;

/// Sets aside `len` bytes of this module's memory and says where they are
#[unsafe(no_mangle)]
pub extern "C" fn boardgen_reserve(len: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; len].into_boxed_slice()).cast()
}

/// Gives back memory that was set aside.
///
/// # Safety
///
/// `at` and `len` must be what one call to [`boardgen_reserve`] gave and was asked for, not yet given back.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn boardgen_release(at: *mut u8, len: usize) {
    // SAFETY: by the caller's promise this is the boxed slice `boardgen_reserve` let go of
    drop(unsafe { Box::from_raw(ptr::slice_from_raw_parts_mut(at, len)) });
}

/// Makes a board (see [`generate`]).
///
/// `opening` is the cell to open on, or -1 to have one picked. `guarantee` is 0 for a board laid by chance alone
/// and 1 for one that needs no guess.
///
/// The mines are written to `layout`, one byte per cell. The answer is the cell the board opens on, with
/// 2^30 added if it is known to need no guess; or, if the board can't be made, less than nothing:
/// -1 no board of that size, -2 too many mines, -3 the opening isn't on the board, -4 a seed of all zeroes,
/// -5 no such guarantee.
///
/// # Safety
///
/// `seed` must point to 16 bytes that can be read, and `layout` to `rows * cols` bytes that can be written.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn boardgen_generate(
    rows: u32,
    cols: u32,
    mines: u32,
    opening: i32,
    guarantee: u32,
    seed: *const u8,
    layout: *mut u8,
) -> i32 {
    let guarantee = match guarantee {
        0 => Guarantee::None,
        1 => Guarantee::GuessFree,
        _ => return -5,
    };
    let opening = match opening {
        NO_OPENING => None,
        // anything else below nothing is off the board, and turned down as such
        cell => Some(usize::try_from(cell).unwrap_or(usize::MAX)),
    };
    // SAFETY: by the caller's promise there are 16 bytes to read here
    let seed: Seed = unsafe { ptr::read_unaligned(seed.cast::<[u8; SEED_BYTES]>()) };
    let request = Request { rows: rows as usize, cols: cols as usize, mines: mines as usize, seed, opening, guarantee };

    match generate(&request) {
        Ok(board) => {
            // SAFETY: a board that was made has `rows * cols` cells, which by the caller's promise fit here
            unsafe { slice::from_raw_parts_mut(layout, board.layout.len()) }.copy_from_slice(&board.layout);
            board.opening as i32 | if board.guess_free { GUESS_FREE } else { 0 }
        }
        Err(Refusal::Size) => -1,
        Err(Refusal::Mines) => -2,
        Err(Refusal::Opening) => -3,
        Err(Refusal::Seed) => -4,
        Err(Refusal::Layout) => unreachable!("no layout is taken in"),
    }
}
