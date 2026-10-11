//! Where the mines are on a board, and the numbers that follow from them.

use crate::grid::Grid;

/// A board's mines. Kept by place (see [`Grid`]), with the count of mines around every place kept up to date as
/// mines are put down and taken away
#[derive(Clone, Debug)]
pub struct Minefield {
    grid: Grid,
    mines: Vec<bool>,
    around: Vec<u8>,
    count: usize,
}

impl Minefield {
    /// A board with no mines on it
    pub fn new(grid: Grid) -> Self {
        Self { grid, mines: vec![false; grid.places()], around: vec![0; grid.places()], count: 0 }
    }

    /// The board that a layout describes: one byte per cell, row after row, anything but 0 a mine.
    /// None if that isn't one byte for every cell
    pub fn from_layout(grid: Grid, layout: &[u8]) -> Option<Self> {
        if layout.len() != grid.cells() {
            return None;
        }
        let mut field = Self::new(grid);
        for (place, &byte) in grid.board().zip(layout) {
            if byte != 0 {
                field.put(place);
            }
        }
        Some(field)
    }

    pub fn grid(&self) -> Grid {
        self.grid
    }

    /// how many mines there are
    pub fn count(&self) -> usize {
        self.count
    }

    pub fn is_mine(&self, place: usize) -> bool {
        self.mines[place]
    }

    /// How many mines are around every place: the number a cell shows once it is uncovered
    pub fn numbers(&self) -> &[u8] {
        &self.around
    }

    /// Puts a mine on a place of the board that has none
    pub fn put(&mut self, place: usize) {
        debug_assert!(!self.mines[place]);
        self.mines[place] = true;
        self.count += 1;
        for neighbour in self.grid.around(place) {
            self.around[neighbour] += 1;
        }
    }

    /// Takes the mine off a place that has one
    pub fn take(&mut self, place: usize) {
        debug_assert!(self.mines[place]);
        self.mines[place] = false;
        self.count -= 1;
        for neighbour in self.grid.around(place) {
            self.around[neighbour] -= 1;
        }
    }

    /// Takes every mine off
    pub fn clear(&mut self) {
        self.mines.fill(false);
        self.around.fill(0);
        self.count = 0;
    }

    /// Makes this board the same as another of the same shape
    pub fn copy_from(&mut self, other: &Self) {
        debug_assert_eq!(self.grid, other.grid);
        self.mines.copy_from_slice(&other.mines);
        self.around.copy_from_slice(&other.around);
        self.count = other.count;
    }

    /// The mines as they are told to the world: one byte per cell, row after row, 1 for a mine
    pub fn layout(&self) -> Vec<u8> {
        self.grid.board().map(|place| u8::from(self.mines[place])).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn drawn(rows: &[&str]) -> Minefield {
        let grid = Grid::new(rows.len(), rows[0].len()).unwrap();
        let layout: Vec<u8> = rows.concat().bytes().map(|cell| u8::from(cell == b'*')).collect();
        Minefield::from_layout(grid, &layout).unwrap()
    }

    fn numbers_drawn(field: &Minefield) -> Vec<String> {
        let grid = field.grid();
        let places: Vec<usize> = grid.board().collect();
        places
            .chunks(grid.cols())
            .map(|row| {
                row.iter()
                    .map(|&place| if field.is_mine(place) { '*' } else { char::from(b'0' + field.numbers()[place]) })
                    .collect()
            })
            .collect()
    }

    #[test]
    fn counts_the_mines_around_every_cell() {
        let field = drawn(&["*...", "..*.", "...."]);
        assert_eq!(numbers_drawn(&field), ["*211", "12*1", "0111"]);
        assert_eq!(field.count(), 2);
    }

    #[test]
    fn keeps_the_numbers_right_as_mines_come_and_go() {
        let mut field = drawn(&["*...", "..*.", "...."]);
        let grid = field.grid();
        field.take(grid.place_of(6));
        field.put(grid.place_of(11));
        assert_eq!(numbers_drawn(&field), ["*100", "1111", "001*"]);
        field.clear();
        assert_eq!(numbers_drawn(&field), ["0000", "0000", "0000"]);
        assert_eq!(field.count(), 0);
    }

    #[test]
    fn gives_back_the_layout_it_was_made_from() {
        let layout = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
        let field = Minefield::from_layout(Grid::new(3, 4).unwrap(), &layout).unwrap();
        assert_eq!(field.layout(), layout);
    }

    #[test]
    fn takes_only_a_layout_with_a_byte_for_every_cell() {
        assert!(Minefield::from_layout(Grid::new(3, 4).unwrap(), &[0; 11]).is_none());
    }

    #[test]
    fn copies_another_board_whole() {
        let from = drawn(&["*...", "..*.", "...."]);
        let mut to = drawn(&["....", "....", "...*"]);
        to.copy_from(&from);
        assert_eq!(numbers_drawn(&to), numbers_drawn(&from));
        assert_eq!(to.count(), 2);
    }
}
