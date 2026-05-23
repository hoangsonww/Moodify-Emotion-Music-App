// =============================================================================
// k6 stress + soak test
// =============================================================================
// Two-phase profile:
//   1. Soak — 50 VU for 30 min to surface memory leaks / slow degradation.
//   2. Spike — burst to 500 VU for 2 min, then watch recovery.
//
// Run:
//   API_URL=https://moodify-backend-api.vercel.app k6 run stress-test.js
// =============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const recoveryTrend = new Trend('post_spike_latency');

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30m',
      gracefulStop: '30s',
      tags: { phase: 'soak' },
    },
    spike: {
      executor: 'ramping-vus',
      startTime: '32m',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 }, // sharp ramp
        { duration: '2m',  target: 500 }, // hold
        { duration: '30s', target: 50 },  // back to baseline
        { duration: '5m',  target: 50 },  // recovery soak
      ],
      gracefulRampDown: '30s',
      tags: { phase: 'spike' },
    },
  },
  thresholds: {
    // Overall thresholds across both scenarios
    http_req_duration: ['p(99)<5000'],
    'http_req_duration{phase:soak}': ['p(95)<2000'],
    errors: ['rate<0.02'],
  },
  // Safer defaults for cloud runs
  noConnectionReuse: false,
  userAgent: 'k6-moodify-stress/1.0',
};

const BASE_URL = __ENV.API_URL || 'https://moodify-backend-api.vercel.app';

function probe(path, tags = {}) {
  const res = http.get(`${BASE_URL}${path}`, { tags });
  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'has body': (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!ok);
  if (tags.phase === 'spike') recoveryTrend.add(res.timings.duration);
  return res;
}

export default function () {
  // Hit the cheapest endpoints during the storm — we want to surface
  // network + load-balancer behavior, not Modal cold-start latency.
  probe('/users/health/', { endpoint: 'health' });
  sleep(0.5);
  probe('/', { endpoint: 'root' });
  sleep(Math.random() * 1.5);
}

export function handleSummary(data) {
  // Plain-text summary in stdout + a JSON artifact so CI can attach it.
  // eslint-disable-next-line no-undef
  return {
    'stdout': textSummary(data),
    'summary.json': JSON.stringify(data, null, 2),
  };
}

// k6's textSummary lives in a separate module in newer versions; fall back
// to a tiny inline formatter if the import is not available.
function textSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration || { values: {} };
  return [
    'Moodify stress test summary',
    `  iterations:      ${m.iterations?.values?.count ?? 0}`,
    `  p95 latency:     ${(dur.values['p(95)'] ?? 0).toFixed(0)} ms`,
    `  p99 latency:     ${(dur.values['p(99)'] ?? 0).toFixed(0)} ms`,
    `  error rate:      ${((m.errors?.values?.rate ?? 0) * 100).toFixed(2)}%`,
    '',
  ].join('\n');
}
