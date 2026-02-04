# Network Resilience Guide - World-Class Error Handling

**Implemented:** 2026-02-04  
**Scope:** All Edge Functions, External API Calls  
**Status:** ✅ Production-Ready

---

## Executive Summary

This guide documents the comprehensive network resilience system implemented across the video generation pipeline. All external API calls, database operations, and inter-function communication now use bulletproof error handling with automatic recovery.

---

## 1. Core Module: `_shared/network-resilience.ts`

### Features

| Capability | Description |
|------------|-------------|
| **Exponential Backoff** | Automatic retry with increasing delays (1s → 2s → 4s → 8s...) |
| **Jitter** | ±30% randomization to prevent thundering herd |
| **Connection Reset Recovery** | Automatic retry on ECONNRESET, ETIMEDOUT, EPIPE |
| **Rate Limit Handling** | Smart waiting with Retry-After header support |
| **Pre-flight Validation** | HEAD requests to validate URLs before use |
| **Timeout Management** | Configurable per-request timeouts with abort signals |

### Configuration

```typescript
export const RESILIENCE_CONFIG = {
  MAX_RETRIES: 4,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  JITTER_FACTOR: 0.3,
  DEFAULT_TIMEOUT_MS: 60000,
  LONG_TIMEOUT_MS: 120000,
  RATE_LIMIT_WAIT_MS: 15000,
  HEAD_REQUEST_TIMEOUT_MS: 10000,
};
```

### Retryable Errors

- `ECONNRESET` - Connection reset by peer
- `ETIMEDOUT` - Connection timeout
- `ECONNREFUSED` - Connection refused
- `EPIPE` - Broken pipe
- `ENOTFOUND` - DNS lookup failed
- `socket hang up` - Socket disconnected
- HTTP 408, 429, 500, 502, 503, 504

---

## 2. Edge Function Hardening

### `generate-voice` (TTS Generation)

**Before:** Single fetch call, no retry
**After:** Full resilience with TTS-specific config

```typescript
const TTS_CONFIG = {
  MAX_RETRIES: 4,
  BASE_DELAY_MS: 2000,
  MAX_POLL_ATTEMPTS: 40,
  POLL_INTERVAL_MS: 1000,
  RATE_LIMIT_WAIT_MS: 12000,
};
```

Key improvements:
- Connection reset recovery with automatic retry
- Rate limit detection with 12s smart wait
- Polling with resilient fetch for status checks
- Detailed logging for debugging

### `generate-avatar-direct` (Avatar Pipeline)

**Before:** No image validation, fragile Kling calls
**After:** Pre-flight validation + resilient API calls

Key improvements:
- **Pre-flight image URL validation** before Kling API calls
- Clear error messages for expired/invalid images
- Automatic retry for TTS segment generation
- Rate limit protection with exponential backoff

### `pipeline-watchdog` (Async Orchestration)

**Before:** Single fetch for all operations
**After:** Full resilience for all external calls

Key improvements:
- Resilient polling for Replicate predictions
- Image URL validation before frame-chaining
- Automatic fallback to alternative images
- Rate limit handling for Kling/Lip-sync APIs

### `mode-router` (Request Dispatcher)

**Before:** No retry for generate-avatar-direct calls
**After:** 3 retries with 90s timeout

Key improvements:
- Connection reset recovery for pipeline calls
- Extended timeout for initial job creation
- Detailed error propagation

---

## 3. URL Validation System

### `validateImageUrl(url: string)`

Performs HEAD request to verify:
- URL is accessible (2xx response)
- Content-Type is image (warning if not)
- No timeout or network errors

**Usage in pipeline:**

```typescript
const imageValidation = await validateImageUrl(avatarImageUrl);

if (!imageValidation.valid) {
  // Try fallback, or fail with clear message
  throw new Error(`Image not accessible: ${imageValidation.error}`);
}
```

### Benefits

1. **Prevents Kling API failures** from expired replicate.delivery URLs
2. **Clear error messages** instead of cryptic 400 errors
3. **Automatic fallback** to alternative images when available

---

## 4. Error Messages for Users

The system now provides user-friendly error messages:

| Technical Error | User Message |
|----------------|--------------|
| ECONNRESET | "Network connection was interrupted. Please try again." |
| 429 Rate Limit | "Service is busy. Please wait a moment and retry." |
| Image 400/404 | "Avatar image is not accessible. Please try with a different avatar." |
| Timeout | "Request took too long. Please try again." |

---

## 5. Monitoring & Debugging

### Log Patterns

```
[Voice-MiniMax] Rate limited (429), waiting 12000ms (attempt 2/3)...
[AvatarDirect] ✅ Avatar image URL is valid and accessible
[Watchdog] ⚠️ Using fallback image: https://...
[NetworkResilience] HTTP 503, retry 2/4 in 4523ms
```

### Health Indicators

- `wasRateLimited: boolean` - Indicates if rate limiting was encountered
- `attempts: number` - Total attempts made
- `totalTimeMs: number` - Total time including retries

---

## 6. Best Practices

### When to Use Resilient Fetch

✅ **Always use for:**
- External API calls (Replicate, OpenAI, etc.)
- Inter-function calls (generate-voice, extract-last-frame)
- Any URL that might expire (replicate.delivery)

❌ **Not needed for:**
- Supabase SDK calls (has built-in retry)
- Static assets in our own storage

### Timeout Guidelines

| Operation | Recommended Timeout |
|-----------|-------------------|
| Quick API call | 15-30s |
| TTS generation | 60-90s |
| Video generation polling | 120s per check |
| Initial pipeline start | 90s |

---

## 7. Testing Resilience

To verify resilience is working:

1. **Rate limit test**: Generate multiple TTS requests rapidly
2. **Timeout test**: Use slow network simulation
3. **Recovery test**: Force ECONNRESET mid-request

Expected behavior: All should succeed with retry logs visible.

---

## Conclusion

The network resilience system ensures:

1. **Zero user-visible failures** for transient network issues
2. **Automatic recovery** from rate limits and connection resets
3. **Clear error messages** when issues are unrecoverable
4. **Comprehensive logging** for debugging

All critical paths are now hardened for production-grade reliability.
