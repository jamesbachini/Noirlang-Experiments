# Noirlang Experiments

Full tutorial here: https://jamesbachini.com/noir-on-stellar/?dpl_token=94e608d9-2c24-488f-af74-315ddbb7f0a1

### Private Limit Orders • Secret Word Puzzle • Strong Password Proofs

This repo contains three practical **Noir** circuits illustrating core ZK techniques: comparisons, hashing, commitments, byte checks, array iteration, and constraint design.

Each circuit is self-contained and designed to be compiled using nargo, Noirlang's compiler.

These examples serve as a starter toolkit for building zkApps that later verify proofs via Soroban smart contracts on Stellar.

---

## 🧩 1. Private Limit Orders

**Goal:**
Prove that a trader’s *private* limit price is greater than a *public* market price without revealing the private number.

**Why it matters:**
This pattern appears in sealed-bid auctions, private RFQs, dark-pool trading, and anywhere you want to commit to a price without exposing your strategy.

**Circuit summary:**

* Inputs:

  * `my_limit_price` (private `u64`)
  * `market_price` (public `u64`)
* Constraint:
  `my_limit_price > market_price`

---

## 🔐 2. Secret Word Puzzle

**Goal:**
Prove that you know a secret word without revealing it by hashing the private word and comparing it to a *public* expected hash.

**Why it matters:**
This is the core pattern behind:

* zk login
* password-less authentication
* fair online puzzles
* commit–reveal schemes
* secret phrases & access codes

**Circuit summary:**

* Private input: `secret_word` (`[u8; 16]`)
* Public input: `expected_hash` (`[u8; 32]`)
* Constraint:
  `blake2s(secret_word) == expected_hash`

We include a companion Rust script that pads the secret word to 16 bytes and computes the correct BLAKE2s hash compatible with Noir.

---

## 🔒 3. Prove a Strong Password

**Goal:**
Prove that a private password satisfies a strength policy:

* At least **12 characters**
* Contains **one uppercase**, **one lowercase**, **one digit**
* Zero padded to length 32

**Why it matters:**
This is the type of proof a browser or client device could generate to show a server:

> “My password is strong”
> **without sending the password**.

Useful for:

* Private signup flows
* Zero-knowledge identity attributes
* Client-side password proofs
* Regulatory compliance with no data exposure

**Circuit summary:**

* Private input: `password: [u8; 32]`
* Constraints:

  * Count non-zero bytes → ≥ 12
  * Check ranges:

    * `'A'..'Z'`
    * `'a'..'z'`
    * `'0'..'9'`


A Rust helper script is included that converts a password to a padded 32 byte array ready for the Prover.toml file


---

# 🚀 Using Nargo v1.0.0

All circuits follow the same workflow.

## 1. Install Noir + Nargo

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
```

Verify:

```bash
nargo --version
```

---

## 2. Run a circuit

Inside any project folder:

```bash
nargo check
```

Execute with inputs from `Prover.toml`:

```bash
nargo execute
```

This produces a witness file (`target/<name>.gz`) you can use with a proving backend.

---

## 3. Compile to ACIR

```bash
nargo compile
```

This generates:

```
target/<circuit>.json
target/acir/<circuit>.acir
```

These artifacts are used by proving tools such as:

* barretenberg (CLI)
* noir_js (web / node)
* Nethermind zkVM (Soroban-compatible)

---

# 📁 Input Files (Prover.toml / Verifier.toml)

### Nargo v1 Input Rules

* Inputs live in `Prover.toml`
* Values must be **top-level keys**
* Arrays must contain **pure integers**
* Public inputs go into `Verifier.toml` (only if using public inputs)

---

# Example Usage: Secret Word Puzzle

Use the script in secret_word_puzzle/hashgen to create a secret word and public hash byte array.

```bash
cd hashgen
cargo run
   Compiling hashgen v0.1.0 (/mnt/c/code/Noirlang-Experiments/secret_word_puzzle/hashgen)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.24s
     Running `target/debug/hashgen`
Enter secret word: Noir is great

secret_word = [
    78, 111, 105, 114, 32, 105, 115, 32,
    103, 114, 101, 97, 116, 0, 0, 0,
]

expected_hash = [
    163, 112, 244, 86, 6, 192, 75, 239,
    72, 217, 69, 150, 167, 82, 199, 49,
    112, 125, 44, 60, 159, 239, 164, 189,
    73, 182, 148, 150, 138, 75, 220, 17,
]
```

`Prover.toml`:

```toml
secret_word = [
    78, 111, 105, 114, 32, 105, 115, 32,
    103, 114, 101, 97, 116, 0, 0, 0,
]

expected_hash = [
    163, 112, 244, 86, 6, 192, 75, 239,
    72, 217, 69, 150, 167, 82, 199, 49,
    112, 125, 44, 60, 159, 239, 164, 189,
    73, 182, 148, 150, 138, 75, 220, 17,
]
```

`Verifier.toml` (public inputs only):

```toml
expected_hash = [
    163, 112, 244, 86, 6, 192, 75, 239,
    72, 217, 69, 150, 167, 82, 199, 49,
    112, 125, 44, 60, 159, 239, 164, 189,
    73, 182, 148, 150, 138, 75, 220, 17,
]
```

```bash
cd ..
nargo compile
nargo execute
[secret_word_puzzle] Circuit witness successfully solved
[secret_word_puzzle] Witness saved to target/secret_word_puzzle.gz
```

## Noir > bb.js > UltraHonk > Soroban Attempts

```bash
cd /mnt/c/code/Noirlang-Experiments/private_limit_orders

# 1) Build circuit + witness
npm i -D @aztec/bb.js@0.87.0 source-map-support
nargo compile
nargo execute

# 2) Generate UltraHonk (keccak) VK + proof
node ./node_modules/@aztec/bb.js/dest/node/main.js write_vk_ultra_keccak_honk \
  -b ./target/private_limit_orders.json \
  -o ./target/vk.keccak

node ./node_modules/@aztec/bb.js/dest/node/main.js prove_ultra_keccak_honk \
  -b ./target/private_limit_orders.json \
  -w ./target/private_limit_orders.gz \
  -o ./target/proof.with_public_inputs

# 3) Split bb.js proof into:
#    - target/public_inputs (first N public fields, 32 bytes each)
#    - target/proof         (remaining bytes, expected by verify_proof)
PUB_COUNT=$(node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("target/private_limit_orders.json","utf8")); process.stdout.write(String((j.abi?.parameters||[]).filter(p=>p.visibility==="public").length));')
PUB_BYTES=$((PUB_COUNT * 32))
head -c "$PUB_BYTES" target/proof.with_public_inputs > target/public_inputs
tail -c +$((PUB_BYTES + 1)) target/proof.with_public_inputs > target/proof
cp target/vk.keccak target/vk

# Optional sanity check: should print 100 in big-endian
python3 - <<'PY'
import pathlib
b = pathlib.Path("target/public_inputs").read_bytes()
print("public_inputs_len:", len(b))
print("public_input_be:", int.from_bytes(b, "big"))
PY

cd ../ultrahonk_soroban_contract

# 4) Build + deploy contract with VK bytes
stellar contract build --optimize
CID=$(stellar contract deploy \
  --source-account james \
  --wasm target/wasm32v1-none/release/ultrahonk_soroban_contract.wasm \
  --network testnet \
  -- \
  --vk_bytes-file-path ../private_limit_orders/target/vk | tail -n1)
echo "$CID"

# 5) Verify proof with raw byte files (not hex strings)
stellar contract invoke \
  --source-account james \
  --id "$CID" \
  --network testnet \
  --send no \
  -- \
  verify_proof \
  --public_inputs-file-path ../private_limit_orders/target/public_inputs \
  --proof_bytes-file-path ../private_limit_orders/target/proof


## Gives ERRORS
❌ error: transaction submission failed: TxSorobanInvalid

Changing --send no works and returns null as you'd expect from a Result<(), Error> but meh.

```



Notes:
- Use `*_ultra_keccak_honk` commands, not `*_ultra_honk`.
- `public_inputs` are 32-byte big-endian field values from bb.js output. Do not hand-encode little-endian values.
- Contract args are `Bytes`; pass files via `--*-file-path` flags.
- On testnet, `--send yes` may fail for this heavy call with `TxSorobanInvalid`; `--send no` still executes simulation and confirms verification.



---
## License

MIT
