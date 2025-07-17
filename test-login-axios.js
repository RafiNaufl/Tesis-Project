const axios = require('axios');

async function testLoginApi() {
  console.log('Testing NextAuth login API with axios...');
  
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
      const csrfResponse = await axios.get('http://localhost:3000/api/auth/csrf');
      const { csrfToken } = csrfResponse.data;
      
      console.log('CSRF Token:', csrfToken);
      
      // Then attempt login
      try {
        const loginResponse = await axios.post('http://localhost:3000/api/auth/callback/credentials', {
          csrfToken,
          email: cred.email,
          password: cred.password,
          redirect: false,
          callbackUrl: 'http://localhost:3000/dashboard',
          json: true
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: () => true // Accept any status code
        });
        
        console.log('Status:', loginResponse.status);
        console.log('Response:', loginResponse.data);
      } catch (loginError) {
        console.error('Login Error:', loginError.message);
        if (loginError.response) {
          console.log('Status:', loginError.response.status);
          console.log('Response:', loginError.response.data);
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', error.response.data);
      }
    }
  }
}

testLoginApi();