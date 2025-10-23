const ULAW_MAX = 0x1FFF;
const ULAW_BIAS = 0x84;

function decodeMulaw(buffer) {
  const out = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    out[i] = decodeMulawSample(buffer[i]);
  }
  return out;
}

function encodeMulaw(int16Array) {
  const out = Buffer.alloc(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    out[i] = encodeMulawSample(int16Array[i]);
  }
  return out;
}

function decodeMulawSample(byte) {
  byte = ~byte;
  const sign = byte & 0x80;
  let exponent = (byte >> 4) & 0x07;
  let mantissa = byte & 0x0F;
  let sample = ((mantissa << 4) + ULAW_BIAS) << (exponent + 3);
  sample -= ULAW_BIAS;
  if (sign !== 0) sample = -sample;
  return sample;
}

function encodeMulawSample(sample) {
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) {
    sample = -sample;
  }
  if (sample > ULAW_MAX) {
    sample = ULAW_MAX;
  }
  sample += ULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const ulaw = ~(sign | (exponent << 4) | mantissa);
  return ulaw & 0xff;
}

function upsampleTo16k(int16Array) {
  const len = int16Array.length;
  const out = new Int16Array(len * 2);
  for (let i = 0; i < len; i++) {
    const value = int16Array[i];
    const next = i + 1 < len ? int16Array[i + 1] : value;
    out[i * 2] = value;
    out[i * 2 + 1] = Math.round((value + next) / 2);
  }
  return out;
}

// NOTE: upsampleTo24k is NOT used for OpenAI (which expects 16kHz)
// Kept for compatibility but should not be used in production
function upsampleTo24k(int16Array) {
  const len = int16Array.length;
  const out = new Int16Array(len * 3);
  for (let i = 0; i < len; i++) {
    const value = int16Array[i];
    const next = i + 1 < len ? int16Array[i + 1] : value;
    out[i * 3] = value;
    out[i * 3 + 1] = Math.round((value * 2 + next) / 3);
    out[i * 3 + 2] = Math.round((value + next * 2) / 3);
  }
  return out;
}

function downsampleTo8k(int16Array) {
  const len = Math.floor(int16Array.length / 2);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const a = int16Array[i * 2];
    const b = int16Array[i * 2 + 1];
    out[i] = Math.round((a + b) / 2);
  }
  return out;
}

function int16ToBuffer(int16Array) {
  // Use direct buffer conversion for performance
  return Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
}

function bufferToInt16(buffer) {
  const length = Math.floor(buffer.length / 2);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = buffer.readInt16LE(i * 2);
  }
  return out;
}

module.exports = {
  decodeMulaw,
  encodeMulaw,
  upsampleTo16k,
  upsampleTo24k,
  downsampleTo8k,
  int16ToBuffer,
  bufferToInt16,
};

