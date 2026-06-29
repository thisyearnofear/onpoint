#!/usr/bin/env node
/**
 * Test Venice Vision API for Virtual Try-On
 * 
 * Tests the computer vision capabilities using Venice's qwen3-vl model
 */

import fs from 'fs';
import path from 'path';

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'https://api.onpoint.famile.xyz';

// Sample image for testing (replace with actual base64 or file path)
const SAMPLE_IMAGE = 'data:image/png;base64,PLACEHOLDER';

async function testVisionAnalysis() {
  console.log('🔍 Testing Venice Vision API for Virtual Try-On\n');
  console.log(`Backend: ${BACKEND_URL}\n`);

  // Test 1: Body Analysis with Photo
  console.log('Test 1: Body Analysis with Photo (Vision)');
  console.log('─'.repeat(50));
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/virtual-tryon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'body-analysis',
        data: {
          description: 'Athletic build, broad shoulders',
          photoData: SAMPLE_IMAGE
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Body analysis successful');
      console.log(`Provider: ${data.provider}`);
      console.log(`Body Type: ${data.bodyType}`);
      console.log(`Measurements:`, JSON.stringify(data.measurements, null, 2));
      console.log(`Fit Recommendations: ${data.fitRecommendations?.length || 0} tips`);
      if (data.fitRecommendations?.[0]) {
        console.log(`  - ${data.fitRecommendations[0].substring(0, 80)}...`);
      }
    } else {
      const error = await response.text();
      console.log(`❌ Failed: ${response.status}`);
      console.log(error.substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log();

  // Test 2: Analyze Person (Vision)
  console.log('Test 2: Analyze Person from Photo (Vision)');
  console.log('─'.repeat(50));
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/analyze-person`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoData: SAMPLE_IMAGE
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Person analysis successful');
      console.log(`Type: ${data.type}`);
      console.log(`Description length: ${data.description?.length || 0} characters`);
      if (data.description) {
        console.log(`Preview: ${data.description.substring(0, 150)}...`);
      }
    } else {
      const error = await response.text();
      console.log(`❌ Failed: ${response.status}`);
      console.log(error.substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log();

  // Test 3: Outfit Fit with Photo (Vision)
  console.log('Test 3: Outfit Fit Analysis with Photo (Vision)');
  console.log('─'.repeat(50));
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/virtual-tryon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'outfit-fit',
        data: {
          photoData: SAMPLE_IMAGE,
          items: [
            { name: 'Navy Blazer', description: 'Structured wool blazer', type: 'outerwear' },
            { name: 'White Shirt', description: 'Cotton button-up', type: 'top' }
          ]
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Outfit fit analysis successful');
      console.log(`Provider: ${data.provider}`);
      console.log(`Styling Tips: ${data.stylingTips?.length || 0} tips`);
      console.log(`Recommendations: ${data.recommendations?.length || 0} items`);
      if (data.stylingTips?.[0]) {
        console.log(`  - ${data.stylingTips[0].substring(0, 80)}...`);
      }
    } else {
      const error = await response.text();
      console.log(`❌ Failed: ${response.status}`);
      console.log(error.substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  console.log();

  console.log('✨ Vision API testing complete!\n');
  console.log('Note: Using sample 1x1 image for testing. Real photos will provide');
  console.log('      much more detailed and accurate analysis from Venice Vision AI.');
}

testVisionAnalysis().catch(console.error);
