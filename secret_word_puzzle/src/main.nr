// Secret Word Puzzle

use std::hash::blake2s;
global WORD_LEN: u32 = 16;

fn main(secret_word: [u8; WORD_LEN], expected_hash: pub [u8; 32]) {
    let computed = blake2s(secret_word);
    assert(computed == expected_hash);
}

#[test]
fn test_correct_word() {
    let word: [u8; WORD_LEN] = [
        115u8, 101u8, 99u8, 114u8, 101u8, 116u8, // secret
        0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8, 0u8,
    ];
    let expected = blake2s(word);
    main(word, expected);
}
