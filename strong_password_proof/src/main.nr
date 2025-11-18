// Strong Password Checker - 12 chars or more, contains uppercase, lowercase and numeric values

global PASSWORD_MAX_LEN: u32 = 32;
global MIN_LENGTH: u32 = 12;

fn main(password: [u8; PASSWORD_MAX_LEN]) {
    let mut length: u32 = 0u32;
    let mut has_upper = false;
    let mut has_lower = false;
    let mut has_digit = false;
    for i in 0u32..PASSWORD_MAX_LEN {
        let ch = password[i];
        let is_non_zero = ch != 0u8;
        if is_non_zero {
            length = length + 1u32;
        }
        if is_uppercase(ch) {
            has_upper = true;
        }
        if is_lowercase(ch) {
            has_lower = true;
        }
        if is_digit(ch) {
            has_digit = true;
        }
    }
    assert(length >= MIN_LENGTH);
    assert(has_upper);
    assert(has_lower);
    assert(has_digit);
}

fn is_uppercase(c: u8) -> bool {
    c >= 65u8 & c <= 90u8
}

fn is_lowercase(c: u8) -> bool {
    c >= 97u8 & c <= 122u8
}

fn is_digit(c: u8) -> bool {
    c >= 48u8 & c <= 57u8
}

// ---------- Tests ----------

fn pad_password(bytes: [u8; MIN_LENGTH]) -> [u8; PASSWORD_MAX_LEN] {   
    let mut out: [u8; PASSWORD_MAX_LEN] = [0u8; PASSWORD_MAX_LEN];
    for i in 0u32..MIN_LENGTH {
        out[i] = bytes[i];
    }
    out
}

#[test]
fn test_strong_password() {
    let base: [u8; MIN_LENGTH] = [
        65u8,  // 'A' uppercase
        98u8,  // 'b' lowercase
        99u8,  // 'c'
        100u8, // 'd'
        101u8, // 'e'
        102u8, // 'f'
        49u8,  // '1'
        50u8,  // '2'
        51u8,  // '3'
        52u8,  // '4'
        53u8,  // '5'
        54u8,  // '6'
    ];

    let pwd = pad_password(base);
    main(pwd); // should succeed
}
