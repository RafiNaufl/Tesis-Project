// Test script to check how the API handles future dates

const { execSync } = require('child_process');

// Function to test the API using curl (which should work better with authentication)
function testWithCurl() {
  try {
    // Use curl to make the request with verbose output
    const command = 'curl -v "http://localhost:3001/api/attendance?month=6&year=2025"';
    console.log('Executing command:', command);
    const result = execSync(command).toString();
    
    console.log('Response from curl:');
    try {
      const parsedData = JSON.parse(result);
      console.log(JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.log('Raw response:', result);
    }
  } catch (error) {
    console.error('Error executing curl:', error.message);
    if (error.stdout) {
      console.log('Stdout:', error.stdout.toString());
    }
    if (error.stderr) {
      console.log('Stderr:', error.stderr.toString());
    }
  }
}

// Run the test
testWithCurl();