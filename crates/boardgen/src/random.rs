//! Random numbers that can be had again: the same seed gives the same numbers every time, wherever this runs.
//!
//! The generator is xoshiro128** (Blackman and Vigna): nothing but 32-bit whole-number arithmetic, so there is no
//! platform it comes out differently on. It is written out here rather than taken from a crate because a board is
//! its seed: the exact numbers drawn, and the order they are drawn in, are part of what this crate promises.
//!
//! A seed is 128 bits, and a game's seed comes from a source nobody can predict. That matters for more than
//! tidiness: a seed that could be guessed, or tried one after another until the opening matches, would be a way to
//! see every mine.

/// How long a seed is
pub const SEED_BYTES: usize = 16;

/// What a board is made from
pub type Seed = [u8; SEED_BYTES];

/// A stream of random numbers
#[derive(Clone, Debug)]
pub struct Random {
    state: [u32; 4],
}

impl Random {
    /// The stream a seed gives: its bytes are read as four 32-bit words, lowest byte first.
    ///
    /// There is none for a seed of all zeroes, the one state the generator never leaves.
    pub fn from_seed(seed: &Seed) -> Option<Self> {
        let word = |at: usize| u32::from_le_bytes([seed[at], seed[at + 1], seed[at + 2], seed[at + 3]]);
        let state = [word(0), word(4), word(8), word(12)];
        (state != [0; 4]).then_some(Self { state })
    }

    /// The next number: any 32-bit one
    pub fn next_u32(&mut self) -> u32 {
        let [a, b, c, d] = &mut self.state;
        let result = b.wrapping_mul(5).rotate_left(7).wrapping_mul(9);
        let shifted = *b << 9;
        *c ^= *a;
        *d ^= *b;
        *b ^= *c;
        *a ^= *d;
        *c ^= shifted;
        *d = d.rotate_left(11);
        result
    }

    /// A whole number from 0 up to (not including) `bound`: the top bits of the next number times the bound.
    ///
    /// Not perfectly even: some answers are likelier than others by one part in 2^32 / bound, which for the cells
    /// of a board is nothing.
    pub fn below(&mut self, bound: usize) -> usize {
        debug_assert!(bound > 0 && u32::try_from(bound).is_ok(), "can't pick a number below {bound}");
        ((u64::from(self.next_u32()) * bound as u64) >> 32) as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// sixteen bytes counting up from `first`
    fn seed_from(first: u8) -> Seed {
        std::array::from_fn(|at| first.wrapping_add(at as u8))
    }

    #[test]
    fn gives_the_numbers_the_reference_implementation_gives() {
        // the state [1, 2, 3, 4], as the authors' own code and Rust's `rand_xoshiro` are tested with
        let mut random = Random::from_seed(&[1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4, 0, 0, 0]).unwrap();
        let expected: [u32; 10] =
            [11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804];
        assert_eq!(expected.map(|_| random.next_u32()), expected);
    }

    #[test]
    fn gives_the_same_numbers_for_the_same_seed_and_others_for_another() {
        let numbers = |first| {
            let mut random = Random::from_seed(&seed_from(first)).unwrap();
            std::iter::repeat_with(|| random.next_u32()).take(50).collect::<Vec<_>>()
        };
        assert_eq!(numbers(7), numbers(7));
        assert_ne!(numbers(7), numbers(8));
    }

    #[test]
    fn has_no_stream_for_a_seed_of_all_zeroes() {
        assert!(Random::from_seed(&[0; SEED_BYTES]).is_none());
        assert!(Random::from_seed(&seed_from(0)).is_some());
    }

    #[test]
    fn picks_below_a_bound_from_the_top_bits() {
        let stuck_on = |word: u32| Random { state: [0, word, 0, 0] };
        // what the next number is for a state with only its second word set: that word * 5, rotated, * 9
        let next_of = |word: u32| word.wrapping_mul(5).rotate_left(7).wrapping_mul(9);
        for word in [1, 77, 0x1234_5678, u32::MAX] {
            let expected = ((u64::from(next_of(word)) * 10) >> 32) as usize;
            assert_eq!(stuck_on(word).below(10), expected);
        }
    }

    #[test]
    fn stays_below_the_bound_and_reaches_all_of_it() {
        let mut random = Random::from_seed(&seed_from(1)).unwrap();
        let mut seen = [false; 7];
        for _ in 0..500 {
            seen[random.below(7)] = true;
        }
        assert_eq!(seen, [true; 7]);
        assert_eq!(random.below(1), 0);
    }
}
