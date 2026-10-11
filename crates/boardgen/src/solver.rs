//! Clearing a board by reasoning alone.
//!
//! The solver plays a board the way a careful player would: it only ever uncovers a cell it can prove is safe, from
//! nothing but the numbers it has uncovered so far and how many mines the board has. If it clears the board, anyone
//! can, without once having to guess. If it gets stuck, it says where.
//!
//! It reasons in three ways, each stronger and slower than the one before, and only reaches for the next when the
//! one before has nothing more to give:
//!
//! 1. One number at a time (this file): a number with all its mines found has only safe cells left around it, and
//!    one with as many hidden cells around it as mines still to find has only mines.
//! 2. Two numbers at a time ([`pairs`]): what two numbers that share hidden cells say between them.
//! 3. Everything at once ([`exact`]): every way the mines could lie that fits all the numbers and the count of
//!    mines left. A cell that is a mine in none of them is safe.
//!
//! Nothing it concludes is ever a guess, however little it is allowed to work: giving up on a hard question can
//! only leave it stuck on a board that could have been cleared, never let through one that couldn't.

mod exact;
mod pairs;

use crate::field::Minefield;
use crate::grid::Grid;

/// What the solver knows about a place
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Cell {
    /// off the board
    Border,
    /// covered, and not yet known to be a mine
    Hidden,
    /// uncovered: it wasn't a mine, and its number can be read
    Open,
    /// covered, and proved to be a mine
    Mine,
}

/// How an attempt to clear a board ended
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    /// every cell that isn't a mine was uncovered
    Cleared,
    /// there was nothing left that could be proved
    Stuck,
}

/// Clears boards of one shape. It keeps its working space from one board to the next, so trying many costs no more
/// than the work itself
#[derive(Debug)]
pub struct Solver {
    grid: Grid,
    cells: Vec<Cell>,
    /// by place: how many of the cells around it are hidden
    hidden_around: Vec<u8>,
    /// by place: how many of the mines around it haven't been found. For an open cell, that is its number less
    /// the mines marked around it
    due: Vec<u8>,
    /// open cells to look at again, because something around them changed
    queue: Vec<usize>,
    queued: Vec<bool>,
    /// The open cells with hidden cells around them, and some that no longer have any: those are dropped as they
    /// are come across. `listed` says, by place, which cells are in it
    numbers: Vec<usize>,
    listed: Vec<bool>,
    /// how many cells are hidden
    hidden: usize,
    /// how many mines haven't been found
    unfound: usize,
    /// how much has been done, on every board so far (see [`Solver::work`])
    work: u64,
    /// what `cells` and `hidden_around` are for a board nothing has been uncovered on
    untouched: (Vec<Cell>, Vec<u8>),
    exact: exact::Workspace,
    /// where the mines really are, by place, to check every conclusion against while testing
    #[cfg(debug_assertions)]
    truth: Vec<bool>,
}

impl Solver {
    pub fn new(grid: Grid) -> Self {
        let mut cells = vec![Cell::Border; grid.places()];
        let mut hidden_around = vec![0; grid.places()];
        for place in grid.board() {
            cells[place] = Cell::Hidden;
            for neighbour in grid.around(place) {
                hidden_around[neighbour] += 1;
            }
        }
        Self {
            grid,
            cells: cells.clone(),
            hidden_around: hidden_around.clone(),
            due: vec![0; grid.places()],
            queue: Vec::new(),
            queued: vec![false; grid.places()],
            numbers: Vec::new(),
            listed: vec![false; grid.places()],
            hidden: 0,
            unfound: 0,
            work: 0,
            untouched: (cells, hidden_around),
            exact: exact::Workspace::new(grid),
            #[cfg(debug_assertions)]
            truth: Vec::new(),
        }
    }

    /// Tries to clear a board from the cell it opens on, which must not be a mine
    pub fn solve(&mut self, field: &Minefield, opening: usize) -> Outcome {
        debug_assert!(field.grid() == self.grid && !field.is_mine(opening));
        self.start(field);
        self.open(opening);
        self.resume()
    }

    /// Carries on with a board it was stuck on, after being told what has changed (see [`Solver::mine_moved`])
    pub fn resume(&mut self) -> Outcome {
        loop {
            self.settle();
            if self.hidden == self.unfound {
                return Outcome::Cleared;
            }
            if self.unfound == 0 {
                // every mine is accounted for: whatever is still hidden is safe
                self.open_the_rest();
                return Outcome::Cleared;
            }
            if !(self.pairs() || self.exact()) {
                return Outcome::Stuck;
            }
        }
    }

    /// How many cells that aren't mines are still hidden: none on a cleared board
    pub fn safe_cells_hidden(&self) -> usize {
        self.hidden - self.unfound
    }

    /// Roughly how many steps it has taken, over every board it was given: what the making of a board is kept
    /// within bounds by
    pub fn work(&self) -> u64 {
        self.work
    }

    /// Told that a mine was moved, on a board it is stuck on: from a cell it hasn't uncovered to a hidden cell.
    ///
    /// What it knew stays true, since nothing it uncovered has a mine on it now and every mine it found is still
    /// one (but for a found mine that is itself moved, which it forgets was ever found). It is no longer
    /// certain that all of it could be worked out from the start, though: a board that is cleared after this has
    /// to be gone through again, with [`Solver::solve`], before that can be said of it.
    pub fn mine_moved(&mut self, from: usize, to: usize) {
        debug_assert!(self.cells[from] == Cell::Hidden || self.cells[from] == Cell::Mine);
        debug_assert_eq!(self.cells[to], Cell::Hidden);
        if self.cells[from] == Cell::Mine {
            self.cells[from] = Cell::Hidden;
            self.hidden += 1;
            self.unfound += 1;
            for neighbour in self.grid.around(from) {
                self.hidden_around[neighbour] += 1;
                self.due[neighbour] += 1;
                self.list(neighbour);
            }
        }
        for neighbour in self.grid.around(from) {
            self.due[neighbour] -= 1;
            self.look_again(neighbour);
        }
        for neighbour in self.grid.around(to) {
            self.due[neighbour] += 1;
            self.look_again(neighbour);
        }
        #[cfg(debug_assertions)]
        {
            self.truth[from] = false;
            self.truth[to] = true;
        }
    }

    pub fn is_hidden(&self, place: usize) -> bool {
        self.cells[place] == Cell::Hidden
    }

    pub fn is_open(&self, place: usize) -> bool {
        self.cells[place] == Cell::Open
    }

    /// whether a place was proved to be a mine
    pub fn is_found_mine(&self, place: usize) -> bool {
        self.cells[place] == Cell::Mine
    }

    /// The open cells that still have hidden cells around them: on a board the solver is stuck on, the numbers it
    /// could make nothing more of
    pub fn stuck_numbers(&self) -> impl Iterator<Item = usize> + '_ {
        self.numbers.iter().copied().filter(|&number| self.hidden_around[number] > 0)
    }

    fn start(&mut self, field: &Minefield) {
        self.cells.copy_from_slice(&self.untouched.0);
        self.hidden_around.copy_from_slice(&self.untouched.1);
        self.due.copy_from_slice(field.numbers());
        self.queue.clear();
        self.queued.fill(false);
        self.numbers.clear();
        self.listed.fill(false);
        self.hidden = self.grid.cells();
        self.unfound = field.count();
        self.work += self.grid.cells() as u64;
        #[cfg(debug_assertions)]
        {
            self.truth.clear();
            self.truth.extend((0..self.grid.places()).map(|place| field.is_mine(place)));
        }
    }

    /// Uncovers a hidden cell that has been proved safe
    fn open(&mut self, place: usize) {
        debug_assert_eq!(self.cells[place], Cell::Hidden);
        #[cfg(debug_assertions)]
        assert!(!self.truth[place], "uncovered a mine");
        self.cells[place] = Cell::Open;
        self.hidden -= 1;
        self.work += 1;
        for neighbour in self.grid.around(place) {
            self.hidden_around[neighbour] -= 1;
            self.look_again(neighbour);
        }
        if self.hidden_around[place] > 0 {
            self.list(place);
            self.look_again(place);
        }
    }

    /// Puts an open cell that has hidden cells around it among the numbers, if it isn't there already
    fn list(&mut self, place: usize) {
        if self.cells[place] == Cell::Open && self.hidden_around[place] > 0 && !self.listed[place] {
            self.listed[place] = true;
            self.numbers.push(place);
        }
    }

    /// Marks a hidden cell that has been proved to be a mine
    fn mark(&mut self, place: usize) {
        debug_assert_eq!(self.cells[place], Cell::Hidden);
        #[cfg(debug_assertions)]
        assert!(self.truth[place], "marked a safe cell as a mine");
        self.cells[place] = Cell::Mine;
        self.hidden -= 1;
        self.unfound -= 1;
        self.work += 1;
        for neighbour in self.grid.around(place) {
            self.hidden_around[neighbour] -= 1;
            self.due[neighbour] -= 1;
            self.look_again(neighbour);
        }
    }

    /// Opens or marks a hidden cell, by what it was proved to be
    fn conclude(&mut self, place: usize, mine: bool) {
        if mine { self.mark(place) } else { self.open(place) }
    }

    fn look_again(&mut self, place: usize) {
        if self.cells[place] == Cell::Open && !self.queued[place] {
            self.queued[place] = true;
            self.queue.push(place);
        }
    }

    /// Follows what each number says by itself for as long as that leads anywhere
    fn settle(&mut self) {
        while let Some(number) = self.queue.pop() {
            self.queued[number] = false;
            let hidden = self.hidden_around[number];
            let due = self.due[number];
            if hidden == 0 || (due != 0 && due != hidden) {
                continue;
            }
            // no mines left to find around it: the rest is safe. As many as there are cells: the rest is mines
            for neighbour in self.grid.around(number) {
                if self.cells[neighbour] == Cell::Hidden {
                    self.conclude(neighbour, due != 0);
                }
            }
        }
    }

    fn open_the_rest(&mut self) {
        for place in self.grid.board() {
            if self.cells[place] == Cell::Hidden {
                self.open(place);
            }
        }
        self.queue.clear();
        self.queued.fill(false);
    }
}

#[cfg(test)]
pub(crate) mod testing {
    //! Boards drawn as text, so that a test reads like the board it is about

    use super::*;

    /// A board drawn a row to a line: `*` a mine, `o` the cell it is opened on, `.` anything else.
    /// Gives the board and the place of its opening
    pub(crate) fn drawn(rows: &[&str]) -> (Minefield, usize) {
        let grid = Grid::new(rows.len(), rows[0].len()).expect("a board");
        let cells = rows.concat();
        let layout: Vec<u8> = cells.bytes().map(|cell| u8::from(cell == b'*')).collect();
        let opening = cells.find('o').expect("a drawn board says where it opens");
        (Minefield::from_layout(grid, &layout).expect("rows of one length"), grid.place_of(opening))
    }

    /// What a solver knows of a board, drawn the same way: `#` hidden, `*` a mine it found, and the number on
    /// everything it uncovered
    pub(crate) fn seen(solver: &Solver, field: &Minefield) -> Vec<String> {
        let places: Vec<usize> = solver.grid.board().collect();
        let cell = |&place: &usize| match solver.cells[place] {
            Cell::Hidden => '#',
            Cell::Mine => '*',
            _ => char::from(b'0' + field.numbers()[place]),
        };
        places.chunks(solver.grid.cols()).map(|row| row.iter().map(cell).collect()).collect()
    }

    /// Plays a drawn board with one number at a time and whatever `further` reasoning it is given besides.
    /// Gives whether it was cleared and what was known at the end
    pub(crate) fn played(rows: &[&str], further: impl Fn(&mut Solver) -> bool) -> (bool, Vec<String>) {
        let (field, opening) = drawn(rows);
        let mut solver = Solver::new(field.grid());
        solver.start(&field);
        solver.open(opening);
        loop {
            solver.settle();
            let cleared = solver.hidden == solver.unfound;
            if cleared || !further(&mut solver) {
                return (cleared, seen(&solver, &field));
            }
        }
    }

    /// no reasoning beyond one number at a time
    pub(crate) fn nothing_further(_: &mut Solver) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::testing::*;
    use super::*;

    fn solved(rows: &[&str]) -> (Outcome, Vec<String>) {
        let (field, opening) = drawn(rows);
        let mut solver = Solver::new(field.grid());
        let outcome = solver.solve(&field, opening);
        (outcome, seen(&solver, &field))
    }

    #[test]
    fn opens_everything_around_a_cell_with_no_mines_near_it() {
        let (cleared, seen) = played(&["o...", "....", "...."], nothing_further);
        assert!(cleared);
        assert_eq!(seen, ["0000", "0000", "0000"]);
    }

    #[test]
    fn marks_the_cells_around_a_number_that_must_all_be_mines() {
        // the 1 in the corner of the opened patch has one hidden cell beside it
        let (cleared, seen) = played(&["o..", "...", "..*"], nothing_further);
        assert!(cleared);
        assert_eq!(seen, ["000", "011", "01*"]);
    }

    #[test]
    fn opens_the_cells_around_a_number_whose_mines_are_all_found() {
        // The 1 at the top of the third column sees only the mine. Once that is marked, the 1 below it has
        // found its mine and the rest of what is around it is safe, which opens up the far side
        let (cleared, seen) = played(&["o..*.", ".....", "....."], nothing_further);
        assert!(cleared);
        assert_eq!(seen, ["001*1", "00111", "00000"]);
    }

    #[test]
    fn is_stuck_where_only_a_guess_would_do() {
        // one mine in the two cells past the 1s, and nothing to tell them apart
        let (outcome, seen) = solved(&["o..*", "...."]);
        assert_eq!(outcome, Outcome::Stuck);
        assert_eq!(seen, ["001#", "001#"]);
    }

    #[test]
    fn opens_whatever_is_left_once_every_mine_is_found() {
        // The corner is shut in behind the three mines, with no number beside it. But they are all the mines
        // there are, and the numbers find every one of them
        let (outcome, seen) = solved(&["o...", "....", "..**", "..*."]);
        assert_eq!(outcome, Outcome::Cleared);
        assert_eq!(seen, ["0000", "0122", "02**", "02*3"]);
    }

    #[test]
    fn says_how_far_it_got_and_where_it_stopped() {
        let (field, opening) = drawn(&["o..*", "...."]);
        let grid = field.grid();
        let mut solver = Solver::new(grid);
        assert_eq!(solver.solve(&field, opening), Outcome::Stuck);
        assert_eq!(solver.safe_cells_hidden(), 1);
        let stuck: Vec<usize> = solver.stuck_numbers().map(|place| grid.cell_of(place)).collect();
        assert_eq!(stuck.len(), 2);
        assert!(stuck.contains(&2) && stuck.contains(&6));
        assert!(solver.is_open(grid.place_of(2)) && solver.is_hidden(grid.place_of(3)));
        assert!(!solver.is_found_mine(grid.place_of(3)));
    }

    #[test]
    fn counts_the_work_it_does_over_every_board() {
        let (field, opening) = drawn(&["o..*", "...."]);
        let mut solver = Solver::new(field.grid());
        solver.solve(&field, opening);
        let once = solver.work();
        assert!(once >= 8, "at least a step for every cell");
        solver.solve(&field, opening);
        assert_eq!(solver.work(), once * 2);
    }

    #[test]
    fn uses_the_same_working_space_for_one_board_after_another() {
        let (stuck, stuck_opening) = drawn(&["o..*", "...."]);
        let (clear, clear_opening) = drawn(&["o..*", "...*"]);
        let mut solver = Solver::new(stuck.grid());
        for _ in 0..3 {
            assert_eq!(solver.solve(&stuck, stuck_opening), Outcome::Stuck);
            assert_eq!(seen(&solver, &stuck), ["001#", "001#"]);
            assert_eq!(solver.solve(&clear, clear_opening), Outcome::Cleared);
            assert_eq!(seen(&solver, &clear), ["002*", "002*"]);
        }
    }

    #[test]
    fn carries_on_from_where_it_was_when_a_hidden_mine_is_moved() {
        // one mine in the two cells past the 1s, and another somewhere beyond
        let (mut field, opening) = drawn(&["o..*..", ".....*"]);
        let grid = field.grid();
        let mut solver = Solver::new(grid);
        assert_eq!(solver.solve(&field, opening), Outcome::Stuck);
        assert_eq!(seen(&solver, &field), ["001###", "001###"]);

        // from beside the 1s to the far corner, where no number is beside it
        let (from, to) = (grid.place_of(3), grid.place_of(5));
        field.take(from);
        field.put(to);
        solver.mine_moved(from, to);

        assert_eq!(solver.resume(), Outcome::Cleared);
        assert_eq!(seen(&solver, &field), ["00002*", "00002*"]);
    }

    #[test]
    fn forgets_a_mine_it_had_found_when_that_one_is_moved() {
        // The 2s find the two mines beside them, which shut in the last two cells: one of those is a mine, and
        // no number is left to say which
        let (mut field, opening) = drawn(&["o.*.", "..**"]);
        let grid = field.grid();
        let mut solver = Solver::new(grid);
        assert_eq!(solver.solve(&field, opening), Outcome::Stuck);
        assert_eq!(seen(&solver, &field), ["02*#", "02*#"]);

        // one of the found mines goes into the corner, and the cell it was on is there to be uncovered
        let (from, to) = (grid.place_of(2), grid.place_of(3));
        field.take(from);
        field.put(to);
        solver.mine_moved(from, to);
        assert!(solver.is_hidden(from));

        assert_eq!(solver.resume(), Outcome::Cleared);
        // (the numbers are the board's as it is now: the 2s that found the mines have become 1s)
        assert_eq!(seen(&solver, &field), ["013*", "01**"]);
    }
}
