#!/usr/bin/env node

/**
 * Copy PDFKit font data files to standalone build
 * Run this after `npm run build` to ensure PDFKit works in standalone output
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../node_modules/pdfkit/js/data');
const targetDir = path.join(__dirname, '../.next/server/chunks/data');

console.log('Copying PDFKit font files...');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

// Copy font files
if (fs.existsSync(sourceDir)) {
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;

  files.forEach(file => {
    if (file.endsWith('.afm') || file.endsWith('.pfb')) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
      console.log(`Copied: ${file}`);
    }
  });

  console.log(`✅ Copied ${copiedCount} PDFKit font files to ${targetDir}`);
} else {
  console.error(`❌ Source directory not found: ${sourceDir}`);
  process.exit(1);
}
