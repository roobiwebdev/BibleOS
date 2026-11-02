/**
 * SOURCE OF TRUTH KEYWORDS: uuidv7, newId, row id, time-ordered id, UUID version 7, primary key
 * WHAT:  Generates RFC 9562 UUIDv7 strings: 48-bit Unix milliseconds, then a 12-bit sequence
 *        and 62 random bits. Ids made in the same millisecond still sort in creation order.
 * WHY:   Study rows need ids that are unique across devices (for sync later) and that sort by
 *        time, which keeps SQLite's primary-key index append-mostly. crypto.randomUUID is v4
 *        (random order). Uses only Web Crypto, so it runs in Node, the WebView and tests.
 * WHERE: every insert in packages/local-api, change_log rows.
 */
let lastMs = -1;
let seq = 0;

export function uuidv7(now: number = Date.now()): string {
  let ms = Math.max(Math.floor(now), lastMs);
  if (ms === lastMs) {
    seq++;
    // Sequence overflow inside one millisecond: borrow the next millisecond to keep order.
    if (seq > 0xfff) {
      ms++;
      seq = 0;
    }
  } else {
    seq = 0;
  }
  lastMs = ms;

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // 48-bit timestamp, big-endian. Division keeps it exact beyond 32 bits.
  let t = ms;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = t % 256;
    t = Math.floor(t / 256);
  }
  bytes[6] = 0x70 | ((seq >> 8) & 0x0f); // version 7 + high sequence bits
  bytes[7] = seq & 0xff;
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f); // RFC 9562 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The millisecond timestamp encoded in a UUIDv7 (for tests and debugging). */
export function uuidv7Time(id: string): number {
  return Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16);
}
