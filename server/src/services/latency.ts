/**
 * EL-011 — Latency Optimization Service
 * Streaming TTS pipeline, metrics tracking, sentence splitting
 */

import type { FastifyBaseLogger } from 'fastify';

// Sentence-end regex for streaming TTS
const SENTENCE_END = /[.!?:]\s+|[.!?:]$/;

interface LatencyMetrics {
  requestId: string;
  userId: string;
  stt_ms: number;
  llm_ttft_ms: number;      // Time to first token
  llm_total_ms: number;
  tts_ttfb_ms: number;      // Time to first byte of audio
  tts_total_ms: number;
  total_perceived_ms: number; // End of speech → first audio playback
  cache_hit: boolean;
  timestamp: string;
}

interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export class LatencyTracker {
  private metrics: LatencyMetrics[] = [];
  private logger: FastifyBaseLogger;
  private maxHistory = 1000;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger;
  }

  record(metrics: LatencyMetrics): void {
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxHistory) {
      this.metrics = this.metrics.slice(-this.maxHistory);
    }
    this.logger.info({
      msg: 'latency_metrics',
      ...metrics,
    });
  }

  getStats(): { perceived: PercentileStats; stt: PercentileStats; llm_ttft: PercentileStats; tts_ttfb: PercentileStats } {
    const calc = (values: number[]): PercentileStats => {
      if (!values.length) return { p50: 0, p95: 0, p99: 0, count: 0 };
      const sorted = [...values].sort((a, b) => a - b);
      return {
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
        count: sorted.length,
      };
    };

    return {
      perceived: calc(this.metrics.map(m => m.total_perceived_ms)),
      stt: calc(this.metrics.map(m => m.stt_ms)),
      llm_ttft: calc(this.metrics.map(m => m.llm_ttft_ms)),
      tts_ttfb: calc(this.metrics.map(m => m.tts_ttfb_ms)),
    };
  }

  getCacheHitRate(): number {
    if (!this.metrics.length) return 0;
    const hits = this.metrics.filter(m => m.cache_hit).length;
    return hits / this.metrics.length;
  }
}

/**
 * Sentence splitter for streaming TTS.
 * Buffers text tokens and yields complete sentences.
 */
export class SentenceSplitter {
  private buffer = '';

  /**
   * Add a text chunk and return any complete sentences.
   */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const sentences: string[] = [];

    // Split on sentence endings
    let match: RegExpExecArray | null;
    while ((match = SENTENCE_END.exec(this.buffer)) !== null) {
      const sentence = this.buffer.slice(0, match.index + match[0].length).trim();
      if (sentence) sentences.push(sentence);
      this.buffer = this.buffer.slice(match.index + match[0].length);
    }

    return sentences;
  }

  /**
   * Flush remaining buffer (end of stream).
   */
  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining || null;
  }
}

/**
 * Connection keep-alive helper for Anthropic API.
 */
export function createKeepAliveAgent(): { keepAlive: true; keepAliveMsecs: number } {
  return {
    keepAlive: true,
    keepAliveMsecs: 30000,
  };
}

export type { LatencyMetrics };
