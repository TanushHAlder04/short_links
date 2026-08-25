import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
  discardResponseBodies: true, // Optimizes memory during load tests
  thresholds: {
    http_req_duration: ['p(95)<50'], // 95% of redirect requests must complete under 50ms
    http_req_failed: ['rate<0.01'],   // Failure rate must be less than 1%
  },
};

export default function () {
  const targetHost = __ENV.TARGET_HOST || 'http://localhost:3000';
  const targetCode = __ENV.TARGET_CODE || 'xK9w2a';
  const res = http.get(`${targetHost}/${targetCode}`, { redirects: 0 }); 

  check(res, {
    'redirect or success status': (r) => 
      r.status === 200 || 
      r.status === 301 || 
      r.status === 302 || 
      r.status === 307 || 
      r.status === 308,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test/redirect-summary.json': JSON.stringify(data, null, 2),
  };
}