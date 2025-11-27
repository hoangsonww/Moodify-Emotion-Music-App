// k6 Smoke Test for Moodify API
// Quick validation of critical endpoints after deployment

import http from 'k6/http';
import { check, group } from 'k6';

export const options = {
  vus: 1,  // 1 virtual user
  duration: '30s',
  thresholds: {
    'http_req_duration': ['p(95)<1000'],  // 95% of requests under 1s
    'http_req_failed': ['rate<0.01'],     // Less than 1% errors
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.moodify.com';

export default function () {
  group('Health Checks', function () {
    // Liveness probe
    let res = http.get(`${BASE_URL}/health/live`);
    check(res, {
      'liveness check passed': (r) => r.status === 200,
    });

    // Readiness probe
    res = http.get(`${BASE_URL}/health/ready`);
    check(res, {
      'readiness check passed': (r) => r.status === 200,
    });

    // Startup probe
    res = http.get(`${BASE_URL}/health/startup`);
    check(res, {
      'startup check passed': (r) => r.status === 200,
    });
  });

  group('API Endpoints', function () {
    // Test public endpoint
    let res = http.get(`${BASE_URL}/songs/trending`);
    check(res, {
      'trending endpoint returns 200': (r) => r.status === 200,
      'trending returns songs': (r) => r.json('songs') !== undefined,
    });

    // Test metrics endpoint
    res = http.get(`${BASE_URL}/metrics`);
    check(res, {
      'metrics endpoint accessible': (r) => r.status === 200,
    });
  });
}
