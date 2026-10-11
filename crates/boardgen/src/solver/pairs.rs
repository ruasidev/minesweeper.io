//! What two numbers that share hidden cells say between them.
//!
//! Take two numbers, A and B, with some hidden cells around both. The mines among those shared cells can't be more
//! than either number still has to find, nor more than there are shared cells; and they can't be fewer than what A
//! has to find less the cells only A is beside, nor the same for B. When the most and the fewest come to the same
//! count, that is how many mines the shared cells hold, and so how many the cells beside only A, and beside only B,
//! hold too. Any of those three groups that turns out to hold no mines, or nothing but mines, is settled.
//!
//! (The familiar patterns are all cases of it: a 1 beside a 2 against a wall, a number whose cells are all among
//! another's, and so on.)

use super::{Cell, Solver};

/// Two numbers can share a hidden cell only if they are within two steps of each other, so everything a pair has in
/// common lies in the five-by-five window around either of them. A set of the window's cells is a bit for each,
/// row after row
const WINDOW: usize = 5;
const MIDDLE: usize = 2;

/// The cells of the window that are around its cell at (row, col)
const fn around(row: usize, col: usize) -> u32 {
    let mut cells = 0;
    let mut at = 0;
    while at < WINDOW * WINDOW {
        let (r, c) = (at / WINDOW, at % WINDOW);
        if (r != row || c != col) && r.abs_diff(row) <= 1 && c.abs_diff(col) <= 1 {
            cells |= 1 << at;
        }
        at += 1;
    }
    cells
}

const AROUND_MIDDLE: u32 = around(MIDDLE, MIDDLE);

/// A number that might share cells with the one in the middle of the window
struct Partner {
    /// where it is from the middle
    down: isize,
    right: isize,
    /// the cells of the window around it
    around: u32,
}

/// The cells of the window that come after its middle. (A pair would be looked at twice, once from each of its
/// numbers, if the cells before it were here too)
const PARTNERS: [Partner; WINDOW * WINDOW / 2] = {
    let mut partners = [const { Partner { down: 0, right: 0, around: 0 } }; WINDOW * WINDOW / 2];
    let mut at = 0;
    while at < partners.len() {
        let cell = WINDOW * MIDDLE + MIDDLE + 1 + at;
        let (row, col) = (cell / WINDOW, cell % WINDOW);
        partners[at] = Partner {
            down: row as isize - MIDDLE as isize,
            right: col as isize - MIDDLE as isize,
            around: around(row, col),
        };
        at += 1;
    }
    partners
};

impl Solver {
    /// Looks at every pair of numbers that share hidden cells. Returns whether anything came of it
    pub(super) fn pairs(&mut self) -> bool {
        let mut found = false;
        let mut at = 0;
        while at < self.numbers.len() {
            let number = self.numbers[at];
            if self.hidden_around[number] == 0 {
                // nothing left around this one for any number to be told about
                self.numbers.swap_remove(at);
                self.listed[number] = false;
                continue;
            }
            self.work += 1;
            found |= self.pair_up(number);
            at += 1;
        }
        found
    }

    /// Sets a number against each of its partners until one of them settles something
    fn pair_up(&mut self, a: usize) -> bool {
        let hidden = self.hidden_in_window(a);
        let around_a = hidden & AROUND_MIDDLE;
        for partner in &PARTNERS {
            let b = self.grid.step(a, partner.down, partner.right);
            if self.cells[b] != Cell::Open || self.hidden_around[b] == 0 {
                continue;
            }
            let shared = around_a & partner.around;
            if shared != 0 && self.settle_pair(a, b, around_a & !shared, shared) {
                return true;
            }
        }
        false
    }

    /// Which cells of the window around a place are hidden
    fn hidden_in_window(&self, middle: usize) -> u32 {
        let mut hidden = 0;
        for at in 0..WINDOW * WINDOW {
            if self.cells[self.window_place(middle, at)] == Cell::Hidden {
                hidden |= 1 << at;
            }
        }
        hidden
    }

    fn window_place(&self, middle: usize, at: usize) -> usize {
        self.grid.step(middle, (at / WINDOW) as isize - MIDDLE as isize, (at % WINDOW) as isize - MIDDLE as isize)
    }

    /// Settles what it can of the hidden cells around two numbers: those beside only the first (`only_a`), those
    /// beside both (`shared`), and those beside only the second (the rest of what is around it)
    fn settle_pair(&mut self, a: usize, b: usize, only_a: u32, shared: u32) -> bool {
        let shared_count = shared.count_ones() as u8;
        let (due_a, due_b) = (self.due[a], self.due[b]);
        let only_a_count = self.hidden_around[a] - shared_count;
        let only_b_count = self.hidden_around[b] - shared_count;

        let fewest = due_a.saturating_sub(only_a_count).max(due_b.saturating_sub(only_b_count));
        let most = shared_count.min(due_a).min(due_b);
        if fewest != most {
            return false;
        }
        // how many of the shared cells are mines, and so how many of the cells beside only one number are
        let in_shared = most;
        let (in_only_a, in_only_b) = (due_a - in_shared, due_b - in_shared);
        // a group is settled when it holds no mines or nothing but mines (and has anything in it at all)
        let settled = |mines: u8, cells: u8| cells > 0 && (mines == 0 || mines == cells);
        let mut found = false;

        if settled(in_only_b, only_b_count) {
            for place in self.grid.around(b) {
                if self.cells[place] == Cell::Hidden && !self.grid.touching(place, a) {
                    self.conclude(place, in_only_b != 0);
                }
            }
            found = true;
        }
        if settled(in_only_a, only_a_count) {
            self.conclude_in_window(a, only_a, in_only_a != 0);
            found = true;
        }
        if settled(in_shared, shared_count) {
            self.conclude_in_window(a, shared, in_shared != 0);
            found = true;
        }
        found
    }

    fn conclude_in_window(&mut self, middle: usize, cells: u32, mines: bool) {
        for at in 0..WINDOW * WINDOW {
            if cells >> at & 1 == 1 {
                self.conclude(self.window_place(middle, at), mines);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::solver::testing::{nothing_further, played};

    #[test]
    fn opens_what_is_beside_only_the_number_with_no_more_mines_to_find() {
        // One mine, in the middle of the third column. The 1 at the top sees two cells of that column and the 1
        // below it sees all three: whichever of the two is the mine, it is the second 1's mine as well, so the
        // third cell is safe
        let board = ["o....", "..*..", "....."];
        let (cleared, seen) = played(&board, nothing_further);
        assert!(!cleared);
        assert_eq!(seen, ["01###", "01###", "01###"]);

        let (cleared, seen) = played(&board, Solver::pairs);
        assert!(cleared);
        assert_eq!(seen, ["01110", "01*10", "01110"]);
    }

    #[test]
    fn marks_what_is_beside_only_the_number_with_more_mines_than_the_shared_cells_can_hold() {
        // A 1 above a 2, against the hidden fourth column. The cells they share hold one mine at most (the 1
        // says so), so the 2's other mine is in the one cell that only it is beside
        let board = [".....", "...**", "...*.", "o...."];
        let (cleared, seen) = played(&board, nothing_further);
        assert!(!cleared);
        assert_eq!(seen, ["001##", "002##", "002##", "001##"]);

        let (cleared, seen) = played(&board, Solver::pairs);
        assert!(cleared);
        assert_eq!(seen, ["00122", "002**", "002*3", "00111"]);
    }

    #[test]
    fn leaves_alone_a_pair_that_says_nothing_certain() {
        let (cleared, seen) = played(&["o..*", "...."], Solver::pairs);
        assert!(!cleared);
        assert_eq!(seen, ["001#", "001#"]);
    }

    #[test]
    fn knows_the_cells_around_each_cell_of_the_window() {
        assert_eq!(AROUND_MIDDLE.count_ones(), 8);
        assert_eq!(AROUND_MIDDLE & 1 << (WINDOW * MIDDLE + MIDDLE), 0);
        // a corner of the window has three cells of the window around it
        assert_eq!(around(0, 0), 1 << 1 | 1 << WINDOW | 1 << (WINDOW + 1));
    }

    #[test]
    fn pairs_the_middle_with_every_cell_after_it_once() {
        let offsets: Vec<(isize, isize)> = PARTNERS.iter().map(|partner| (partner.down, partner.right)).collect();
        assert_eq!(offsets.len(), 12);
        assert_eq!(offsets[0], (0, 1));
        assert_eq!(offsets[11], (2, 2));
        // none is the mirror image of another: each pair of numbers is met from one side only
        for &(down, right) in &offsets {
            assert!(!offsets.contains(&(-down, -right)));
        }
    }
}
