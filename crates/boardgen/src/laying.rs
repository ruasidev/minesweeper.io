//! Laying mines at random.
//!
//! The steps, which are part of what this crate promises (the same seed must always give the same board):
//!
//! 1. The cells a mine may go on are listed row after row: every cell but the opening and the cells around it, so
//!    that the first click always opens up a patch and never a lone number.
//! 2. A mine is put down `mines` times: for the i-th (from 0), `j = i + below(listed - i)`, the i-th and j-th
//!    entries of the list change places, and the mine goes on the cell now i-th. (The first steps of a
//!    Fisher-Yates shuffle.)

use crate::field::Minefield;
use crate::grid::Grid;
use crate::random::Random;

/// Lays a board's mines, as many times over as it is asked to
#[derive(Debug)]
pub struct MineLayer {
    mines: usize,
    /// the places a mine may go, row after row
    allowed: Vec<usize>,
    /// the same places, to be shuffled
    deck: Vec<usize>,
}

impl MineLayer {
    /// For a board opened at `opening`. None if there isn't room for that many mines clear of the opening
    pub fn new(grid: Grid, mines: usize, opening: usize) -> Option<Self> {
        let allowed: Vec<usize> = grid.board().filter(|&place| !grid.touching(place, opening)).collect();
        (mines <= allowed.len()).then(|| Self { mines, deck: Vec::with_capacity(allowed.len()), allowed })
    }

    /// Takes whatever mines the field has off it and lays it afresh
    pub fn lay(&mut self, field: &mut Minefield, random: &mut Random) {
        field.clear();
        self.deck.clone_from(&self.allowed);
        for laid in 0..self.mines {
            let chosen = laid + random.below(self.deck.len() - laid);
            self.deck.swap(laid, chosen);
            field.put(self.deck[laid]);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn random(first: u8) -> Random {
        Random::from_seed(&std::array::from_fn(|at| first.wrapping_add(at as u8))).unwrap()
    }

    fn laid(rows: usize, cols: usize, mines: usize, opening: usize, first: u8) -> Option<Minefield> {
        let grid = Grid::new(rows, cols)?;
        let mut field = Minefield::new(grid);
        MineLayer::new(grid, mines, grid.place_of(opening))?.lay(&mut field, &mut random(first));
        Some(field)
    }

    #[test]
    fn lays_exactly_as_many_mines_as_asked_for() {
        for mines in [0, 1, 10, 40, 72] {
            assert_eq!(laid(9, 9, mines, 40, mines as u8).unwrap().count(), mines);
        }
    }

    #[test]
    fn never_puts_one_on_the_opening_or_beside_it_wherever_the_opening_is() {
        let grid = Grid::new(6, 7).unwrap();
        for opening in 0..grid.cells() {
            let place = grid.place_of(opening);
            let room = grid.board().filter(|&other| !grid.touching(other, place)).count();
            // as many mines as fit: every cell that may hold one does
            let field = laid(6, 7, room, opening, opening as u8).unwrap();
            assert_eq!(field.count(), room);
            assert!(!field.is_mine(place));
            assert_eq!(field.numbers()[place], 0);
        }
    }

    #[test]
    fn can_fill_every_cell_it_is_allowed_to() {
        // opened one in from the corner: the three by three there is kept clear and the rest is mines
        let field = laid(4, 4, 7, 5, 3).unwrap();
        assert_eq!(field.layout(), [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1]);
    }

    #[test]
    fn turns_down_more_mines_than_there_is_room_for() {
        assert!(laid(4, 4, 8, 5, 3).is_none());
        // a corner keeps fewer cells clear, so there is room for more
        assert!(laid(4, 4, 12, 0, 3).is_some());
        assert!(laid(4, 4, 13, 0, 3).is_none());
    }

    #[test]
    fn lays_a_field_afresh_each_time() {
        let grid = Grid::new(9, 9).unwrap();
        let mut field = Minefield::new(grid);
        let mut layer = MineLayer::new(grid, 10, grid.place_of(40)).unwrap();
        let mut random = random(1);
        layer.lay(&mut field, &mut random);
        let first = field.layout();
        layer.lay(&mut field, &mut random);
        assert_eq!(field.count(), 10);
        assert_ne!(field.layout(), first);
    }

    #[test]
    fn spreads_the_mines_about() {
        // 4 mines over the 16 cells clear of a middle opening, 400 times: a hundred on each, give or take
        let mut hits = [0u32; 25];
        for game in 0..400u32 {
            let field = laid(5, 5, 4, 12, game as u8).unwrap();
            for (cell, mine) in field.layout().into_iter().enumerate() {
                hits[cell] += u32::from(mine);
            }
        }
        let allowed: Vec<u32> =
            (0..25).filter(|cell| cell / 5 % 4 == 0 || cell % 5 % 4 == 0).map(|cell| hits[cell]).collect();
        assert_eq!(allowed.len(), 16);
        assert!(allowed.iter().all(|&count| (60..140).contains(&count)), "{allowed:?}");
    }
}
