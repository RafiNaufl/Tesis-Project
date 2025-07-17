const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/attendance?month=6&year=2025',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();