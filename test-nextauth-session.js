const axios = require('axios');

async function testNextAuthSession() {
  console.log('Testing NextAuth session endpoint...');
  
  // Use port 3001 as specified in the server startup
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log(`Attempting to connect to ${baseUrl}/api/auth/session...`);
    // Test the session endpoint with detailed error handling
    try {
      const sessionResponse = await axios.get(`${baseUrl}/api/auth/session`, {
        validateStatus: () => true, // Accept any status code
        timeout: 5000 // 5 second timeout
      });
      
      console.log('Session Status:', sessionResponse.status);
      console.log('Session Response:', sessionResponse.data);
    } catch (sessionError) {
      console.error('Session endpoint error:', sessionError.message);
      if (sessionError.code) {
        console.error('Error code:', sessionError.code);
      }
      if (sessionError.response) {
        console.log('Response status:', sessionError.response.status);
        console.log('Response data:', sessionError.response.data);
      }
    }
    
    // Test the CSRF endpoint with detailed error handling
    console.log(`\nAttempting to connect to ${baseUrl}/api/auth/csrf...`);
    try {
      const csrfResponse = await axios.get(`${baseUrl}/api/auth/csrf`, {
        validateStatus: () => true, // Accept any status code
        timeout: 5000 // 5 second timeout
      });
      
      console.log('CSRF Status:', csrfResponse.status);
      console.log('CSRF Response:', csrfResponse.data);
    } catch (csrfError) {
      console.error('CSRF endpoint error:', csrfError.message);
      if (csrfError.code) {
        console.error('Error code:', csrfError.code);
      }
      if (csrfError.response) {
        console.log('Response status:', csrfError.response.status);
        console.log('Response data:', csrfError.response.data);
      }
    }
    
    // Test a simple GET request to the root to check if the server is responding
    console.log(`\nAttempting to connect to ${baseUrl} (root)...`);
    try {
      const rootResponse = await axios.get(baseUrl, {
        validateStatus: () => true, // Accept any status code
        timeout: 5000 // 5 second timeout
      });
      
      console.log('Root Status:', rootResponse.status);
      console.log('Root Response type:', typeof rootResponse.data);
      console.log('Root Response length:', rootResponse.data ? rootResponse.data.length : 0);
    } catch (rootError) {
      console.error('Root endpoint error:', rootError.message);
      if (rootError.code) {
        console.error('Error code:', rootError.code);
      }
      if (rootError.response) {
        console.log('Response status:', rootError.response.status);
        console.log('Response data type:', typeof rootError.response.data);
      }
    }
    
  } catch (error) {
    console.error('General error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testNextAuthSession();