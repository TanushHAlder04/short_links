import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '20s',
};

export default function () {
  const payload = JSON.stringify({
    url: 'https://example.com',
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  const res = http.post('http://localhost:3000/api/generate', payload, { headers });

  check(res, {
    'created or rate-limited safely': (r) => 
      r.status === 200 || 
      r.status === 201 || 
      r.status === 429,
  });

  sleep(1);
}