#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./run.sh
#
# Assumes:
# - You're running from anywhere (script uses absolute-ish repo-relative cd paths below)
# - `stellar` CLI is installed and configured with a "james" identity + testnet network settings
# - `nargo`, `npm`, `node`, and `python3` are available

ROOT="/mnt/c/code/Noirlang-Experiments"
LIMIT_ORDERS_DIR="$ROOT/private_limit_orders"
CONTRACT_DIR="$ROOT/ultrahonk_soroban_contract"

echo "==> 0) cd $LIMIT_ORDERS_DIR"
cd "$LIMIT_ORDERS_DIR"

echo "==> 1) Build circuit + witness"
npm i -D @aztec/bb.js@0.87.0 source-map-support
nargo compile
nargo execute

echo "==> 2) Generate UltraHonk (keccak) VK + proof"
BBJS="./node_modules/@aztec/bb.js/dest/node/main.js"

node "$BBJS" write_vk_ultra_keccak_honk \
  -b ./target/private_limit_orders.json \
  -o ./target/vk.keccak

node "$BBJS" prove_ultra_keccak_honk \
  -b ./target/private_limit_orders.json \
  -w ./target/private_limit_orders.gz \
  -o ./target/proof.with_public_inputs

echo "==> 3) Split proof into public_inputs + proof bytes"
PUB_COUNT="$(node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("target/private_limit_orders.json","utf8")); process.stdout.write(String((j.abi?.parameters||[]).filter(p=>p.visibility==="public").length));')"
PUB_BYTES=$((PUB_COUNT * 32))

head -c "$PUB_BYTES" target/proof.with_public_inputs > target/public_inputs
tail -c +$((PUB_BYTES + 1)) target/proof.with_public_inputs > target/proof
cp target/vk.keccak target/vk

echo "    PUB_COUNT=$PUB_COUNT"
echo "    PUB_BYTES=$PUB_BYTES"

echo "==> Optional sanity check (public input as big-endian int)"
python3 - <<'PY'
import pathlib
b = pathlib.Path("target/public_inputs").read_bytes()
print("public_inputs_len:", len(b))
print("public_input_be:", int.from_bytes(b, "big"))
PY

echo "==> 4) cd $CONTRACT_DIR"
cd "$CONTRACT_DIR"

echo "==> Build + deploy contract with VK bytes"
stellar contract build --optimize

CID="$(
  stellar contract deploy \
    --source-account james \
    --wasm target/wasm32v1-none/release/ultrahonk_soroban_contract.wasm \
    --network testnet \
    -- \
    --vk_bytes-file-path ../private_limit_orders/target/vk \
  | tail -n1
)"

echo "==> Deployed CID: $CID"

echo "==> 5) Verify proof with raw byte files (no send)"
stellar contract invoke \
  --source-account james \
  --id "$CID" \
  --network testnet \
  --send yes \
  -- \
  verify_proof \
  --public_inputs-file-path ../private_limit_orders/target/public_inputs \
  --proof_bytes-file-path ../private_limit_orders/target/proof