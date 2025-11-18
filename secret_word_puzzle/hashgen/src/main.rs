use blake2s_simd::Params;
use std::io::{self, Write};

const WORD_LEN: usize = 16;

fn main() {
    print!("Enter secret word: ");
    io::stdout().flush().unwrap();
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
    let word = input.trim();
    let mut bytes = word.as_bytes().to_vec();
    if bytes.len() > WORD_LEN {
        bytes.truncate(WORD_LEN);
    } else {
        while bytes.len() < WORD_LEN {
            bytes.push(0u8);
        }
    }
    let hash = Params::new().hash(&bytes);
    let hash_bytes = hash.as_bytes();
    println!("\nsecret_word = [");
    for (i, b) in bytes.iter().enumerate() {
        if i % 8 == 0 {
            print!("    ");
        }
        print!("{}, ", b);
        if i % 8 == 7 {
            println!();
        }
    }
    println!("]\n");
    println!("expected_hash = [");
    for (i, b) in hash_bytes.iter().enumerate() {
        if i % 8 == 0 {
            print!("    ");
        }
        print!("{}, ", b);
        if i % 8 == 7 {
            println!();
        }
    }
    println!("]");
}
