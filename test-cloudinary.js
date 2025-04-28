require('dotenv').config();
const axios = require('axios');
const { cloudinary } = require('./src/services/cloudinaryService');

// Function to test Cloudinary connectivity
async function testCloudinaryConnection() {
  try {
    console.log('Testing Cloudinary connectivity...');
    
    // Check if environment variables are set
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    console.log('\nEnvironment variables status:');
    console.log(`- CLOUDINARY_CLOUD_NAME: ${cloudName ? 'Set' : 'Not set'}`);
    console.log(`- CLOUDINARY_API_KEY: ${apiKey ? 'Set' : 'Not set'}`);
    console.log(`- CLOUDINARY_API_SECRET: ${apiSecret ? 'Set' : 'Not set'}`);
    
    if (!cloudName || !apiKey || !apiSecret) {
      console.log('\n⚠️ Warning: Some Cloudinary environment variables are missing.');
      console.log('Please check your .env file and make sure these variables are set:');
      console.log('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
      
      // Ask for credentials if they're not in the environment
      console.log('\nYou can also test by directly calling the testWithCredentials function with your credentials.');
      console.log('Example: testWithCredentials("your_cloud_name", "your_api_key", "your_api_secret")');
      return;
    }
    
    // Test direct Cloudinary API connection
    console.log('\nTesting direct Cloudinary API connection...');
    try {
      const result = await cloudinary.api.ping();
      console.log('\n✅ Direct Cloudinary API connection successful!');
      console.log('Response:', result);
    } catch (cloudinaryError) {
      console.log('\n❌ Direct Cloudinary API connection failed!');
      console.log('Error:', cloudinaryError.message);
    }
    
    // Test the server endpoint if server is running
    try {
      console.log('\nTesting server endpoint /api/cloudinary/test...');
      const response = await axios.get('http://localhost:5000/api/cloudinary/test');
      
      console.log('\n✅ Server endpoint test successful!');
      console.log('Response data:');
      console.log(JSON.stringify(response.data, null, 2));
    } catch (endpointError) {
      console.log('\n❌ Server endpoint test failed!');
      if (endpointError.response) {
        console.log(`Status: ${endpointError.response.status}`);
        console.log('Response data:');
        console.log(JSON.stringify(endpointError.response.data, null, 2));
      } else if (endpointError.request) {
        console.log('No response received from server. Is the server running?');
      } else {
        console.log('Error:', endpointError.message);
      }
    }
    
  } catch (error) {
    console.log('\n❌ Test execution failed!');
    console.log('Error:', error.message);
    
    console.log('\nTroubleshooting tips:');
    console.log('1. Check if your server is running');
    console.log('2. Verify your Cloudinary credentials in the .env file');
    console.log('3. Check if Cloudinary service is available');
  }
}

// Function to test with provided credentials
async function testWithCredentials(cloudName, apiKey, apiSecret) {
  if (!cloudName || !apiKey || !apiSecret) {
    console.log('Error: All credentials (cloudName, apiKey, apiSecret) are required');
    return;
  }
  
  // Temporarily set environment variables
  process.env.CLOUDINARY_CLOUD_NAME = cloudName;
  process.env.CLOUDINARY_API_KEY = apiKey;
  process.env.CLOUDINARY_API_SECRET = apiSecret;
  
  // Reconfigure cloudinary with the new credentials
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });
  
  console.log(`Testing with provided credentials for cloud name: ${cloudName}`);
  
  try {
    // Test direct API connection
    const result = await cloudinary.api.ping();
    console.log('\n✅ Cloudinary connection successful with provided credentials!');
    console.log('Response:', result);
  } catch (error) {
    console.log('\n❌ Cloudinary connection failed with provided credentials!');
    console.log('Error:', error.message);
  }
}

// Check if credentials were provided as command line arguments
const args = process.argv.slice(2);
if (args.length === 3) {
  testWithCredentials(args[0], args[1], args[2]);
} else {
  // Run the main test
  testCloudinaryConnection();
}

// Export the test functions for external use
module.exports = {
  testCloudinaryConnection,
  testWithCredentials
};
