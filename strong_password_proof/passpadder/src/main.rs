use std::io::{self, Write};

fn main() {
    // Ask user
    print!("Enter password: ");
    io::stdout().flush().unwrap(); // make sure prompt prints

    // Read input
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();

    // Strip newline
    let input = input.trim();

    // Convert to bytes
    let mut bytes = input.as_bytes().to_vec();

    // Pad or truncate to 32 bytes
    const MAX_LEN: usize = 32;
    if bytes.len() > MAX_LEN {
        bytes.truncate(MAX_LEN);
    } else {
        while bytes.len() < MAX_LEN {
            bytes.push(0u8);
        }
    }

    // Output TOML format
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
