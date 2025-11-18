#!/usr/bin/env node
const http = require('http');

const host = process.env.API_HOST || 'localhost';
const port = process.env.API_PORT || 5000;
const base = `http://${host}:${port}`;

function req(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    r.on('error', (err) => reject(err));
    if (method === 'POST') r.write('{}');
    r.end();
  });
}

(async function main() {
  try {
    console.log(`Testing API at ${base}/api/visits`);
    const before = await req('/api/visits');
    console.log('GET before ->', before.status, JSON.stringify(before.body));

    const post = await req('/api/visits', 'POST');
    console.log('POST ->', post.status, JSON.stringify(post.body));

    const after = await req('/api/visits');
    console.log('GET after ->', after.status, JSON.stringify(after.body));
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
  }
})();
