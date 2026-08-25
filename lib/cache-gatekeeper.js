// lib/cache-gatekeeper.js
// Caching Gatekeeper for Frequent URLs to prevent "One-Hit Wonder" memory pollution.

import { urlCacheBloom } from './bloom'
import { cacheGet, cacheSet } from './redis'
import { prisma } from './prisma'

/**
 * Fetch a URL from cache or DB using the Bloom filter gatekeeper pattern.
 * Prevents memory pollution in Redis by requiring a prior request (tracked in a local Bloom filter)
 * before storing an entry in the cache.
 * 
 * @param {string} shortCode 
 * @returns {Promise<{originalUrl: string, isActive: boolean, expiresAt: string|null}|null>}
 */
export async function fetchCachedUrl(shortCode) {
  const mightBeCached = urlCacheBloom.has(shortCode);

  if (!mightBeCached) {
    // Result = 0 (First Ever Request)
    // Add to bloom filter array
    urlCacheBloom.add(shortCode);

    // Bypass the cache entirely. Fetch live resource from downstream backend (DB).
    const doc = await prisma.url.findUnique({
      where: { shortCode },
      select: { originalUrl: true, iosUrl: true, androidUrl: true, webhookUrl: true, webhookSecret: true, clickCount: true, isActive: true, expiresAt: true },
    });

    if (!doc) return null;

    // Return the response directly to the user without writing it to Upstash Redis.
    return {
      originalUrl: doc.originalUrl,
      iosUrl: doc.iosUrl,
      androidUrl: doc.androidUrl,
      webhookUrl: doc.webhookUrl,
      webhookSecret: doc.webhookSecret,
      clickCount: doc.clickCount,
      isActive: doc.isActive,
      expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    };
  }

  // Result = 1 (Subsequent Request / Cached Candidate)
  // Check Upstash Redis for the URL key
  let urlData = await cacheGet(shortCode);

  if (urlData) {
    // Cache Hit: Return the cached payload immediately
    return urlData;
  }

  // Cache Miss: Fetch live resource payload from downstream DB
  const doc = await prisma.url.findUnique({
    where: { shortCode },
    select: { originalUrl: true, iosUrl: true, androidUrl: true, webhookUrl: true, webhookSecret: true, clickCount: true, isActive: true, expiresAt: true },
  });

  if (!doc) return null;

  urlData = {
    originalUrl: doc.originalUrl,
    iosUrl: doc.iosUrl,
    androidUrl: doc.androidUrl,
    webhookUrl: doc.webhookUrl,
    webhookSecret: doc.webhookSecret,
    clickCount: doc.clickCount,
    isActive: doc.isActive,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
  };

  // Save the payload into Upstash Redis under the URL key with an appropriate TTL.
  let ttl = 3600; // 1 hour default
  if (urlData.expiresAt) {
    const msToExpiry = new Date(urlData.expiresAt) - Date.now();
    if (msToExpiry < 0) return urlData; // Already expired, don't waste cache space
    ttl = Math.min(3600, Math.floor(msToExpiry / 1000));
  }
  
  await cacheSet(shortCode, urlData, ttl);

  return urlData;
}
