/**
 * micro:bit Serial Logger
 * USB Serial communication with chunked transfer and retry mechanism
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const CONFIG = {
  baudRate: 115200,
  chunkSize: 64,
  ackTimeout: 20,
  retryDelay: 5,
  maxRetries: 10,
  maxSeq: 1000
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ═══════════════════════════════════════════════════════════════════
// DOM ELEMENTS
// ═══════════════════════════════════════════════════════════════════
const dom = {
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  sendBtn: document.getElementById('sendBtn'),
  testBtn: document.getElementById('testBtn'),
  messageInput: document.getElementById('messageInput'),
  logContainer: document.getElementById('logContainer'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  copyLogBtn: document.getElementById('copyLogBtn'),
  exportLogBtn: document.getElementById('exportLogBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusPill: document.getElementById('statusPill')
};

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════
let port = null;
let reader = null;
let writer = null;
let isConnected = false;
let rxBuffer = '';
let sendInProgress = false;

// ACK state
let awaitingPayload = null;
let awaitingResolve = null;
let awaitingReject = null;
let awaitingTimer = null;

// Test statistics
let stats = {
  chunks: 0,
  retries: 0,
  maxRetryPerChunk: 0
};

// Cumulative statistics
let cumulative = {
  tests: 0,
  bytes: 0,
  chunks: 0,
  retries: 0,
  time: 0,
  minSpeed: Infinity,
  maxSpeed: 0,
  minRetries: Infinity,
  maxRetries: 0,
  maxRetryPerChunk: 0
};

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const timestamp = () => `[${new Date().toLocaleTimeString()}]`;

function log(msg, type = 'info') {
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.textContent = `${timestamp()} ${msg}`;
  dom.logContainer.appendChild(div);
  dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
}

function clearLog() {
  dom.logContainer.innerHTML = '';
  log('Log cleared');
}

function getLogText() {
  return Array.from(dom.logContainer.children).map(d => d.textContent).join('\n');
}

async function copyLog() {
  await navigator.clipboard.writeText(getLogText());
  log('Logs copied to clipboard', 'success');
}

function exportLog() {
  const blob = new Blob([getLogText()], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'microbit-log.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════
function setConnected(connected) {
  isConnected = connected;
  dom.statusText.textContent = connected ? 'Connected' : 'Disconnected';
  dom.statusDot.classList.toggle('connected', connected);
  dom.statusPill.classList.toggle('connected', connected);
  dom.connectBtn.disabled = connected;
  dom.disconnectBtn.disabled = !connected;
  dom.sendBtn.disabled = !connected;
  if (dom.testBtn) dom.testBtn.disabled = !connected;
}

// ═══════════════════════════════════════════════════════════════════
// SERIAL CONNECTION
// ═══════════════════════════════════════════════════════════════════
async function connect() {
  port = await navigator.serial.requestPort();
  await port.open({ baudRate: CONFIG.baudRate });
  writer = port.writable.getWriter();
  readLoop();
  rxBuffer = '';
  setConnected(true);
  log('Connected', 'success');
}

async function disconnect() {
  isConnected = false;
  if (writer) { await writer.close().catch(() => {}); writer = null; }
  if (reader) { await reader.cancel().catch(() => {}); reader = null; }
  if (port) { await port.close().catch(() => {}); port = null; }
  setConnected(false);
  abortAck('Disconnected');
  log('Disconnected', 'error');
}

async function readLoop() {
  while (port && port.readable) {
    reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) processRxData(value);
      }
    } catch (error) {
      if (isConnected) log('Read error: ' + error.message, 'error');
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// RX PROCESSING
// ═══════════════════════════════════════════════════════════════════
function processRxData(data) {
  rxBuffer += decoder.decode(data).replace(/\r/g, '');

  let nl;
  while ((nl = rxBuffer.indexOf('\n')) !== -1) {
    const line = rxBuffer.slice(0, nl).trim();
    rxBuffer = rxBuffer.slice(nl + 1);
    if (!line) continue;

    log('← ' + line, 'rx');

    if (line.startsWith('>')) {
      tryResolveAck(line.slice(1));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TX / ACK
// ═══════════════════════════════════════════════════════════════════
async function sendRaw(msg) {
  await writer.write(encoder.encode(msg + '\n'));
  log('→ ' + msg, 'tx');
}

function abortAck(reason) {
  if (awaitingTimer) clearTimeout(awaitingTimer);
  if (awaitingReject) awaitingReject(new Error(reason));
  awaitingPayload = awaitingResolve = awaitingReject = null;
}

function waitForAck(payload) {
  return new Promise((resolve, reject) => {
    awaitingPayload = payload;
    awaitingResolve = resolve;
    awaitingReject = reject;
    awaitingTimer = setTimeout(() => {
      abortAck('ACK timeout');
      reject(new Error('ACK timeout'));
    }, CONFIG.ackTimeout);
  });
}

function tryResolveAck(echoed) {
  if (awaitingResolve && echoed === awaitingPayload) {
    clearTimeout(awaitingTimer);
    const resolve = awaitingResolve;
    awaitingPayload = awaitingResolve = awaitingReject = null;
    resolve(true);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CHUNKED TRANSFER
// ═══════════════════════════════════════════════════════════════════
function maxDataLenForSeq(seq) {
  const seqLen = String(seq).length;
  return Math.max(1, CONFIG.chunkSize - 1 - seqLen - 1);
}

async function sendChunked(msg) {
  sendInProgress = true;
  stats.retries = 0;
  stats.chunks = 0;
  stats.maxRetryPerChunk = 0;

  let seq = 0;
  let i = 0;

  while (i < msg.length) {
    const dataLen = maxDataLenForSeq(seq);
    const payload = `${seq}|${msg.slice(i, i + dataLen)}`;

    let success = false;
    let chunkRetries = 0;
    for (let retry = 0; retry < CONFIG.maxRetries && !success; retry++) {
      if (retry > 0) {
        chunkRetries++;
        stats.retries++;
        log(`Retry ${retry} for chunk ${seq}`, 'error');
        rxBuffer = '';
        await delay(CONFIG.retryDelay);
      }
      await sendRaw(payload);
      try {
        await waitForAck(payload);
        success = true;
        stats.maxRetryPerChunk = Math.max(stats.maxRetryPerChunk, chunkRetries);
      } catch (e) {
        if (retry === CONFIG.maxRetries - 1) throw e;
      }
    }

    i += dataLen;
    seq = (seq + 1) % (CONFIG.maxSeq + 1);
    stats.chunks++;
  }

  sendInProgress = false;
}

// ═══════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════
async function sendMessage() {
  const msg = dom.messageInput.value;
  if (!msg) return;

  const byteLen = encoder.encode(msg).length;

  if (byteLen < CONFIG.chunkSize) {
    await sendRaw(msg);
  } else {
    if (/\s/.test(msg)) {
      log('Long messages must contain NO SPACES', 'error');
      return;
    }
    if (sendInProgress) return;
    await sendChunked(msg);
  }

  dom.messageInput.value = '';
}

// ═══════════════════════════════════════════════════════════════════
// TEST
// ═══════════════════════════════════════════════════════════════════
function makeTestString() {
  let s = '';
  for (let i = 0; i <= 1000; i++) s += i;
  return s;
}

async function runTest() {
  const testData = makeTestString();
  log(`TEST #${cumulative.tests + 1} start (${testData.length} chars)`, 'info');

  const t0 = performance.now();
  await sendChunked(testData);
  const elapsed = (performance.now() - t0) / 1000;

  // Calculate stats
  const speed = testData.length / elapsed;
  const attempts = stats.chunks + stats.retries;
  const successRate = ((stats.chunks / attempts) * 100).toFixed(1);

  // Update cumulative
  cumulative.tests++;
  cumulative.bytes += testData.length;
  cumulative.chunks += stats.chunks;
  cumulative.retries += stats.retries;
  cumulative.time += elapsed;
  cumulative.minSpeed = Math.min(cumulative.minSpeed, speed);
  cumulative.maxSpeed = Math.max(cumulative.maxSpeed, speed);
  cumulative.minRetries = Math.min(cumulative.minRetries, stats.retries);
  cumulative.maxRetries = Math.max(cumulative.maxRetries, stats.retries);
  cumulative.maxRetryPerChunk = Math.max(cumulative.maxRetryPerChunk, stats.maxRetryPerChunk);

  // Calculate cumulative stats
  const cumAttempts = cumulative.chunks + cumulative.retries;
  const cumSuccessRate = ((cumulative.chunks / cumAttempts) * 100).toFixed(1);
  const avgSpeed = cumulative.bytes / cumulative.time;
  const avgRetries = cumulative.retries / cumulative.tests;

  // Display results
  log(`════════════════════════════════════════`, 'info');
  log(`TEST #${cumulative.tests} COMPLETE`, 'success');
  log(`────────────────────────────────────────`, 'info');
  log(`  Chunks: ${stats.chunks} | Retries: ${stats.retries} | Max retry: ${stats.maxRetryPerChunk} | Success: ${successRate}%`, 'info');
  log(`  Time: ${elapsed.toFixed(2)}s | Speed: ${speed.toFixed(1)} B/s`, 'info');
  log(`════════════════════════════════════════`, 'info');
  log(`CUMULATIVE STATS (${cumulative.tests} tests)`, 'success');
  log(`────────────────────────────────────────`, 'info');
  log(`  Total: ${cumulative.bytes} bytes | ${cumulative.chunks} chunks | ${cumulative.retries} retries`, 'info');
  log(`  Success rate: ${cumSuccessRate}%`, 'info');
  log(`  Speed: min=${cumulative.minSpeed.toFixed(0)} avg=${avgSpeed.toFixed(0)} max=${cumulative.maxSpeed.toFixed(0)} B/s`, 'info');
  log(`  Retries/test: min=${cumulative.minRetries} avg=${avgRetries.toFixed(1)} max=${cumulative.maxRetries}`, 'info');
  log(`  Max retries for single chunk: ${cumulative.maxRetryPerChunk}`, 'info');
  log(`  Total time: ${cumulative.time.toFixed(2)}s`, 'info');
  log(`════════════════════════════════════════`, 'info');
}

// ═══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════
dom.connectBtn.onclick = connect;
dom.disconnectBtn.onclick = disconnect;
dom.sendBtn.onclick = sendMessage;
dom.messageInput.onkeypress = e => { if (e.key === 'Enter') sendMessage(); };
if (dom.testBtn) dom.testBtn.onclick = runTest;
dom.clearLogBtn.onclick = clearLog;
dom.copyLogBtn.onclick = copyLog;
dom.exportLogBtn.onclick = exportLog;
