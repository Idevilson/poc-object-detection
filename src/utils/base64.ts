// Base64 is defined on 6-bit groups, so bit shifting is the operation, not a
// micro-optimization. Disabled for this file only.
/* eslint-disable no-bitwise */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const PAD = '=';

/** Reverse lookup, built once. `-1` marks a character that is not base64. */
const LOOKUP = ((): Int8Array => {
  const table = new Int8Array(128).fill(-1);
  for (let index = 0; index < ALPHABET.length; index += 1) {
    table[ALPHABET.charCodeAt(index)] = index;
  }
  return table;
})();

/**
 * Encodes bytes as standard base64.
 *
 * Written here rather than pulled from a package because the enrollment
 * payload crosses the network on every sync, and this is the only transform it
 * needs. `base64-js` ships inside React Native but is not a declared
 * dependency of this app, and relying on a transitive one is how builds break
 * on an unrelated upgrade.
 */
export function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];

  let index = 0;
  for (; index + 2 < bytes.length; index += 3) {
    const chunk =
      (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    parts.push(
      ALPHABET[(chunk >> 18) & 63] +
        ALPHABET[(chunk >> 12) & 63] +
        ALPHABET[(chunk >> 6) & 63] +
        ALPHABET[chunk & 63],
    );
  }

  const remaining = bytes.length - index;
  if (remaining === 1) {
    const chunk = bytes[index] << 16;
    parts.push(
      ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63] + PAD + PAD,
    );
  } else if (remaining === 2) {
    const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8);
    parts.push(
      ALPHABET[(chunk >> 18) & 63] +
        ALPHABET[(chunk >> 12) & 63] +
        ALPHABET[(chunk >> 6) & 63] +
        PAD,
    );
  }

  return parts.join('');
}

/**
 * Decodes standard base64 into bytes.
 *
 * Throws on malformed input instead of returning truncated data: a silently
 * corrupted enrollment would weaken recognition without any visible failure.
 */
export function decodeBase64(value: string): ArrayBuffer {
  const clean = value.endsWith(`${PAD}${PAD}`)
    ? value.slice(0, -2)
    : value.endsWith(PAD)
      ? value.slice(0, -1)
      : value;

  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let accumulator = 0;
  let bitCount = 0;
  let writeIndex = 0;

  for (let index = 0; index < clean.length; index += 1) {
    const code = clean.charCodeAt(index);
    const digit = code < 128 ? LOOKUP[code] : -1;
    if (digit < 0) {
      throw new TypeError(
        `Invalid base64 character "${clean[index]}" at index ${index}`,
      );
    }

    accumulator = (accumulator << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[writeIndex] = (accumulator >> bitCount) & 0xff;
      writeIndex += 1;
    }
  }

  if (writeIndex !== byteLength) {
    throw new TypeError('Truncated base64 payload');
  }

  return bytes.buffer;
}
