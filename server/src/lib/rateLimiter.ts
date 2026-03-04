/**
 * Rate Limiter for WebSocket connections
 * 
 * Prevents abuse by limiting requests per user within time windows.
 * Different limits can be applied based on message type.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;     // Time window in ms
  maxRequests: number;  // Max requests per window
}

// Default configs for different action types
export const RATE_LIMITS = {
  // Audio messages are expensive (STT + LLM + TTS)
  audio: { windowMs: 60_000, maxRequests: 30 } as RateLimitConfig,
  // Text messages (LLM + TTS)
  text: { windowMs: 60_000, maxRequests: 60 } as RateLimitConfig,
  // Lightweight operations
  control: { windowMs: 60_000, maxRequests: 120 } as RateLimitConfig,
  // Default fallback
  default: { windowMs: 60_000, maxRequests: 60 } as RateLimitConfig,
};

export function checkRateLimit(
  userId: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `${userId}:${config.maxRequests}`; // Different key per config
  const entry = limits.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    limits.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetAt - now };
}

/**
 * Get rate limit config based on message type
 */
export function getRateLimitConfig(messageType: string): RateLimitConfig {
  switch (messageType) {
    case 'audio_message':
    case 'audio_chunk':
    case 'audio_end':
      return RATE_LIMITS.audio;
    case 'text_message':
      return RATE_LIMITS.text;
    case 'cancel':
    case 'ping':
    case 'interrupt':
    case 'start_listening':
    case 'stop_listening':
    case 'keyword_check':
      return RATE_LIMITS.control;
    default:
      return RATE_LIMITS.default;
  }
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits) {
    if (now > entry.resetAt) limits.delete(key);
  }
}, 60_000);
