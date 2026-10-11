//! Every way the mines could lie.
//!
//! The hidden cells beside the numbers fall into regions: groups tied together by the numbers they share, with
//! nothing to connect one group to another but the count of mines left on the board. Each region is small enough,
//! as a rule, to try every way of putting mines in it that fits its numbers.
//!
//! A cell that is a mine in none of those ways is safe, and one that is a mine in all of them is a mine. The count
//! of mines rules some ways out as well: the regions between them, and the hidden cells no number is beside, have
//! to hold exactly the mines that are left. So for each region the ways are sorted by how many mines they use, and
//! a way only counts if the rest of the board could hold what it leaves over.
//!
//! This is all there is to know: whatever isn't settled here can't be, short of a guess. But it is only looked into
//! so far. A region too big to search, or one that takes too long, is passed over as if anything might be true of
//! it, which can only leave the solver knowing less.

use std::ops::Range;

use super::{Cell, Solver};
use crate::grid::Grid;

/// The most cells a region can have and be searched: its cells are a bit each
const REGION_CELLS_MAX: usize = u64::BITS as usize;

/// How many steps the search of one region may take before it is given up on. Regions that need more than this
/// rarely settle anything, and searching them is most of what a board that can't be cleared would otherwise cost
const SEARCH_STEPS_MAX: u32 = 4096;

/// The most mines the count is reasoned about for: sets of counts are a bit each. With more than this still to be
/// found the count is left out of it, which costs next to nothing: it only ever matters near the end of a board
const COUNTED_MINES_MAX: usize = u128::BITS as usize - 1;

/// A number, as its region sees it
#[derive(Debug)]
struct Number {
    /// which of the region's cells are around it
    cells: u64,
    /// how many of them are mines
    mines: u32,
}

/// What was learnt about the ways to put a given count of mines in a region
#[derive(Clone, Copy, Default, Debug)]
struct Tally {
    /// the cells that are a mine in at least one of them
    mine: u64,
    /// the cells that are safe in at least one of them
    safe: u64,
}

#[derive(Debug)]
struct Region {
    /// where its hidden cells, its numbers and its tallies (one for each count of mines, from none) are in the
    /// workspace
    cells: Range<usize>,
    numbers: Range<usize>,
    /// empty for a region that wasn't searched through
    tallies: Range<usize>,
    /// the counts of mines it could hold
    totals: u128,
}

/// Working space, kept from one pass to the next
#[derive(Default, Debug)]
pub(super) struct Workspace {
    /// Which pass this is. A place was `seen` in this pass if it is marked with this number
    pass: u32,
    seen: Vec<u32>,
    /// by place, for a hidden cell seen in this pass: which cell of its region it is
    slot: Vec<u8>,
    cells: Vec<usize>,
    numbers: Vec<Number>,
    tallies: Vec<Tally>,
    regions: Vec<Region>,
    /// numbers still to be gone through while a region is being gathered
    pending: Vec<usize>,
    /// by region: the counts of mines all the regions before it, and all those after it, could hold between them
    before: Vec<u128>,
    after: Vec<u128>,
}

impl Workspace {
    pub(super) fn new(grid: Grid) -> Self {
        Self { seen: vec![0; grid.places()], slot: vec![0; grid.places()], ..Self::default() }
    }

    fn begin_pass(&mut self) {
        if self.pass == u32::MAX {
            self.seen.fill(0);
            self.pass = 0;
        }
        self.pass += 1;
        self.cells.clear();
        self.numbers.clear();
        self.tallies.clear();
        self.regions.clear();
    }
}

impl Solver {
    /// Works out everything the numbers and the count of mines can tell. Returns whether anything came of it
    pub(super) fn exact(&mut self) -> bool {
        self.gather_regions();
        self.search_regions();
        self.conclude_from_regions()
    }

    /// Sorts the hidden cells beside numbers into regions
    fn gather_regions(&mut self) {
        let space = &mut self.exact;
        space.begin_pass();
        for &start in &self.numbers {
            if self.hidden_around[start] == 0 || space.seen[start] == space.pass {
                continue;
            }
            let (first_cell, first_number) = (space.cells.len(), space.numbers.len());
            space.seen[start] = space.pass;
            space.pending.push(start);
            while let Some(number) = space.pending.pop() {
                let mut around = 0;
                for cell in self.grid.around(number) {
                    if self.cells[cell] != Cell::Hidden {
                        continue;
                    }
                    if space.seen[cell] != space.pass {
                        space.seen[cell] = space.pass;
                        // a cell too far down the list to have a bit of its own: the region is too big to search
                        space.slot[cell] = (space.cells.len() - first_cell).min(REGION_CELLS_MAX) as u8;
                        space.cells.push(cell);
                        for other in self.grid.around(cell) {
                            if self.cells[other] == Cell::Open && space.seen[other] != space.pass {
                                space.seen[other] = space.pass;
                                space.pending.push(other);
                            }
                        }
                    }
                    around |= 1u64.checked_shl(space.slot[cell].into()).unwrap_or(0);
                }
                space.numbers.push(Number { cells: around, mines: self.due[number].into() });
            }
            space.regions.push(Region {
                cells: first_cell..space.cells.len(),
                numbers: first_number..space.numbers.len(),
                tallies: 0..0,
                totals: 0,
            });
        }
        self.work += space.cells.len() as u64;
    }

    /// Finds, for each region, the ways its mines could lie
    fn search_regions(&mut self) {
        let space = &mut self.exact;
        for region in &mut space.regions {
            let size = region.cells.len();
            // until the search says otherwise, the region could hold any count of mines at all
            region.totals = up_to(size);
            if size > REGION_CELLS_MAX {
                continue;
            }
            let first_tally = space.tallies.len();
            space.tallies.resize(first_tally + size + 1, Tally::default());
            let mut search =
                Search::new(&space.numbers[region.numbers.clone()], size, &mut space.tallies[first_tally..]);
            let finished = search.place(0, 0);
            self.work += u64::from(SEARCH_STEPS_MAX - search.steps_left);
            if finished {
                region.totals = search.totals;
                region.tallies = first_tally..space.tallies.len();
            } else {
                space.tallies.truncate(first_tally);
            }
        }
    }

    /// Settles every cell that is the same in all the ways found
    fn conclude_from_regions(&mut self) -> bool {
        // taken out so that cells can be opened while it is read from, and put back at the end
        let mut space = std::mem::take(&mut self.exact);
        // how many mines are left to place, and how many hidden cells no number is beside
        let left = self.unfound;
        let loose = self.hidden - space.cells.len();
        let counted = left <= COUNTED_MINES_MAX;
        if counted {
            sum_around_each(&space.regions, left, &mut space.before, &mut space.after);
        }

        let mut found = false;
        for (at, region) in space.regions.iter().enumerate() {
            if region.tallies.is_empty() {
                continue;
            }
            // what the other regions could hold between them
            let elsewhere = if counted { sums(space.before[at], space.after[at + 1]) } else { 0 };
            let (mut could_be_mine, mut could_be_safe) = (0, 0);
            for (total, tally) in space.tallies[region.tallies.clone()].iter().enumerate() {
                let found_a_way = region.totals >> total & 1 == 1;
                // the other regions and the loose cells must be able to hold exactly the mines this leaves over
                let rest_fits = !counted || total <= left && elsewhere & between(left - total, loose) != 0;
                if found_a_way && rest_fits {
                    could_be_mine |= tally.mine;
                    could_be_safe |= tally.safe;
                }
            }
            debug_assert!(could_be_mine | could_be_safe != 0, "no way left to lay a region's mines");
            for (slot, &cell) in space.cells[region.cells.clone()].iter().enumerate() {
                let (mine, safe) = (could_be_mine >> slot & 1 == 1, could_be_safe >> slot & 1 == 1);
                if mine != safe {
                    self.conclude(cell, mine);
                    found = true;
                }
            }
        }

        if counted && loose > 0 {
            // The mines the regions could hold between them, given that the loose cells must take the rest. If
            // that can only be all the mines left, the loose cells are safe; if it can only be so few that the
            // loose cells are needed to the last one, they are all mines
            let in_regions = space.before[space.regions.len()] & between(left, loose);
            let all_safe = in_regions == 1 << left;
            let all_mines = left >= loose && in_regions == 1 << (left - loose);
            if all_safe || all_mines {
                for place in self.grid.board() {
                    if self.cells[place] == Cell::Hidden && space.seen[place] != space.pass {
                        self.conclude(place, all_mines);
                    }
                }
                found = true;
            }
        }
        self.exact = space;
        found
    }
}

/// The counts from 0 to `most`, as a set
fn up_to(most: usize) -> u128 {
    if most >= COUNTED_MINES_MAX { u128::MAX } else { (1 << (most + 1)) - 1 }
}

/// The counts that leave between none and `room` to spare below `most`: from `most - room` (or 0) to `most`
fn between(most: usize, room: usize) -> u128 {
    match most.saturating_sub(room) {
        0 => up_to(most),
        least => up_to(most) & !up_to(least - 1),
    }
}

/// Every count that is one from `a` added to one from `b`. (Counts too big for a set are dropped: they are more
/// mines than there are left)
fn sums(a: u128, b: u128) -> u128 {
    let (mut all, mut rest) = (0, a);
    while rest != 0 {
        all |= b << rest.trailing_zeros();
        rest &= rest - 1;
    }
    all
}

/// For each region, the counts of mines that the regions before it could hold between them, and the regions after
/// it; no more than `left` in either case. (`before` of one past the last region is all of them together)
fn sum_around_each(regions: &[Region], left: usize, before: &mut Vec<u128>, after: &mut Vec<u128>) {
    let within = up_to(left);
    before.clear();
    before.push(1);
    for region in regions {
        before.push(sums(before[before.len() - 1], region.totals) & within);
    }
    after.clear();
    after.resize(regions.len() + 1, 1);
    for (at, region) in regions.iter().enumerate().rev() {
        after[at] = sums(after[at + 1], region.totals) & within;
    }
}

/// A search through the ways of laying one region's mines, a cell at a time
struct Search<'a> {
    numbers: &'a [Number],
    /// by cell: which numbers it is beside, and how many
    beside: [[u16; 8]; REGION_CELLS_MAX],
    beside_count: [u8; REGION_CELLS_MAX],
    size: usize,
    /// by count of mines: what the ways found so far have in common
    tallies: &'a mut [Tally],
    totals: u128,
    steps_left: u32,
}

impl<'a> Search<'a> {
    fn new(numbers: &'a [Number], size: usize, tallies: &'a mut [Tally]) -> Self {
        let mut search = Self {
            numbers,
            beside: [[0; 8]; REGION_CELLS_MAX],
            beside_count: [0; REGION_CELLS_MAX],
            size,
            tallies,
            totals: 0,
            steps_left: SEARCH_STEPS_MAX,
        };
        for (at, number) in numbers.iter().enumerate() {
            let mut cells = number.cells;
            while cells != 0 {
                let cell = cells.trailing_zeros() as usize;
                search.beside[cell][usize::from(search.beside_count[cell])] = at as u16;
                search.beside_count[cell] += 1;
                cells &= cells - 1;
            }
        }
        search
    }

    /// Decides the cells from `cell` on, both ways, given the `mines` among the cells before it.
    /// Returns false if it ran out of steps
    fn place(&mut self, cell: usize, mines: u64) -> bool {
        if cell == self.size {
            let all = u64::MAX >> (REGION_CELLS_MAX - self.size);
            let tally = &mut self.tallies[mines.count_ones() as usize];
            tally.mine |= mines;
            tally.safe |= !mines & all;
            self.totals |= 1 << mines.count_ones();
            return true;
        }
        for mine in [0, 1] {
            if self.steps_left == 0 {
                return false;
            }
            self.steps_left -= 1;
            let mines = mines | mine << cell;
            if self.fits(cell, mines) && !self.place(cell + 1, mines) {
                return false;
            }
        }
        true
    }

    /// Whether every number beside a cell can still come out right, with the cells up to it decided
    fn fits(&self, cell: usize, mines: u64) -> bool {
        let undecided = u64::MAX.checked_shl(cell as u32 + 1).unwrap_or(0);
        self.beside[cell][..usize::from(self.beside_count[cell])].iter().all(|&at| {
            let number = &self.numbers[usize::from(at)];
            let placed = (number.cells & mines).count_ones();
            let open = (number.cells & undecided).count_ones();
            placed <= number.mines && placed + open >= number.mines
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::solver::testing::played;

    #[test]
    fn settles_what_takes_more_than_two_numbers_to_see() {
        // The 2 in the corner of the opened patch has a 1 on either side of it. Each 1 has its mine among two
        // cells that the 2 is beside as well, which accounts for both of the 2's mines: the fifth cell the 2 is
        // beside, diagonally across from the opening, is safe. No two of the three numbers say so between them
        let board = ["o.*", "...", "*.."];
        let (cleared, seen) = played(&board, Solver::pairs);
        assert!(!cleared);
        assert_eq!(seen, ["01#", "12#", "###"]);

        let (cleared, seen) = played(&board, Solver::exact);
        assert!(cleared);
        assert_eq!(seen, ["01*", "121", "*10"]);
    }

    #[test]
    fn rules_out_the_ways_that_would_take_more_mines_than_there_are() {
        // What is left at the end is four cells in the corner and one mine. By the numbers alone the mine could
        // be the cell they all see, or else two other cells could both be mines: but two is one too many
        let board = ["o....", "..*..", "...*.", "..*.."];
        let (cleared, seen) = played(&board, Solver::pairs);
        assert!(!cleared);
        assert_eq!(seen, ["01110", "01*21", "023##", "01*##"]);

        let (cleared, seen) = played(&board, Solver::exact);
        assert!(cleared);
        assert_eq!(seen, ["01110", "01*21", "023*1", "01*21"]);
    }

    #[test]
    fn opens_the_cells_no_number_is_beside_when_the_mines_are_all_spoken_for() {
        // One mine, and it is one of the two cells past the 1s. Which of them can't be known, but the cells
        // beyond them can: there is no mine left over for them
        let (cleared, seen) = played(&["o..*.", "....."], Solver::exact);
        assert!(!cleared);
        assert_eq!(seen, ["001#1", "001#1"]);
    }

    #[test]
    fn marks_the_cells_no_number_is_beside_when_they_must_take_every_mine_left() {
        // three mines: one for the two cells past the 1s, which leaves two for the two cells beyond
        let (cleared, seen) = played(&["o..**", "....*"], Solver::exact);
        assert!(!cleared);
        assert_eq!(seen, ["001#*", "001#*"]);
    }

    #[test]
    fn says_nothing_of_cells_that_could_go_either_way() {
        // two mines for the two cells past the 1s and the two beyond: one each, or... nothing here is certain
        let (cleared, seen) = played(&["o..*.", "....*"], Solver::exact);
        assert!(!cleared);
        assert_eq!(seen, ["001##", "001##"]);
    }

    fn set(counts: &[usize]) -> u128 {
        counts.iter().fold(0, |all, &count| all | 1 << count)
    }

    #[test]
    fn makes_sets_of_counts() {
        assert_eq!(up_to(0), set(&[0]));
        assert_eq!(up_to(3), set(&[0, 1, 2, 3]));
        assert_eq!(up_to(127), u128::MAX);
        assert_eq!(up_to(5000), u128::MAX);
        assert_eq!(between(5, 2), set(&[3, 4, 5]));
        assert_eq!(between(5, 0), set(&[5]));
        assert_eq!(between(2, 9), set(&[0, 1, 2]));
        assert_eq!(between(0, 0), set(&[0]));
    }

    #[test]
    fn adds_every_count_of_one_set_to_every_count_of_another() {
        assert_eq!(sums(set(&[0]), set(&[2, 5])), set(&[2, 5]));
        assert_eq!(sums(set(&[1, 2]), set(&[0, 3])), set(&[1, 2, 4, 5]));
        assert_eq!(sums(0, set(&[1])), 0);
        // what doesn't fit in a set is dropped
        assert_eq!(sums(set(&[127]), set(&[0, 1])), set(&[127]));
    }

    #[test]
    fn sums_the_regions_on_either_side_of_each() {
        let region = |totals: &[usize]| Region { cells: 0..0, numbers: 0..0, tallies: 0..0, totals: set(totals) };
        let regions = [region(&[1]), region(&[0, 2]), region(&[3])];
        let (mut before, mut after) = (Vec::new(), Vec::new());
        sum_around_each(&regions, 5, &mut before, &mut after);
        assert_eq!(before, [set(&[0]), set(&[1]), set(&[1, 3]), set(&[4])]);
        assert_eq!(after, [set(&[4]), set(&[3, 5]), set(&[3]), set(&[0])]);
    }

    /// The ways to lay mines on `size` cells that fit the numbers, sorted by how many mines they use
    fn ways(numbers: &[Number], size: usize) -> (bool, u128, Vec<Tally>) {
        let mut tallies = vec![Tally::default(); size + 1];
        let mut search = Search::new(numbers, size, &mut tallies);
        let finished = search.place(0, 0);
        let totals = search.totals;
        (finished, totals, tallies)
    }

    #[test]
    fn finds_every_way_that_fits_the_numbers() {
        // three cells in a row, a 1 over the first two and a 1 over the last two: the middle one alone, or both ends
        let numbers = [Number { cells: 0b011, mines: 1 }, Number { cells: 0b110, mines: 1 }];
        let (finished, totals, tallies) = ways(&numbers, 3);
        assert!(finished);
        assert_eq!(totals, set(&[1, 2]));
        assert_eq!((tallies[1].mine, tallies[1].safe), (0b010, 0b101));
        assert_eq!((tallies[2].mine, tallies[2].safe), (0b101, 0b010));
        assert_eq!((tallies[0].mine, tallies[3].mine), (0, 0));
    }

    #[test]
    fn finds_none_where_the_numbers_can_not_all_be_right() {
        let numbers = [Number { cells: 0b11, mines: 2 }, Number { cells: 0b01, mines: 0 }];
        let (finished, totals, _) = ways(&numbers, 2);
        assert!(finished);
        assert_eq!(totals, 0);
    }

    #[test]
    fn searches_a_region_with_a_bit_for_every_cell_it_can_have() {
        // sixty-four cells in a row, each pair of neighbours with one mine between them: the odd cells or the even
        let numbers: Vec<Number> = (0..63).map(|at| Number { cells: 0b11 << at, mines: 1 }).collect();
        let (finished, totals, tallies) = ways(&numbers, REGION_CELLS_MAX);
        assert!(finished);
        assert_eq!(totals, set(&[32]));
        assert_eq!(tallies[32].mine, u64::MAX);
        assert_eq!(tallies[32].safe, u64::MAX);
    }

    #[test]
    fn gives_up_on_a_region_with_too_many_ways() {
        // forty cells with nothing known but that half of them are mines
        let numbers = [Number { cells: (1 << 40) - 1, mines: 20 }];
        let (finished, _, _) = ways(&numbers, 40);
        assert!(!finished);
    }
}
