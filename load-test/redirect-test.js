import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
  discardResponseBodies: true, // Optimizes memory during load tests
};

export default function () {
  // Pass the valid code you generated in Step 4
  const res = http.get('http://localhost:3000/xK9w2a',{redirects :0}); 

  check(res, {
    'redirect or success': (r) => 
      r.status === 200 || 
      r.status === 301 || 
      r.status === 302 || 
      r.status === 307 || 
      r.status === 308,
  });

  sleep(1);
}