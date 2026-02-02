/**
 * Updates the APP_VERSION in both the service worker and version.ts files.
 * This script runs automatically before each build via npm prebuild.
 * 
 * Version format: MAJOR.MINOR.PATCH-YYYY.MM.DD.HHMM
 * Example: 2.0.0-2024.12.28.1430
 * 
 * This combines the semantic version from package.json with a build timestamp
 * for cache busting and easy identification of when a build was created.
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'public', 'sw.js');
const VERSION_PATH = path.join(__dirname, '..', 'lib', 'version.ts');
const PACKAGE_PATH = path.join(__dirname, '..', 'package.json');

// Read package.json for semantic version
let packageVersion = '2.0.0';
try {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  packageVersion = packageJson.version || '2.0.0';
} catch (error) {
  console.warn('⚠️ Could not read package.json, using default version');
}

// Generate timestamp for build identification
const now = new Date();
const timestamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
].join('.');

// Combine version: semantic-version + timestamp for full traceability
const version = `${packageVersion}-${timestamp}`;

console.log(`📦 Service Worker Version Update`);
console.log(`   Package Version: ${packageVersion}`);
console.log(`   Build Timestamp: ${timestamp}`);
console.log(`   Full Version:    ${version}`);

try {
  // Read the service worker file
  let swContent = fs.readFileSync(SW_PATH, 'utf8');
  
  // Replace the version constant in sw.js
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
  
  // Also update lib/version.ts for display in the footer
  const versionTsContent = `/**
 * Application Version
 * 
 * This file is automatically updated by the prebuild script.
 * DO NOT EDIT MANUALLY - changes will be overwritten on next build.
 * 
 * Format: MAJOR.MINOR.PATCH-YYYY.MM.DD.HHMM
 * Example: 2.0.0-2026.02.02.1830
 */

export const APP_VERSION = '${version}'
`;
  
  fs.writeFileSync(VERSION_PATH, versionTsContent, 'utf8');
  console.log(`✅ lib/version.ts updated successfully!`);
  
} catch (error) {
  console.error('❌ Error updating version:', error.message);
  process.exit(1);
}
