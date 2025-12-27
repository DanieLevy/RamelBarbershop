/**
 * Updates the APP_VERSION in the service worker file.
 * This script runs automatically before each build via npm prebuild.
 * 
 * Version format: YYYY.MM.DD.HHMM (e.g., 2024.12.28.1430)
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'public', 'sw.js');

// Generate version based on current timestamp
const now = new Date();
const version = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
].join('.');

console.log(`📦 Updating Service Worker version to: ${version}`);

try {
  // Read the service worker file
  let swContent = fs.readFileSync(SW_PATH, 'utf8');
  
  // Replace the version constant
  const versionRegex = /const APP_VERSION = ['"][^'"]+['"]/;
  const newVersionLine = `const APP_VERSION = '${version}'`;
  
  if (versionRegex.test(swContent)) {
    swContent = swContent.replace(versionRegex, newVersionLine);
    fs.writeFileSync(SW_PATH, swContent, 'utf8');
    console.log(`✅ Service Worker version updated successfully!`);
  } else {
    console.error('❌ Could not find APP_VERSION constant in sw.js');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error updating service worker version:', error.message);
  process.exit(1);
}

