//! Moving mines out of the way of a solver that is stuck.
//!
//! Most boards that can't be cleared without a guess are a mine or two away from one that can. Where the solver
//! stopped, there is a number it could make nothing of: some of the hidden cells around it are mines, and nothing
//! says which. So the mines are taken away from around that number and put down again far from anything that has
//! been uncovered. The number now has only safe cells around it, which gets the solver moving again, and nothing it
//! had worked out before has become untrue.
//!
//! The solver is told of each move and carries on from where it was, rather than starting the board again. That
//! is what makes this cheap, and it is also why a board cleared this way isn't yet known to need no guess: what the
//! solver knew before the mines moved might not all follow from the numbers as they are now. So such a board is
//! put to the solver once more from the start (see `generate`).

use crate::field::Minefield;
use crate::random::Random;
use crate::solver::Solver;

/// Helps boards along. It keeps its working space from one time to the next
#[derive(Default, Debug)]
pub struct Repairer {
    numbers: Vec<usize>,
    /// the mines to be moved
    mines: Vec<usize>,
    /// Where a mine could go: hidden cells without one. `far` ones have nothing uncovered beside them, so a mine
    /// put there changes no number the solver has read; `near` ones are the rest
    far: Vec<usize>,
    near: Vec<usize>,
}

impl Repairer {
    /// Moves mines on a board the solver is stuck on, and tells the solver, so that it can uncover at least one
    /// more cell. Returns false, with nothing moved, if there is nowhere for the mines to go
    pub fn relieve(&mut self, field: &mut Minefield, solver: &mut Solver, random: &mut Random) -> bool {
        let grid = field.grid();
        let beside_open = |place: usize| grid.around(place).into_iter().any(|neighbour| solver.is_open(neighbour));

        self.numbers.clear();
        self.numbers.extend(solver.stuck_numbers());
        self.mines.clear();
        // the number whose hidden cells are being cleared of mines, if there is one
        let mut cleared = None;
        if self.numbers.is_empty() {
            // Every number is settled, and what is left is shut in behind mines the solver has found. One of
            // those is moved, to let it through
            self.mines.extend(grid.board().filter(|&place| solver.is_found_mine(place) && beside_open(place)));
            if self.mines.is_empty() {
                return false;
            }
            let chosen = self.mines[random.below(self.mines.len())];
            self.mines.clear();
            self.mines.push(chosen);
        } else {
            let number = self.numbers[random.below(self.numbers.len())];
            let hidden_mines = |&place: &usize| solver.is_hidden(place) && field.is_mine(place);
            self.mines.extend(grid.around(number).into_iter().filter(hidden_mines));
            cleared = Some(number);
        }

        self.far.clear();
        self.near.clear();
        for place in grid.board() {
            let free = solver.is_hidden(place) && !field.is_mine(place);
            if free && !cleared.is_some_and(|number| grid.touching(place, number)) {
                if beside_open(place) { self.near.push(place) } else { self.far.push(place) }
            }
        }
        // all of them or none: with some left behind, the solver might be no further on
        if self.far.len() + self.near.len() < self.mines.len() {
            return false;
        }
        for &from in &self.mines {
            let places = if self.far.is_empty() { &mut self.near } else { &mut self.far };
            let to = places.swap_remove(random.below(places.len()));
            field.take(from);
            field.put(to);
            solver.mine_moved(from, to);
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::solver::Outcome;
    use crate::solver::testing::{drawn, seen};

    fn random(first: u8) -> Random {
        Random::from_seed(&std::array::from_fn(|at| first.wrapping_add(at as u8))).unwrap()
    }

    /// A drawn board, with a solver that has gone as far as it can on it and got stuck
    fn stuck(rows: &[&str]) -> (Minefield, Solver) {
        let (field, opening) = drawn(rows);
        let mut solver = Solver::new(field.grid());
        assert_eq!(solver.solve(&field, opening), Outcome::Stuck);
        (field, solver)
    }

    #[test]
    fn clears_the_mines_from_around_a_number_the_solver_is_stuck_on() {
        for seed in 0..20 {
            // one mine in the two cells past the 1s, and nothing to say which
            let (mut field, mut solver) = stuck(&["o..*..", ".....*"]);
            assert_eq!(seen(&solver, &field), ["001###", "001###"]);
            let grid = field.grid();

            assert!(Repairer::default().relieve(&mut field, &mut solver, &mut random(seed)));

            // it went to one of the cells that nothing uncovered is beside, and the other mine stayed put
            let layout = field.layout();
            assert_eq!(field.count(), 2);
            assert_eq!((layout[3], layout[11]), (0, 1));
            assert_eq!(layout[4] + layout[10] + layout[5], 1, "{layout:?}");
            // and the solver, told of it, is on its way again
            solver.resume();
            assert!(solver.is_open(grid.place_of(3)) && solver.is_open(grid.place_of(9)));
        }
    }

    #[test]
    fn lets_the_solver_through_a_wall_of_mines_it_has_found() {
        for seed in 0..20 {
            // the 2s find the mines beside them, and what is behind those is out of reach
            let (mut field, mut solver) = stuck(&["o.*.", "..**"]);
            assert_eq!(seen(&solver, &field), ["02*#", "02*#"]);
            assert_eq!(solver.stuck_numbers().count(), 0);

            assert!(Repairer::default().relieve(&mut field, &mut solver, &mut random(seed)));

            // one of the two found mines went to the one cell without a mine
            let layout = field.layout();
            assert_eq!(field.count(), 3);
            assert_eq!((layout[3], layout[7]), (1, 1));
            assert_eq!(layout[2] + layout[6], 1, "{layout:?}");
            assert_eq!(solver.resume(), Outcome::Cleared);
        }
    }

    #[test]
    fn moves_nothing_when_there_is_nowhere_for_a_mine_to_go() {
        // the only cell without a mine is beside the very numbers that are stuck
        let (mut field, mut solver) = stuck(&["o..*", "...."]);
        let before = field.layout();
        assert!(!Repairer::default().relieve(&mut field, &mut solver, &mut random(1)));
        assert_eq!(field.layout(), before);
        assert_eq!(seen(&solver, &field), ["001#", "001#"]);
    }

    #[test]
    fn gets_the_solver_at_least_a_cell_further_or_moves_nothing() {
        use crate::grid::Grid;
        use crate::laying::MineLayer;

        // boards crowded enough that the solver is stuck on nearly all of them, each helped until it is cleared
        // or can't be helped
        let grid = Grid::new(8, 8).unwrap();
        let opening = grid.place_of(27);
        let mut layer = MineLayer::new(grid, 24, opening).unwrap();
        let mut field = Minefield::new(grid);
        let mut solver = Solver::new(grid);
        let mut repairer = Repairer::default();
        let mut random = random(9);
        let (mut helped, mut refused) = (0, 0);
        for _ in 0..300 {
            layer.lay(&mut field, &mut random);
            let mut outcome = solver.solve(&field, opening);
            while outcome == Outcome::Stuck {
                let (left, layout) = (solver.safe_cells_hidden(), field.layout());
                if !repairer.relieve(&mut field, &mut solver, &mut random) {
                    assert_eq!(field.layout(), layout);
                    refused += 1;
                    break;
                }
                assert_eq!(field.count(), 24);
                outcome = solver.resume();
                assert!(solver.safe_cells_hidden() < left, "the solver was no further on");
                helped += 1;
            }
        }
        // both things happened, and often enough to mean something
        assert!(helped > 300 && refused > 10, "helped {helped} times, refused {refused}");
    }

    #[test]
    fn puts_a_mine_beside_other_numbers_only_when_nowhere_is_further_off() {
        for seed in 0..20 {
            // Two pairs of cells with a mine in each, at either end, and every hidden cell beside a number.
            // Whichever pair is cleared, its mine has to go into the other
            let (mut field, mut solver) = stuck(&["*..o..*", "......."]);
            assert_eq!(seen(&solver, &field), ["#10001#", "#10001#"]);
            assert!(Repairer::default().relieve(&mut field, &mut solver, &mut random(seed)));
            let layout = field.layout();
            let (left, right) = (layout[0] + layout[7], layout[6] + layout[13]);
            assert!((left, right) == (0, 2) || (left, right) == (2, 0), "{layout:?}");
            assert_eq!(solver.resume(), Outcome::Cleared);
        }
    }
}
