import './styles.css';

const CIRCUIT_PATH = '/circuits/private_limit_orders.json';
const MAX_BB_THREADS = 32;

const state = {
  circuit: null,
  noirModule: null,
  bbModule: null,
  initAcvm: null,
  initAbi: null,
  acvmWasmUrl: null,
  noircAbiWasmUrl: null,
  noirWasmReady: false,
  noir: null,
  backend: null,
  backendThreads: null,
};

const els = {
  form: document.querySelector('#inputsForm'),
  threadsSelect: document.querySelector('#threadsSelect'),
  threadHint: document.querySelector('#threadHint'),
  status: document.querySelector('#status'),
  proveBtn: document.querySelector('#proveBtn'),
  stats: document.querySelector('#stats'),
  publicHex: document.querySelector('#publicHex'),
  proofHex: document.querySelector('#proofHex'),
  copyButtons: [...document.querySelectorAll('[data-copy-target]')],
};

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle('error', isError);
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return 'n/a';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let amount = bytes / 1024;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount.toFixed(2)} ${units[unitIndex]}`;
}

function hexFromBytes(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getPublicHex(publicInputs) {
  return publicInputs.map((value) => value.replace(/^0x/, '')).join('');
}

function getSystemStats() {
  const logicalCpuCount = navigator.hardwareConcurrency || 1;
  const sharedArrayBufferAvailable = typeof SharedArrayBuffer !== 'undefined';
  const isolatedContext = window.crossOriginIsolated === true;
  const maxThreadCap = Math.min(logicalCpuCount, MAX_BB_THREADS);

  return {
    logicalCpuCount,
    sharedArrayBufferAvailable,
    isolatedContext,
    maxThreadCap,
    deviceMemoryGb: navigator.deviceMemory || null,
  };
}

function readHeap() {
  const memory = performance.memory;

  if (!memory) {
    return null;
  }

  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
  };
}

function updateStatsCards(cards) {
  els.stats.innerHTML = cards
    .map(
      (card) => `
      <div class="stat-card">
        <p class="stat-label">${card.label}</p>
        <p class="stat-value">${card.value}</p>
      </div>
    `,
    )
    .join('');
}

function parseArrayInput(raw) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('Array input cannot be empty');
  }

  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error('Array value must be a JSON array');
  }

  return parsed;
}

function coerceValue(rawValue, parameter) {
  const { type } = parameter;

  if (!type || !type.kind) {
    throw new Error(`Unsupported ABI parameter type for ${parameter.name}`);
  }

  if (type.kind === 'integer' || type.kind === 'field') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error(`${parameter.name} is required`);
    }

    let parsedValue;
    try {
      parsedValue = BigInt(trimmed);
    } catch {
      throw new Error(`${parameter.name} must be an integer`);
    }

    if (type.kind === 'integer' && type.sign === 'unsigned' && parsedValue < 0n) {
      throw new Error(`${parameter.name} must be unsigned`);
    }

    return trimmed;
  }

  if (type.kind === 'boolean') {
    return rawValue.trim().toLowerCase() === 'true';
  }

  if (type.kind === 'array') {
    return parseArrayInput(rawValue);
  }

  throw new Error(`Unsupported type kind: ${type.kind}`);
}

function inputPlaceholder(parameter) {
  const { kind } = parameter.type;

  if (kind === 'integer') {
    return parameter.visibility === 'public' ? '100' : '110';
  }

  if (kind === 'array') {
    return '[1,2,3]';
  }

  if (kind === 'boolean') {
    return 'true or false';
  }

  return '';
}

function defaultValue(parameter) {
  if (parameter.name === 'my_limit_price') {
    return '110';
  }

  if (parameter.name === 'market_price') {
    return '100';
  }

  return '';
}

function createFieldMarkup(parameter) {
  const typeLabel = parameter.type.kind === 'integer'
    ? `${parameter.type.sign === 'unsigned' ? 'u' : 'i'}${parameter.type.width}`
    : parameter.type.kind;

  return `
    <label class="input-row">
      <div class="input-head">
        <span>${parameter.name}</span>
        <span class="pill ${parameter.visibility === 'public' ? 'public' : 'private'}">${parameter.visibility}</span>
      </div>
      <input
        data-param-name="${parameter.name}"
        data-param-visibility="${parameter.visibility}"
        placeholder="${inputPlaceholder(parameter)}"
        value="${defaultValue(parameter)}"
        spellcheck="false"
      />
      <p class="tiny muted">${typeLabel}</p>
    </label>
  `;
}

function renderInputs(parameters) {
  els.form.innerHTML = parameters.map((parameter) => createFieldMarkup(parameter)).join('');
}

function collectInputs(parameters) {
  const values = {};

  for (const parameter of parameters) {
    const input = els.form.querySelector(`[data-param-name="${parameter.name}"]`);

    if (!input) {
      throw new Error(`Missing input for ${parameter.name}`);
    }

    values[parameter.name] = coerceValue(input.value, parameter);
  }

  return values;
}

function getFormInputs() {
  return [...els.form.querySelectorAll('input[data-param-name]')];
}

function snapshotFormValues() {
  return getFormInputs().map((input) => ({
    name: input.dataset.paramName || '',
    value: input.value,
  }));
}

function restoreFormValues(snapshot) {
  const valueMap = new Map(snapshot.map((entry) => [entry.name, entry.value]));
  for (const input of getFormInputs()) {
    const key = input.dataset.paramName || '';
    if (valueMap.has(key)) {
      input.value = valueMap.get(key);
    }
  }
}

function setBusyUi(isBusy) {
  for (const input of getFormInputs()) {
    input.disabled = isBusy;
  }

  const baseDisabled = els.threadsSelect.dataset.baseDisabled === 'true';
  els.threadsSelect.disabled = isBusy || baseDisabled;

  for (const button of els.copyButtons) {
    button.disabled = isBusy;
  }
}

function clearForProving() {
  for (const input of getFormInputs()) {
    input.value = '';
  }

  els.publicHex.value = '';
  els.proofHex.value = '';

  updateStatsCards([
    { label: 'Status', value: 'Proving...' },
    { label: 'Witness', value: 'Pending' },
    { label: 'Proof', value: 'Pending' },
    { label: 'Output', value: 'Pending' },
  ]);
}

function populateThreadSelect() {
  const stats = getSystemStats();
  const threadOptions = [];

  for (let threadCount = 1; threadCount <= stats.maxThreadCap; threadCount += 1) {
    threadOptions.push(`<option value="${threadCount}">${threadCount}</option>`);
  }

  els.threadsSelect.innerHTML = threadOptions.join('');

  const recommended = stats.isolatedContext && stats.sharedArrayBufferAvailable
    ? String(Math.min(stats.maxThreadCap, 8))
    : '1';

  els.threadsSelect.value = recommended;

  if (!stats.isolatedContext || !stats.sharedArrayBufferAvailable) {
    els.threadHint.textContent =
      'Multithread proving is unavailable in this context. Falling back to 1 thread.';
    els.threadsSelect.value = '1';
    els.threadsSelect.disabled = true;
  } else {
    els.threadHint.textContent = `SharedArrayBuffer active. Max usable threads here: ${stats.maxThreadCap}.`;
  }

  els.threadsSelect.dataset.baseDisabled = String(els.threadsSelect.disabled);
}

function telemetryCards({
  witnessMs,
  proveMs,
  totalMs,
  proofBytes,
  publicBytes,
  selectedThreads,
  startHeap,
  endHeap,
  peakHeap,
}) {
  const system = getSystemStats();

  return [
    { label: 'Total Time', value: formatMs(totalMs) },
    { label: 'Witness Time', value: formatMs(witnessMs) },
    { label: 'Proof Time', value: formatMs(proveMs) },
    { label: 'Selected Threads', value: String(selectedThreads) },
    { label: 'Logical CPU', value: String(system.logicalCpuCount) },
    { label: 'Device Memory', value: system.deviceMemoryGb ? `${system.deviceMemoryGb} GB` : 'n/a' },
    { label: 'SAB Enabled', value: system.sharedArrayBufferAvailable ? 'yes' : 'no' },
    { label: 'Cross-Origin Isolated', value: system.isolatedContext ? 'yes' : 'no' },
    { label: 'public_inputs Size', value: formatBytes(publicBytes) },
    { label: 'proof Size', value: formatBytes(proofBytes) },
    { label: 'Heap Start', value: startHeap ? formatBytes(startHeap.used) : 'n/a' },
    { label: 'Heap End', value: endHeap ? formatBytes(endHeap.used) : 'n/a' },
    { label: 'Heap Peak', value: Number.isFinite(peakHeap) ? formatBytes(peakHeap) : 'n/a' },
  ];
}

async function loadModules() {
  if (!state.initAcvm || !state.initAbi || !state.acvmWasmUrl || !state.noircAbiWasmUrl) {
    const [acvmModule, abiModule, acvmWasmUrlModule, noircAbiWasmUrlModule] = await Promise.all([
      import('@noir-lang/acvm_js'),
      import('@noir-lang/noirc_abi'),
      import('@noir-lang/acvm_js/web/acvm_js_bg.wasm?url'),
      import('@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url'),
    ]);

    state.initAcvm = acvmModule.default;
    state.initAbi = abiModule.default;
    state.acvmWasmUrl = acvmWasmUrlModule.default;
    state.noircAbiWasmUrl = noircAbiWasmUrlModule.default;
  }

  if (!state.noirWasmReady) {
    await Promise.all([
      state.initAcvm(state.acvmWasmUrl),
      state.initAbi(state.noircAbiWasmUrl),
    ]);
    state.noirWasmReady = true;
  }

  if (!state.noirModule) {
    state.noirModule = await import('@noir-lang/noir_js');
  }

  if (!state.bbModule) {
    state.bbModule = await import('@aztec/bb.js');
  }
}

async function ensureRuntime(selectedThreads) {
  await loadModules();

  if (!state.noir) {
    const { Noir } = state.noirModule;
    state.noir = new Noir(state.circuit);
  }

  if (!state.backend || state.backendThreads !== selectedThreads) {
    if (state.backend) {
      await state.backend.destroy();
    }

    const { UltraHonkBackend } = state.bbModule;
    state.backend = new UltraHonkBackend(state.circuit.bytecode, { threads: selectedThreads });
    state.backendThreads = selectedThreads;
  }
}

async function generateProof() {
  const selectedThreads = Number.parseInt(els.threadsSelect.value, 10) || 1;

  const system = getSystemStats();
  if ((!system.isolatedContext || !system.sharedArrayBufferAvailable) && selectedThreads !== 1) {
    throw new Error('This environment does not support multi-thread proving. Use 1 thread.');
  }

  const parameters = state.circuit.abi.parameters;
  const formSnapshot = snapshotFormValues();
  const inputs = collectInputs(parameters);
  clearForProving();
  setBusyUi(true);

  setStatus('Loading proving runtime...');

  const startHeap = readHeap();
  const heapSamples = [];
  const sampleHeap = () => {
    const current = readHeap();
    if (current) {
      heapSamples.push(current.used);
    }
  };

  sampleHeap();
  const samplerId = window.setInterval(sampleHeap, 120);
  const totalStart = performance.now();

  try {
    await ensureRuntime(selectedThreads);

    setStatus('Generating witness from user inputs...');
    const witnessStart = performance.now();
    const { witness } = await state.noir.execute(inputs);
    const witnessEnd = performance.now();

    setStatus('Generating UltraHonk keccak proof...');
    const proveStart = performance.now();
    const proofData = await state.backend.generateProof(witness, { keccak: true });
    const proveEnd = performance.now();

    const totalEnd = performance.now();
    sampleHeap();

    const publicHex = getPublicHex(proofData.publicInputs);
    const proofHex = hexFromBytes(proofData.proof);

    els.publicHex.value = publicHex;
    els.proofHex.value = proofHex;

    const endHeap = readHeap();
    const peakHeap = heapSamples.length > 0 ? Math.max(...heapSamples) : Number.NaN;

    updateStatsCards(
      telemetryCards({
        witnessMs: witnessEnd - witnessStart,
        proveMs: proveEnd - proveStart,
        totalMs: totalEnd - totalStart,
        proofBytes: proofData.proof.length,
        publicBytes: publicHex.length / 2,
        selectedThreads,
        startHeap,
        endHeap,
        peakHeap,
      }),
    );

    setStatus('Proof generated. Hex outputs are ready to copy.');
  } finally {
    restoreFormValues(formSnapshot);
    setBusyUi(false);
    window.clearInterval(samplerId);
  }
}

async function copyToClipboard(targetId) {
  const el = document.getElementById(targetId);
  if (!el || !el.value) {
    return;
  }

  await navigator.clipboard.writeText(el.value);
}

function wireEvents() {
  els.proveBtn.addEventListener('click', async () => {
    els.proveBtn.disabled = true;

    try {
      await generateProof();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Proof generation failed: ${message}`, true);
    } finally {
      els.proveBtn.disabled = false;
    }
  });

  for (const button of els.copyButtons) {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.copyTarget;
      if (!targetId) {
        return;
      }

      try {
        await copyToClipboard(targetId);
        const previousText = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(() => {
          button.textContent = previousText;
        }, 1200);
      } catch {
        setStatus('Clipboard write failed. Browser blocked clipboard access.', true);
      }
    });
  }
}

async function bootstrap() {
  const response = await fetch(CIRCUIT_PATH);

  if (!response.ok) {
    throw new Error(`Unable to load circuit artifact from ${CIRCUIT_PATH}`);
  }

  state.circuit = await response.json();

  if (!state.circuit?.abi?.parameters) {
    throw new Error('Invalid circuit artifact: ABI parameters missing');
  }

  renderInputs(state.circuit.abi.parameters);
  populateThreadSelect();

  updateStatsCards([
    { label: 'Status', value: 'Idle' },
    { label: 'Circuit', value: 'private_limit_orders' },
    { label: 'Mode', value: 'UltraHonk keccak' },
    { label: 'Proof Output', value: 'Hex (no prefix)' },
  ]);

  setStatus('Ready to generate proof.');
}

wireEvents();
bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(`Initialization failed: ${message}`, true);
});
