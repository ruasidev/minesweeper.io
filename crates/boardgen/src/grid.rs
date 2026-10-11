//! The shape of a board, and where its cells are kept.
//!
//! To everything outside this crate a cell is its place in the board read row after row: `row * cols + col`.
//!
//! Inside, a board is kept with a border around it, [`MARGIN`] cells wide, and a cell is its place in *that*: a
//! "place". The border is why nothing here ever asks whether a neighbour is on the board. The cells around a place
//! are always there to be looked at, and one that is off the board simply never holds anything.

/// How wide the border is: wide enough that everything within two steps of a cell on the board can be looked at
pub const MARGIN: usize = 2;

/// The longest a side of a board may be. Far more than any game asks for: it is here so that sizes multiplied
/// together can't overflow, and so that nothing from outside can ask for a board that fills the memory
pub const SIDE_MAX: usize = 1024;

/// The shape of a board
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Grid {
    rows: usize,
    cols: usize,
    /// how far apart two places one above the other are
    stride: usize,
}

impl Grid {
    /// A board with this many rows and columns, if there can be one
    pub fn new(rows: usize, cols: usize) -> Option<Self> {
        let sides = 1..=SIDE_MAX;
        (sides.contains(&rows) && sides.contains(&cols)).then_some(Self { rows, cols, stride: cols + 2 * MARGIN })
    }

    #[cfg(test)]
    pub fn cols(self) -> usize {
        self.cols
    }

    /// how many cells the board has
    pub fn cells(self) -> usize {
        self.rows * self.cols
    }

    /// How many places there are, border and all: the length of anything kept by place
    pub fn places(self) -> usize {
        (self.rows + 2 * MARGIN) * self.stride
    }

    /// the place of a cell
    pub fn place_of(self, cell: usize) -> usize {
        debug_assert!(cell < self.cells());
        (cell / self.cols + MARGIN) * self.stride + cell % self.cols + MARGIN
    }

    /// the cell at a place on the board
    #[cfg(test)]
    pub fn cell_of(self, place: usize) -> usize {
        (place / self.stride - MARGIN) * self.cols + place % self.stride - MARGIN
    }

    /// The places on the board, row after row
    pub fn board(self) -> impl Iterator<Item = usize> {
        (0..self.rows).flat_map(move |row| {
            let start = (row + MARGIN) * self.stride + MARGIN;
            start..start + self.cols
        })
    }

    /// The eight places around one that is on the board, row after row. Some may be in the border
    pub fn around(self, place: usize) -> [usize; 8] {
        let (above, below) = (place - self.stride, place + self.stride);
        [above - 1, above, above + 1, place - 1, place + 1, below - 1, below, below + 1]
    }

    /// The place `down` rows below and `right` columns to the right of one (above and to the left, for less than
    /// nothing). For steps of no more than [`MARGIN`] from a place on the board
    pub fn step(self, place: usize, down: isize, right: isize) -> usize {
        place.wrapping_add_signed(down * self.stride as isize + right)
    }

    /// whether two places are the same or side by side, corners included
    pub fn touching(self, a: usize, b: usize) -> bool {
        (a / self.stride).abs_diff(b / self.stride) <= 1 && (a % self.stride).abs_diff(b % self.stride) <= 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn has_no_board_without_cells_or_with_too_many() {
        assert!(Grid::new(0, 5).is_none());
        assert!(Grid::new(5, 0).is_none());
        assert!(Grid::new(SIDE_MAX + 1, 5).is_none());
        assert!(Grid::new(1, 1).is_some());
        assert!(Grid::new(SIDE_MAX, SIDE_MAX).is_some());
    }

    #[test]
    fn keeps_every_cell_at_a_place_of_its_own_and_finds_it_again() {
        let grid = Grid::new(3, 5).unwrap();
        let places: Vec<usize> = (0..grid.cells()).map(|cell| grid.place_of(cell)).collect();
        assert_eq!(places, grid.board().collect::<Vec<_>>());
        for (cell, &place) in places.iter().enumerate() {
            assert_eq!(grid.cell_of(place), cell);
            assert!(place < grid.places());
        }
    }

    #[test]
    fn gives_the_places_around_one_row_after_row() {
        let grid = Grid::new(3, 3).unwrap();
        let middle = grid.place_of(4);
        let around = grid.around(middle).map(|place| grid.cell_of(place));
        assert_eq!(around, [0, 1, 2, 3, 5, 6, 7, 8]);
    }

    #[test]
    fn has_border_to_look_at_around_a_corner() {
        let grid = Grid::new(4, 4).unwrap();
        let on_board: Vec<usize> = grid.board().collect();
        for corner in [0, 3, 12, 15].map(|cell| grid.place_of(cell)) {
            let outside = grid.around(corner).into_iter().filter(|place| !on_board.contains(place)).count();
            assert_eq!(outside, 5);
            // two steps away in every direction is still inside the arrays
            for (down, right) in [(-2, -2), (-2, 2), (2, -2), (2, 2)] {
                assert!(grid.step(corner, down, right) < grid.places());
            }
        }
    }

    #[test]
    fn steps_by_rows_and_columns() {
        let grid = Grid::new(5, 5).unwrap();
        let middle = grid.place_of(12);
        assert_eq!(grid.cell_of(grid.step(middle, -2, -2)), 0);
        assert_eq!(grid.cell_of(grid.step(middle, 1, -1)), 16);
        assert_eq!(grid.step(middle, 0, 0), middle);
    }

    #[test]
    fn knows_which_places_touch() {
        let grid = Grid::new(5, 5).unwrap();
        let place = |cell| grid.place_of(cell);
        assert!(grid.touching(place(12), place(12)));
        assert!(grid.touching(place(12), place(6)));
        assert!(grid.touching(place(12), place(18)));
        assert!(!grid.touching(place(12), place(14)));
        // the end of one row and the start of the next are far apart
        assert!(!grid.touching(place(4), place(5)));
    }
}
