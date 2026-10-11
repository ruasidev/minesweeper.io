//! The solver, held to the slowest and surest way of answering the same question.
//!
//! On a board of a few cells it is possible to try every single way the mines could lie. A cell is safe for certain
//! exactly when it is a mine in none of the ways that fit what has been uncovered. So whether a small board can be
//! cleared without a guess can be worked out with no cleverness at all, and the solver, which is all cleverness,
//! has to agree: saying yes to a board that needs a guess would break the promise the game makes, and saying no to
//! one that doesn't would mean there is reasoning it is missing.

use boardgen::{Guarantee, Request, Seed, generate, is_guess_free};

/// A small board, with a set of its cells as a bit each
struct Small {
    cells: usize,
    /// by cell: the cells around it
    around: Vec<u32>,
    mines: u32,
}

impl Small {
    fn new(rows: usize, cols: usize, layout: &[u8]) -> Self {
        let cells = rows * cols;
        assert!(cells <= 32, "too big to try every way");
        let around = (0..cells)
            .map(|cell| {
                let touches = |other: &usize| {
                    *other != cell
                        && (other / cols).abs_diff(cell / cols) <= 1
                        && (other % cols).abs_diff(cell % cols) <= 1
                };
                (0..cells).filter(touches).fold(0, |set, other| set | 1 << other)
            })
            .collect();
        let mines = (0..cells).filter(|&cell| layout[cell] != 0).fold(0, |set, cell| set | 1 << cell);
        Self { cells, around, mines }
    }

    /// Whether the board can be cleared from an opening by uncovering only cells that are a mine in no way of
    /// laying the mines that fits the numbers uncovered so far
    fn needs_no_guess(&self, opening: usize) -> bool {
        if self.mines >> opening & 1 == 1 {
            return false;
        }
        let all = u32::MAX >> (32 - self.cells);
        let mut open: u32 = 1 << opening;
        while open != all & !self.mines {
            let hidden = all & !open;
            let mut could_be_mine = 0;
            // every set of hidden cells, from all of them down to none
            let mut way = hidden;
            loop {
                if way.count_ones() == self.mines.count_ones() && self.fits(way, open) {
                    could_be_mine |= way;
                }
                if way == 0 {
                    break;
                }
                way = (way - 1) & hidden;
            }
            let safe = hidden & !could_be_mine;
            if safe == 0 {
                return false;
            }
            open |= safe;
        }
        true
    }

    /// whether mines laid this way would put the numbers they do on every uncovered cell
    fn fits(&self, way: u32, open: u32) -> bool {
        (0..self.cells)
            .filter(|&cell| open >> cell & 1 == 1)
            .all(|cell| (self.around[cell] & way).count_ones() == (self.around[cell] & self.mines).count_ones())
    }
}

/// a seed for each number, all different and none of them all zeroes
fn seed(number: u32) -> Seed {
    let mut bytes = [0xA5; 16];
    bytes[..4].copy_from_slice(&number.to_le_bytes());
    bytes
}

/// Small boards of every sort: each shape with from one mine to as many as it holds, opened on every cell
fn small_boards() -> impl Iterator<Item = (usize, usize, usize, usize)> {
    [(4, 4), (3, 5), (4, 5), (2, 8), (1, 12), (5, 5)].into_iter().flat_map(|(rows, cols)| {
        (1..rows * cols).flat_map(move |mines| (0..rows * cols).map(move |opening| (rows, cols, mines, opening)))
    })
}

#[test]
fn agrees_with_trying_every_way_the_mines_could_lie() {
    let (mut boards, mut clearable) = (0, 0);
    for (number, (rows, cols, mines, opening)) in small_boards().enumerate() {
        let asked = Request {
            rows,
            cols,
            mines,
            seed: seed(number as u32),
            opening: Some(opening),
            guarantee: Guarantee::None,
        };
        // too many mines to keep clear of this opening
        let Ok(board) = generate(&asked) else { continue };
        let expected = Small::new(rows, cols, &board.layout).needs_no_guess(opening);
        let found = is_guess_free(rows, cols, &board.layout, opening).unwrap();
        assert_eq!(found, expected, "{rows} x {cols} opened at {opening}: {:?}", board.layout);
        boards += 1;
        clearable += u32::from(expected);
    }
    // enough of both kinds for agreeing to mean something
    assert!(boards > 1000 && clearable > 300 && boards - clearable > 300, "{clearable} of {boards} need no guess");
}

#[test]
fn promises_no_guess_only_of_boards_that_need_none() {
    let mut promised = 0;
    for (number, (rows, cols, mines, opening)) in small_boards().enumerate() {
        let asked = Request {
            rows,
            cols,
            mines,
            seed: seed(number as u32),
            opening: Some(opening),
            guarantee: Guarantee::GuessFree,
        };
        let Ok(board) = generate(&asked) else { continue };
        if board.guess_free {
            assert!(
                Small::new(rows, cols, &board.layout).needs_no_guess(opening),
                "{rows} x {cols} opened at {opening}: {:?}",
                board.layout
            );
            promised += 1;
        }
    }
    assert!(promised > 1000, "only {promised} boards came with the promise");
}

#[test]
fn works_out_a_board_it_is_told_can_not_be_cleared() {
    // the oracle itself, on boards small enough to check by eye
    let stuck = Small::new(2, 4, &[0, 0, 0, 1, 0, 0, 0, 0]);
    assert!(!stuck.needs_no_guess(0));
    let clear = Small::new(2, 4, &[0, 0, 0, 1, 0, 0, 0, 1]);
    assert!(clear.needs_no_guess(0));
    assert!(!clear.needs_no_guess(3));
    // three numbers are needed to see that the far corner is safe
    assert!(Small::new(3, 3, &[0, 0, 1, 0, 0, 0, 1, 0, 0]).needs_no_guess(0));
}
