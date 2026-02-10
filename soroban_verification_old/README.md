# Soroban UltraHonk Proof Verification

## WORK IN PROGRESS - DO NOT USE!

## WORK IN PROGRESS - DO NOT USE!

## WORK IN PROGRESS - DO NOT USE!

The `soroban_verification` crate exposes a single Soroban contract that consumes the raw
`vk_fields.json`, `proof`, and `public_inputs` artifacts emitted by `bb` (barretenberg)
and verifies the proof inside a Soroban transaction using the `ultrahonk_rust_verifier`
library.

The public entrypoint is:

```
pub fn verify(env: Env, vk_json: Bytes, proof: Bytes, public_inputs: Bytes) -> bool
```

- `vk_json` – raw bytes of the `vk_fields.json` file produced by `bb write_vk`
- `proof` – raw proof bytes produced by `bb prove`
- `public_inputs` – concatenated 32-byte public input limbs produced by `bb prove`

It returns `true` if the proof verifies and `false` otherwise. Malformed payloads panic.

## Build the contract

```
cargo build --target wasm32-unknown-unknown --release
```

The WASM lives at
`target/wasm32-unknown-unknown/release/soroban_verification.wasm` and can be deployed
with the standard `soroban contract deploy` flow.

## Generate proof artifacts from `private_limit_orders`

1. Solve the witness so that `target/private_limit_orders.gz` matches your inputs.

```bash
cd private_limit_orders
nargo check
nargo compile
nargo execute
```

2. Install the UltraHonk CLI (`bb`) v0.87.0 (one-time) via `bbup`:

   ```bash
   curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
   bbup -v 0.87.0
   ```

   This drops a `bb` binary at `~/.bb/bin/bb` – add it to your `PATH`.

   Note to self. If you get errors upgrade the system before running bbup.

   ```bash
   sudo apt update
   sudo apt upgrade
   ```

3. Produce the proof/public inputs bundle from the Noir artifact
   (`private_limit_orders/target/private_limit_orders.json`) and the witness.

   ```bash
   bb prove \
     --scheme ultra_honk \
     --oracle_hash keccak \
     -b target/private_limit_orders.json \
     -w target/private_limit_orders.gz \
     -o target \
     --output_format bytes_and_fields
   ```

   Files emitted to `private_limit_orders/target`:

   - `proof` – raw proof bytes (use this directly for the Soroban call)
   - `proof_fields.json` – hex encoded limbs (optional fallback)
   - `public_inputs` – raw concatenated 32-byte public inputs (per Noir ABI order)
   - `public_inputs_fields.json` – hex encoded public inputs (optional fallback)

4. Export the verification key fields in the same format:

   ```bash
   bb write_vk \
     --scheme ultra_honk \
     --oracle_hash keccak \
     -b target/private_limit_orders.json \
     -o target \
     --output_format bytes_and_fields
   ```

   This produces `target/vk_fields.json`, the exact string the contract expects.

## Encoding arguments for `soroban contract invoke`

The contract consumes raw byte blobs, so the easiest way to call it from the CLI is to
use `soroban lab data encode` to serialize the files as Soroban `Bytes` values.

```bash
cd private_limit_orders
VK=$(soroban lab data encode --type bytes --from-file target/vk_fields.json)
PROOF=$(soroban lab data encode --type bytes --from-file target/proof)
PUB=$(soroban lab data encode --type bytes --from-file target/public_inputs)
```

These variables expand to the `bytes` literal strings that Soroban expects.

Example invocation against a deployed contract (replace `--id`, RPC config, and signer):

```bash
soroban contract invoke \
  --wasm ../soroban_verification/target/wasm32-unknown-unknown/release/soroban_verification.wasm \
  --id CB3...YOUR_CONTRACT_ID... \
  --fn verify \
  --arg vk_json="$VK" \
  --arg proof="$PROOF" \
  --arg public_inputs="$PUB"
```

On success the transaction returns `true`. If the proof is invalid or the payloads are
malformed the host traps, which surfaces as an error on the Horizon response.

### What is inside `public_inputs`?

`bb prove --output_format bytes_and_fields` writes `public_inputs` as a concatenation of
32-byte big-endian field elements. For `private_limit_orders` there is a single public
input (`market_price`), so the file contains one field element (padded/encoded by bb).
You do not need to split it manually – the contract chunks the byte stream into 32-byte
limbs internally.

If you prefer to inspect them, run:

```bash
python3 - <<'PY'
import binascii, pathlib
buf = pathlib.Path("private_limit_orders/target/public_inputs").read_bytes()
for i, chunk in enumerate([buf[j:j+32] for j in range(0, len(buf), 32)]):
    print(f"pi[{i}] = 0x{binascii.hexlify(chunk).decode()}")
PY
```

Use the same process for any other Noir circuit – only the `target/<name>.json/.gz`
paths change.
