// Private Limit Orders

fn main(my_limit_price: u64, market_price: pub u64) {
    assert(my_limit_price > market_price);
}


#[test]
fn test_valid_limit() {
    main(95000u64, 93000u64);
}
