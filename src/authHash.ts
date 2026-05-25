/**
 * Pure TypeScript SHA-256 synchronous implementation.
 * Kept dependency-free so both browser code and the Node server can verify
 * demo credentials without pulling a native crypto package.
 */
export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const wordsCount = ((asciiBitLength + 64) >>> 9 << 4) + 16;
  for (let idx = 0; idx < wordsCount; idx++) words[idx] = 0;
  for (let idx = 0; idx < ascii.length; idx++) {
    words[idx >>> 2] |= (ascii.charCodeAt(idx) & 0xff) << (24 - (idx % 4) * 8);
  }
  words[asciiBitLength >>> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[wordsCount - 1] = asciiBitLength;

  for (let i = 0; i < wordsCount; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (let j = 0; j < 64; j++) {
      if (j >= 16) {
        const w15 = w[j - 15], w2 = w[j - 2], w16 = w[j - 16], w7 = w[j - 7];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[j] = (w16 + s0 + w7 + s1) | 0;
      }

      const a = hash[0], b = hash[1], c = hash[2], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[j] + (w[j] || 0)) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }

    for (let j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    const hex = (hash[i] >>> 0).toString(16);
    result += "00000000".substring(hex.length) + hex;
  }
  return result;
}

export function generateSalt(length = 16): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomValues = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) randomValues[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(randomValues, value => alphabet[value % alphabet.length]).join("");
}

export function hashPassword(password: string, salt: string = generateSalt()): { salt: string; hash: string } {
  return {
    salt,
    hash: sha256(`${salt}:${password}`)
  };
}

export function verifyPassword(password: string, passwordHash: string, salt?: string): boolean {
  if (salt) {
    return hashPassword(password, salt).hash === passwordHash;
  }
  return sha256(password) === passwordHash;
}
