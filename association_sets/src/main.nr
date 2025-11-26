// main.nr
// Simple Association Set + View Key

use dep::std::hash::pedersen_hash;

fn compute_assoc_set_hash(sender_id: Field, receiver_id: Field) -> Field {
    pedersen_hash([sender_id, receiver_id])
}

fn compute_tx_commitment(
    sender_id: Field,
    receiver_id: Field,
    amount: u64,
    view_key: Field,
) -> Field {
    let amount_field: Field = amount as Field;
    pedersen_hash([sender_id, receiver_id, amount_field, view_key])
}

fn main(
    assoc_set_hash: pub Field,
    max_tx_amount: pub u64,
    tx_commitment: pub Field,
    sender_id: Field,
    receiver_id: Field,
    amount: u64,
    view_key: Field,
) {
    // 1. Prove that this transaction happens inside the declared Association Set.
    let computed_set_hash = compute_assoc_set_hash(sender_id, receiver_id);
    assert(computed_set_hash == assoc_set_hash);

    // 2. Enforce a public compliance rule on the private amount.
    assert(amount <= max_tx_amount);

    // 3. Tie the private details and view key to a public commitment.
    let computed_commitment = compute_tx_commitment(sender_id, receiver_id, amount, view_key);
    assert(computed_commitment == tx_commitment);
}

#[test]
fn test_tx() {
    let max_tx_amount: u64 = 10_000;
    let sender_id: Field = 99;
    let receiver_id: Field = 123;
    let amount: u64 = 10_000;
    let view_key: Field = 777;
    let assoc_set_hash = compute_assoc_set_hash(sender_id, receiver_id);
    let tx_commitment = compute_tx_commitment(sender_id, receiver_id, amount, view_key);
    main(
        assoc_set_hash,
        max_tx_amount,
        tx_commitment,
        sender_id,
        receiver_id,
        amount,
        view_key,
    );
}
