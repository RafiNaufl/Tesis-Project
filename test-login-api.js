// For Node.js 18 and above, fetch is built-in
// For older Node.js versions, we need to import node-fetch differently
let fetch;
try {
  // Try using the built-in fetch (Node.js 18+)
  fetch = global.fetch;
} catch (error) {
  // Fall back to node-fetch for older Node.js versions
  fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}

async function testLoginApi() {
  console.log('Testing NextAuth login API...');
  
  const credentials = [
    { email: 'admin@example.com', password: 'admin123', label: 'Admin (correct credentials)' },
    { email: 'employee@example.com', password: 'employee123', label: 'Employee (correct credentials)' },
    { email: 'admin@example.com', password: 'wrongpassword', label: 'Admin (wrong password)' },
    { email: 'nonexistent@example.com', password: 'password', label: 'Non-existent user' }
  ];
  
  for (const cred of credentials) {
    console.log(`\nTesting: ${cred.label}`);
    console.log(`Email: ${cred.email}, Password: ${cred.password}`);
    
    try {
      // First get the CSRF token
      const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf');
      const { csrfToken } = await csrfResponse.json();
      
      // Then attempt login
      const loginResponse = await fetch('http://localhost:3000/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csrfToken,
          email: cred.email,
          password: cred.password,
          redirect: false,
          callbackUrl: 'http://localhost:3000/dashboard',
          json: true
        }),
      });
      
      const result = await loginResponse.text();
      console.log('Status:', loginResponse.status);
      console.log('Response:', result);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

testLoginApi();