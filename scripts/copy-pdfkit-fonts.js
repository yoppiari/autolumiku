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
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Created directory: ${targetDir}`);
  } catch (err) {
    console.warn(`⚠️  Could not create directory: ${targetDir}`);
    console.warn(`⚠️  Continuing anyway - PDFKit fonts may not work`);
    console.warn(`Error: ${err.message}`);
    // Don't exit - let the build continue
    process.exit(0);
  }
}

// Copy font files
if (fs.existsSync(sourceDir)) {
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;

  files.forEach(file => {
    if (file.endsWith('.afm') || file.endsWith('.pfb')) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      try {
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
        console.log(`Copied: ${file}`);
      } catch (err) {
        console.warn(`⚠️  Failed to copy ${file}: ${err.message}`);
      }
    }
  });

  console.log(`✅ Copied ${copiedCount} PDFKit font files to ${targetDir}`);
} else {
  console.warn(`⚠️  Source directory not found: ${sourceDir}`);
  console.warn(`⚠️  PDFKit fonts may not be available, but continuing build...`);
  // Don't fail the build if fonts are missing
  process.exit(0);
}
