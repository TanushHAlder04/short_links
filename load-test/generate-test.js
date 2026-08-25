import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_duration: ['p(95)<150'], // 95% of generation requests complete under 150ms
    http_req_failed: ['rate<0.05'],   // Unexpected failure rate must be less than 5%
  },
};

export default function () {
  const targetHost = __ENV.TARGET_HOST || 'http://localhost:3000';
  const payload = JSON.stringify({
    url: 'https://example.com/test-page',
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  const res = http.post(`${targetHost}/api/generate`, payload, { headers });

  check(res, {
    'created or rate-limited safely': (r) => 
      r.status === 200 || 
      r.status === 201 || 
      r.status === 429,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test/generate-summary.json': JSON.stringify(data, null, 2),
  };
}