// k6 Load Testing Script for Moodify API
// Tests application performance under various load conditions

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const apiDuration = new Trend('api_duration');
const apiCalls = new Counter('api_calls');

// Test configuration
export const options = {
  stages: [
    // Warm-up
    { duration: '1m', target: 10 },

    // Ramp up to normal load
    { duration: '2m', target: 50 },

    // Stay at normal load
    { duration: '5m', target: 50 },

    // Ramp up to peak load
    { duration: '2m', target: 100 },

    // Stay at peak load
    { duration: '5m', target: 100 },

    // Spike test
    { duration: '1m', target: 200 },
    { duration: '2m', target: 200 },

    // Ramp down
    { duration: '2m', target: 0 },
  ],

  thresholds: {
    // HTTP errors should be less than 1%
    'errors': ['rate<0.01'],

    // 95% of requests should be below 2s
    'http_req_duration': ['p(95)<2000'],

    // Specific endpoint thresholds
    'http_req_duration{endpoint:login}': ['p(95)<1000'],
    'http_req_duration{endpoint:songs}': ['p(95)<1500'],
    'http_req_duration{endpoint:analyze}': ['p(95)<3000'],

    // Success rate should be above 99%
    'http_req_failed': ['rate<0.01'],
  },
};

// Base URL (can be overridden via environment variable)
const BASE_URL = __ENV.API_URL || 'https://api.moodify.com';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'testpass123' },
  { email: 'test2@example.com', password: 'testpass123' },
  { email: 'test3@example.com', password: 'testpass123' },
];

// Setup function - runs once before test
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  // Health check
  const healthRes = http.get(`${BASE_URL}/health/ready`);
  check(healthRes, {
    'health check passed': (r) => r.status === 200,
  });

  return { startTime: new Date().toISOString() };
}

// Main test scenario
export default function (data) {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  let authToken;

  // Login flow
  group('User Login', function () {
    const loginPayload = JSON.stringify({
      email: user.email,
      password: user.password,
    });

    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'login' },
    };

    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      loginPayload,
      loginParams
    );

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => r.json('token') !== '',
    });

    errorRate.add(!loginSuccess);
    loginDuration.add(loginRes.timings.duration);
    apiCalls.add(1);

    if (loginSuccess) {
      authToken = loginRes.json('token');
    } else {
      console.error(`Login failed: ${loginRes.status}`);
      return;
    }
  });

  sleep(1);

  // Authenticated API calls
  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  };

  // Get user profile
  group('Get User Profile', function () {
    const profileRes = http.get(
      `${BASE_URL}/users/profile`,
      {
        ...authHeaders,
        tags: { endpoint: 'profile' },
      }
    );

    const success = check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
      'profile has user data': (r) => r.json('user') !== undefined,
    });

    errorRate.add(!success);
    apiDuration.add(profileRes.timings.duration);
    apiCalls.add(1);
  });

  sleep(1);

  // Search for songs
  group('Search Songs', function () {
    const searchRes = http.get(
      `${BASE_URL}/songs/search?q=happy&limit=10`,
      {
        ...authHeaders,
        tags: { endpoint: 'songs' },
      }
    );

    const success = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search returns results': (r) => r.json('songs').length > 0,
    });

    errorRate.add(!success);
    apiDuration.add(searchRes.timings.duration);
    apiCalls.add(1);
  });

  sleep(2);

  // Analyze emotion
  group('Analyze Emotion', function () {
    const analyzePayload = JSON.stringify({
      text: 'I am feeling great today!',
    });

    const analyzeRes = http.post(
      `${BASE_URL}/analyze/emotion`,
      analyzePayload,
      {
        ...authHeaders,
        tags: { endpoint: 'analyze' },
      }
    );

    const success = check(analyzeRes, {
      'analyze status is 200': (r) => r.status === 200,
      'analyze returns emotion': (r) => r.json('emotion') !== '',
      'analyze returns confidence': (r) => r.json('confidence') > 0,
    });

    errorRate.add(!success);
    apiDuration.add(analyzeRes.timings.duration);
    apiCalls.add(1);
  });

  sleep(1);

  // Get recommendations
  group('Get Recommendations', function () {
    const recsRes = http.get(
      `${BASE_URL}/recommendations?mood=happy&limit=20`,
      {
        ...authHeaders,
        tags: { endpoint: 'recommendations' },
      }
    );

    const success = check(recsRes, {
      'recommendations status is 200': (r) => r.status === 200,
      'recommendations returns songs': (r) => r.json('songs').length > 0,
    });

    errorRate.add(!success);
    apiDuration.add(recsRes.timings.duration);
    apiCalls.add(1);
  });

  sleep(Math.random() * 3 + 1);  // Random sleep 1-4 seconds
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log(`Load test completed. Started at ${data.startTime}`);
}
