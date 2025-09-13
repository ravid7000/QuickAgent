#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Copy manifest and other extension files to dist
const filesToCopy = [
  'public/manifest.json',
  'public/popup.html',
  'public/popup.js',
  'public/content.js',
  'public/content.css'
];

const distDir = 'dist';

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy files
filesToCopy.forEach(file => {
  const fileName = path.basename(file);
  const destPath = path.join(distDir, fileName);
  
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, destPath);
    console.log(`Copied ${file} to ${destPath}`);
  } else {
    console.warn(`File not found: ${file}`);
  }
});

// Check if index.html exists in dist (built by Vite)
const indexHtmlPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  console.log('✓ index.html found in dist folder');
} else {
  console.error('✗ index.html not found in dist folder. Make sure to run "npm run build" first.');
  process.exit(1);
}

// Check if assets folder exists
const assetsPath = path.join(distDir, 'assets');
if (fs.existsSync(assetsPath)) {
  console.log('✓ assets folder found in dist folder');
} else {
  console.error('✗ assets folder not found in dist folder. Make sure to run "npm run build" first.');
  process.exit(1);
}

console.log('Chrome extension build complete!');
console.log('Load the "dist" folder as an unpacked extension in Chrome.');
