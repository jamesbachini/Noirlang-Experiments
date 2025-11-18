use std::io::{self, Write};

fn main() {
    print!("Enter password: ");
    io::stdout().flush().unwrap();
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
    let input = input.trim();
    let mut bytes = input.as_bytes().to_vec();
    const MAX_LEN: usize = 32;
    if bytes.len() > MAX_LEN {
        bytes.truncate(MAX_LEN);
    } else {
        while bytes.len() < MAX_LEN {
            bytes.push(0u8);
        }
    }
    println!("password = [");
    for (i, b) in bytes.iter().enumerate() {
        if i % 6 == 0 {
            print!("    ");
        }
        print!("{}, ", b);

        if i % 6 == 5 {
            println!();
        }
    }
    println!("\n]");
}
