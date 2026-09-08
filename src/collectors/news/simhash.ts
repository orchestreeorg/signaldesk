import { createHash } from "node:crypto";

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);
}

export function simhash64(text: string): string {
  const acc = Array.from({ length: 64 }, () => 0);
  for (const token of tokens(text)) {
    const digest = createHash("sha256").update(token).digest();
    for (let i = 0; i < 64; i += 1) {
      const byte = digest[Math.floor(i / 8)];
      if (byte === undefined) {
        continue;
      }
      const bit = (byte >> (7 - (i % 8))) & 1;
      acc[i] = (acc[i] ?? 0) + (bit === 1 ? 1 : -1);
    }
  }
  let out = 0n;
  for (let i = 0; i < 64; i += 1) {
    if ((acc[i] ?? 0) >= 0) {
      out |= 1n << BigInt(63 - i);
    }
  }
  return out.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x > 0n) {
    count += 1;
    x &= x - 1n;
  }
  return count;
}
