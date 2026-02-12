# Browser Prover UI

This app demonstrates in-browser proving with `@noir-lang/noir_js` + `@aztec/bb.js`.

## Run

```bash
cd private_limit_orders/prover-ui
npm install
npm run dev
```

Open exactly `http://localhost:5173`.
If `5173` is already in use, `npm run dev` now fails (strict port) so you do not accidentally use another server.

The app outputs copy/paste-ready hex strings for:
- `public_inputs`
- `proof`

Both are formatted like:

```bash
xxd -p -c 999999 <file> | tr -d '\n'
```

## Keep circuit artifact fresh

If you recompile the circuit, sync the JSON artifact:

```bash
cd private_limit_orders/prover-ui
npm run sync:circuit
```

This copies `../target/private_limit_orders.json` into `public/circuits/`.

## Threading notes

Multi-thread proving in the browser requires `SharedArrayBuffer`, which requires COOP/COEP headers.
This project sets those headers in Vite dev/preview config.

## WASM MIME note

If you host this with something other than Vite, your server must return:

- `.wasm` -> `Content-Type: application/wasm`

If not, browsers log:

`WebAssembly.instantiateStreaming failed because your server does not serve Wasm with application/wasm MIME type`

and fall back to a slower code path.

Also ensure wasm files are real `.wasm` bytes, not your app HTML fallback page.
