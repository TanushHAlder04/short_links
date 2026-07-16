// lib/bloom.js
// Dual-Purpose Bloom filter layer implemented locally in memory for sub-millisecond, zero-network checks.
// Uses FNV-1a hashing with Kirsch-Mitzenmacher optimization.

/**
 * Lightweight FNV-1a hash function
 * @param {string} str 
 * @param {number} seed 
 * @returns {number}
 */
function fnv1a(str, seed = 2166136261) {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // 32-bit FNV-1a prime multiplication
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0; // Ensure unsigned 32-bit integer
}

/**
 * Get k indices using Kirsch-Mitzenmacher optimization
 * @param {string} str 
 * @param {number} k 
 * @param {number} m 
 * @returns {number[]}
 */
export function getBitIndices(str, k, m) {
  const h1 = fnv1a(str, 2166136261);
  const h2 = fnv1a(str, 1540483477); // different seed for h2
  
  const indices = [];
  for (let i = 0; i < k; i++) {
    // using absolute value or unsigned shift in case modulo acts weird on negative numbers in JS
    indices.push(((h1 + i * h2) >>> 0) % m);
  }
  return indices;
}

export class LocalBloomFilter {
  /**
   * Initialize a Bloom Filter.
   * Default: m = 10,000,000 bits (~1.2MB), k = 7.
   * Optimized for n = 1,000,000 elements at 1% false positive rate.
   */
  constructor(mBits = 10_000_000, kHashes = 7) {
    this.m = mBits;
    this.k = kHashes;
    this.buffer = new Uint8Array(Math.ceil(this.m / 8));
    this.bitsSet = 0;
    this.saturationWarned = false;
  }

  /**
   * Add a string to the bloom filter.
   * @param {string} str 
   */
  add(str) {
    const indices = getBitIndices(str, this.k, this.m);
    for (const index of indices) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      const mask = 1 << bitIndex;
      
      if ((this.buffer[byteIndex] & mask) === 0) {
        this.buffer[byteIndex] |= mask; // atomic bitwise OR (JS is single-threaded)
        this.bitsSet++;
      }
    }
    
    // Saturation Monitor
    if (this.bitsSet / this.m > 0.5 && !this.saturationWarned) {
      console.warn('[Architectural Alert] Bloom filter bit array saturation exceeds 50%. False positive rate is increasing.');
      this.saturationWarned = true;
    }
  }

  /**
   * Check if a string might exist in the bloom filter.
   * @param {string} str 
   * @returns {boolean} true if might exist, false if definitely does not exist
   */
  has(str) {
    const indices = getBitIndices(str, this.k, this.m);
    for (const index of indices) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      const mask = 1 << bitIndex;
      
      if ((this.buffer[byteIndex] & mask) === 0) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get the current saturation ratio.
   */
  getSaturation() {
    return this.bitsSet / this.m;
  }
}

// ─── Global Instances ────────────────────────────────────────────────────────
const globalForBloom = globalThis;

export const shortCodeBloom = globalForBloom.shortCodeBloom ?? new LocalBloomFilter();
export const urlCacheBloom = globalForBloom.urlCacheBloom ?? new LocalBloomFilter();

if (process.env.NODE_ENV !== 'production') {
  globalForBloom.shortCodeBloom = shortCodeBloom;
  globalForBloom.urlCacheBloom = urlCacheBloom;
}
