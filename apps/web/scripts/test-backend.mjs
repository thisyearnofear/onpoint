#!/usr/bin/env node
/**
 * Test Backend Connection
 * 
 * Verifies that the frontend can connect to the Hetzner backend API.
 * Run: node scripts/test-backend.mjs
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL;

console.log('🔍 Testing Backend Connection\n');
console.log(`API URL: ${API_URL || '(not set - will use Vercel serverless)'}\n`);

if (!API_URL) {
  console.log('⚠️  NEXT_PUBLIC_AGENT_API_URL not set');
  console.log('   Frontend will use Vercel serverless functions');
  console.log('   To use Hetzner backend, add to .env.local:');
  console.log('   NEXT_PUBLIC_AGENT_API_URL=https://api.onpoint.famile.xyz\n');
  process.exit(0);
}

// Test endpoints
const tests = [
  {
    name: 'Health Check',
    endpoint: '/health',
    method: 'GET',
  },
  {
    name: 'Virtual Try-On',
    endpoint: '/api/ai/virtual-tryon',
    method: 'POST',
    body: {
      type: 'body-analysis',
      data: { description: 'Test build' },
      provider: 'auto',
    },
  },
];

async function testEndpoint(test) {
  const url = `${API_URL}${test.endpoint}`;
  
  try {
    const options = {
      method: test.method,
      headers: { 'Content-Type': 'application/json' },
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${test.name}`);
      console.log(`   Status: ${response.status}`);
      if (data.provider) console.log(`   Provider: ${data.provider}`);
      return true;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error || JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${test.name}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test);
    if (result) passed++;
    else failed++;
    console.log('');
  }
  
  console.log('─'.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All tests passed! Backend is ready.\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check backend configuration.\n');
    process.exit(1);
  }
}

runTests();
