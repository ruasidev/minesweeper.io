//! Making a board.

use std::fmt;

use crate::field::Minefield;
use crate::grid::Grid;
use crate::laying::MineLayer;
use crate::random::{Random, Seed};
use crate::repair::Repairer;
use crate::solver::{Outcome, Solver};

/// What a board is to be like
#[derive(Clone, Debug)]
pub struct Request {
    pub rows: usize,
    pub cols: usize,
    pub mines: usize,
    /// Where all the chance in the board comes from: the same request always gives the same board
    pub seed: Seed,
    /// The cell the board opens on (`row * cols + col`): the player's first click, say. Left out, one is picked.
    /// Either way it is kept clear of mines, and so are the cells around it
    pub opening: Option<usize>,
    pub guarantee: Guarantee,
}

/// What is promised of a board
#[derive(Clone, Copy, PartialEq, Eq, Default, Debug)]
pub enum Guarantee {
    /// Nothing: the mines fall wherever chance puts them
    None,
    /// That the board can be cleared from its opening by reasoning alone, without a single guess
    #[default]
    GuessFree,
}

/// A board that was made
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Board {
    /// the cell it opens on: the one asked for, or the one picked
    pub opening: usize,
    /// one byte per cell, row after row: 1 a mine, 0 not
    pub layout: Vec<u8>,
    /// Whether the board is known to be clearable without a guess. Always so when that was asked for, except on
    /// the rare board so crowded with mines that none could be found in the work allowed (see [`WORK_MAX`]);
    /// never when it wasn't asked for, since nobody looked
    pub guess_free: bool,
    pub effort: Effort,
}

/// What a board took to make
#[derive(Clone, Copy, PartialEq, Eq, Default, Debug)]
pub struct Effort {
    /// how many boards were laid, counting the one that was kept
    pub boards: u32,
    /// how many times one of them had mines moved to help it along
    pub repairs: u32,
    /// roughly how many steps the solver took over all of them
    pub work: u64,
}

/// Why a board can't be made
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Refusal {
    /// there is no board of that size
    Size,
    /// there isn't room for that many mines clear of the opening
    Mines,
    /// the opening isn't a cell of the board
    Opening,
    /// the seed is all zeroes
    Seed,
    /// the layout isn't one byte for every cell
    Layout,
}

impl fmt::Display for Refusal {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Size => "there is no board of that size",
            Self::Mines => "there isn't room for that many mines clear of the opening",
            Self::Opening => "the opening isn't a cell of the board",
            Self::Seed => "a seed can't be all zeroes",
            Self::Layout => "a layout is one byte for every cell",
        })
    }
}

impl std::error::Error for Refusal {}

/// How many boards are taken or left just as chance laid them, before any is helped along. Every board of an
/// everyday size is found this way, as near as makes no difference, which keeps them what they would have been
/// anyway: boards picked at random from among the ones that need no guess
const BOARDS_AS_LAID: u32 = 64;

/// How much the solver may do, over every board tried, in the making of one. It is what keeps the time a board
/// takes within bounds whatever is asked for: past it, the board that came closest is handed over as it is
pub const WORK_MAX: u64 = 400_000;

/// Makes a board.
///
/// The steps, in the order chance is drawn on:
///
/// 1. With no opening given, one is picked: `below(rows * cols)`.
/// 2. The mines are laid (see `laying`).
/// 3. If the board is to need no guess, it is put to the solver, and for as long as the solver can't clear it,
///    replaced: by a fresh one at first, and once enough of those have failed, by the same one with the mines
///    moved from where the solver was stuck (see `repair`).
pub fn generate(request: &Request) -> Result<Board, Refusal> {
    generate_within(request, WORK_MAX)
}

/// Makes a board with the solver allowed to do no more than `work_max`
fn generate_within(request: &Request, work_max: u64) -> Result<Board, Refusal> {
    let grid = Grid::new(request.rows, request.cols).ok_or(Refusal::Size)?;
    let mut random = Random::from_seed(&request.seed).ok_or(Refusal::Seed)?;
    let opening = match request.opening {
        Some(cell) if cell < grid.cells() => cell,
        Some(_) => return Err(Refusal::Opening),
        None => random.below(grid.cells()),
    };
    let opening_place = grid.place_of(opening);
    let mut layer = MineLayer::new(grid, request.mines, opening_place).ok_or(Refusal::Mines)?;
    let mut field = Minefield::new(grid);
    layer.lay(&mut field, &mut random);

    let mut effort = Effort { boards: 1, ..Effort::default() };
    let guess_free = match request.guarantee {
        Guarantee::None => false,
        Guarantee::GuessFree => {
            let mut making = Making { layer: &mut layer, random: &mut random, effort: &mut effort, work_max };
            making.guess_free(&mut field, opening_place)
        }
    };
    Ok(Board { opening, layout: field.layout(), guess_free, effort })
}

/// What goes into the making of one board
struct Making<'a> {
    layer: &'a mut MineLayer,
    random: &'a mut Random,
    effort: &'a mut Effort,
    work_max: u64,
}

impl Making<'_> {
    /// Replaces a board until the solver can clear it. Returns false, leaving the board that came closest, if
    /// the work allowed ran out first
    fn guess_free(&mut self, field: &mut Minefield, opening: usize) -> bool {
        let mut solver = Solver::new(field.grid());
        let mut repairer = Repairer::default();
        // the board that left the fewest cells to uncover when the solver went through it unhelped, and how many
        let mut closest: Option<(usize, Minefield)> = None;
        // How many times the board has been helped along since the solver last started on it, and how many
        // times it had been by the time it was cleared on the run before that
        let (mut helped, mut helped_last_time) = (0, u32::MAX);
        let mut outcome = solver.solve(field, opening);
        loop {
            self.effort.work = solver.work();
            if outcome == Outcome::Cleared {
                if helped == 0 {
                    return true;
                }
                // Cleared, but with help. Whether it can be cleared without is for a run from the start to say
                (helped, helped_last_time) = (0, helped);
                outcome = solver.solve(field, opening);
                continue;
            }

            if helped == 0 {
                let left = solver.safe_cells_hidden();
                match &mut closest {
                    Some((fewest, _)) if *fewest <= left => {}
                    Some((fewest, kept)) => {
                        *fewest = left;
                        kept.copy_from(field);
                    }
                    None => closest = Some((left, field.clone())),
                }
            }
            if self.effort.work >= self.work_max {
                if let Some((_, kept)) = &closest {
                    field.copy_from(kept);
                }
                return false;
            }

            // A board is helped for as long as each run needs less help than the one before, which it must if
            // it is getting anywhere. One that isn't is dropped for a fresh one
            let may_help = self.effort.boards > BOARDS_AS_LAID && helped + 1 < helped_last_time;
            if may_help && repairer.relieve(field, &mut solver, self.random) {
                helped += 1;
                self.effort.repairs += 1;
                outcome = solver.resume();
            } else {
                self.layer.lay(field, self.random);
                self.effort.boards += 1;
                (helped, helped_last_time) = (0, u32::MAX);
                outcome = solver.solve(field, opening);
            }
        }
    }
}

/// Whether a board can be cleared from an opening without a guess.
///
/// The layout is one byte per cell, row after row, anything but 0 a mine. A board that opens on a mine can't be
/// cleared at all.
pub fn is_guess_free(rows: usize, cols: usize, layout: &[u8], opening: usize) -> Result<bool, Refusal> {
    let grid = Grid::new(rows, cols).ok_or(Refusal::Size)?;
    let field = Minefield::from_layout(grid, layout).ok_or(Refusal::Layout)?;
    if opening >= grid.cells() {
        return Err(Refusal::Opening);
    }
    let place = grid.place_of(opening);
    Ok(!field.is_mine(place) && Solver::new(grid).solve(&field, place) == Outcome::Cleared)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// sixteen bytes counting up from `first`
    fn seed_from(first: u8) -> Seed {
        std::array::from_fn(|at| first.wrapping_add(at as u8))
    }

    fn request(rows: usize, cols: usize, mines: usize, first: u8) -> Request {
        Request { rows, cols, mines, seed: seed_from(first), opening: None, guarantee: Guarantee::GuessFree }
    }

    /// the cells of a board that are the opening or beside it
    fn clear_zone(rows: usize, cols: usize, opening: usize) -> impl Iterator<Item = usize> {
        let (row, col) = (opening / cols, opening % cols);
        (0..rows * cols).filter(move |cell| (cell / cols).abs_diff(row) <= 1 && (cell % cols).abs_diff(col) <= 1)
    }

    #[test]
    fn makes_the_same_board_from_the_same_request() {
        let asked = request(16, 30, 99, 9);
        let first = generate(&asked).unwrap();
        assert_eq!(generate(&asked).unwrap(), first);
        assert_ne!(generate(&request(16, 30, 99, 10)).unwrap().layout, first.layout);
    }

    #[test]
    fn lays_as_many_mines_as_asked_for_clear_of_the_opening() {
        for guarantee in [Guarantee::None, Guarantee::GuessFree] {
            for (first, (rows, cols, mines)) in
                [(9, 9, 10), (16, 16, 40), (16, 30, 99), (4, 4, 7), (12, 12, 99)].into_iter().enumerate()
            {
                let board = generate(&Request { guarantee, ..request(rows, cols, mines, first as u8) }).unwrap();
                assert_eq!(board.layout.len(), rows * cols);
                assert_eq!(board.layout.iter().map(|&mine| usize::from(mine)).sum::<usize>(), mines);
                assert!(clear_zone(rows, cols, board.opening).all(|cell| board.layout[cell] == 0));
            }
        }
    }

    #[test]
    fn opens_where_it_is_asked_to_and_picks_somewhere_on_the_board_when_it_is_not() {
        let asked = Request { opening: Some(17), ..request(9, 9, 10, 1) };
        assert_eq!(generate(&asked).unwrap().opening, 17);
        for first in 0..50 {
            let asked = request(9, 9, 10, first);
            let picked = Random::from_seed(&asked.seed).unwrap().below(81);
            assert_eq!(generate(&asked).unwrap().opening, picked);
        }
    }

    #[test]
    fn makes_boards_that_need_no_guess_when_asked_to() {
        for (rows, cols, mines) in [(9, 9, 10), (16, 16, 40), (16, 30, 99), (12, 12, 99), (4, 40, 99)] {
            for first in 0..40 {
                let board = generate(&request(rows, cols, mines, first)).unwrap();
                assert!(board.guess_free, "{rows} x {cols}, {mines} mines, seed {first}");
                assert_eq!(is_guess_free(rows, cols, &board.layout, board.opening), Ok(true));
            }
        }
    }

    #[test]
    fn promises_nothing_of_a_board_laid_by_chance_alone() {
        let asked = Request { guarantee: Guarantee::None, ..request(16, 30, 99, 3) };
        let board = generate(&asked).unwrap();
        assert!(!board.guess_free);
        assert_eq!(board.effort, Effort { boards: 1, repairs: 0, work: 0 });
    }

    #[test]
    fn takes_boards_as_they_are_laid_for_as_long_as_that_might_do() {
        // on an everyday board one that needs no guess always turns up before any has to be helped along
        for (rows, cols, mines) in [(9, 9, 10), (16, 16, 40), (16, 30, 99)] {
            for first in 0..100 {
                let effort = generate(&request(rows, cols, mines, first)).unwrap().effort;
                assert_eq!(effort.repairs, 0);
                assert!((1..=BOARDS_AS_LAID).contains(&effort.boards));
            }
        }
    }

    #[test]
    fn helps_boards_along_where_chance_would_never_get_there() {
        // more than a third of the board is mines
        let board = generate(&request(16, 16, 99, 5)).unwrap();
        assert!(board.guess_free);
        assert!(board.effort.boards > BOARDS_AS_LAID && board.effort.repairs > 0);
        assert!(board.effort.work < WORK_MAX);
    }

    #[test]
    fn hands_over_the_closest_board_when_the_work_allowed_runs_out() {
        let asked = request(16, 16, 99, 5);
        let cut_short = generate_within(&asked, 2000).unwrap();
        assert!(!cut_short.guess_free);
        assert!(cut_short.effort.work >= 2000 && cut_short.effort.work < 4000);
        // still a board of the kind asked for, and the same one every time
        assert_eq!(cut_short.layout.iter().map(|&mine| usize::from(mine)).sum::<usize>(), 99);
        assert!(clear_zone(16, 16, cut_short.opening).all(|cell| cut_short.layout[cell] == 0));
        assert_eq!(generate_within(&asked, 2000).unwrap(), cut_short);
        assert_eq!(is_guess_free(16, 16, &cut_short.layout, cut_short.opening), Ok(false));
    }

    #[test]
    fn turns_down_what_can_not_be_made() {
        let refused = |change: fn(&mut Request)| {
            let mut asked = request(9, 9, 10, 1);
            change(&mut asked);
            generate(&asked).unwrap_err()
        };
        assert_eq!(refused(|asked| asked.rows = 0), Refusal::Size);
        assert_eq!(refused(|asked| asked.cols = crate::grid::SIDE_MAX + 1), Refusal::Size);
        assert_eq!(refused(|asked| asked.mines = 73), Refusal::Mines);
        assert_eq!(refused(|asked| asked.opening = Some(81)), Refusal::Opening);
        assert_eq!(refused(|asked| asked.seed = [0; 16]), Refusal::Seed);
        // a corner opening keeps fewer cells clear, so more mines fit around it
        let corner = Request { mines: 77, opening: Some(0), ..request(9, 9, 10, 1) };
        assert!(generate(&corner).is_ok());
    }

    #[test]
    fn says_whether_a_board_it_is_shown_needs_a_guess() {
        // one mine, two cells it could be in, and nothing to tell them apart
        assert_eq!(is_guess_free(2, 4, &[0, 0, 0, 1, 0, 0, 0, 0], 0), Ok(false));
        assert_eq!(is_guess_free(2, 4, &[0, 0, 0, 1, 0, 0, 0, 1], 0), Ok(true));
        // opened on a mine, a board can't be cleared at all
        assert_eq!(is_guess_free(2, 4, &[0, 0, 0, 1, 0, 0, 0, 1], 3), Ok(false));
        // the opening needn't be a cell with nothing around it: its number is read like any other
        assert_eq!(is_guess_free(1, 2, &[0, 1], 0), Ok(true));
        assert_eq!(is_guess_free(1, 3, &[0, 0, 1], 1), Ok(false));
    }

    #[test]
    fn turns_down_a_board_it_can_not_make_sense_of() {
        assert_eq!(is_guess_free(0, 4, &[], 0), Err(Refusal::Size));
        assert_eq!(is_guess_free(2, 4, &[0; 7], 0), Err(Refusal::Layout));
        assert_eq!(is_guess_free(2, 4, &[0; 8], 8), Err(Refusal::Opening));
    }

    #[test]
    fn explains_a_refusal_in_words() {
        assert_eq!(Refusal::Seed.to_string(), "a seed can't be all zeroes");
        for refusal in [Refusal::Size, Refusal::Mines, Refusal::Opening, Refusal::Layout] {
            assert!(!refusal.to_string().is_empty());
        }
    }
}
