/**
 * EL-011 — Latency Benchmark Script
 * Run: npx tsx src/scripts/benchmark.ts
 * Sends N simulated requests and measures latency percentiles.
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';
const N = parseInt(process.env.BENCH_COUNT || '20', 10);

interface BenchResult {
  i: number;
  total_ms: number;
  status: number;
  error?: string;
}

async function benchmarkRequest(i: number): Promise<BenchResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_URL}/api/v1/ping`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const total_ms = Math.round(performance.now() - start);
    return { i, total_ms, status: res.status };
  } catch (err) {
    const total_ms = Math.round(performance.now() - start);
    return { i, total_ms, status: 0, error: (err as Error).message };
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[idx] ?? 0;
}

async function main() {
  console.log(`\n🔬 Elio Latency Benchmark — ${N} requests to ${API_URL}\n`);

  const results: BenchResult[] = [];
  for (let i = 0; i < N; i++) {
    const result = await benchmarkRequest(i);
    results.push(result);
    const status = result.error ? `❌ ${result.error}` : `✅ ${result.status}`;
    console.log(`  [${i + 1}/${N}] ${result.total_ms}ms ${status}`);
  }

  const times = results.filter(r => !r.error).map(r => r.total_ms);
  const errors = results.filter(r => r.error).length;

  console.log('\n📊 Results:');
  console.log(`  Requests: ${N} (${errors} errors)`);
  console.log(`  P50: ${percentile(times, 0.5)}ms`);
  console.log(`  P95: ${percentile(times, 0.95)}ms`);
  console.log(`  P99: ${percentile(times, 0.99)}ms`);
  console.log(`  Min: ${Math.min(...times)}ms`);
  console.log(`  Max: ${Math.max(...times)}ms`);
  console.log(`  Avg: ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`);
}

main().catch(console.error);
