#!/usr/bin/env node

/**
 * Script to check for hardcoded values in the codebase
 * This script is run as part of pre-commit hooks and CI/CD
 */

const fs = require('fs');
const path = require('path');

// Patterns to check for hardcoded values
const patterns = [
  {
    regex: /tenantId:\s*['"]tenant-/g,
    message: 'Hardcoded tenant ID (tenant-*)',
    severity: 'error',
  },
  {
    regex: /tenantId:\s*['"][0-9a-f]{8}-[0-9a-f]{4}-/g,
    message: 'Hardcoded tenant ID (UUID)',
    severity: 'error',
  },
  {
    regex: /userId:\s*['"]user-/g,
    message: 'Hardcoded user ID (user-*)',
    severity: 'error',
  },
  {
    regex: /authorId:\s*['"]user-/g,
    message: 'Hardcoded author ID (user-*)',
    severity: 'error',
  },
];

// Files/directories to exclude
const excludePaths = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'docs/coding-standards', // Exclude documentation
  'scripts', // Exclude scripts directory
  '__tests__', // Exclude tests
  'test',
];

let hasViolations = false;
let violationCount = 0;

function shouldSkipPath(filePath) {
  return excludePaths.some(exclude => filePath.includes(exclude));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  patterns.forEach(({ regex, message, severity }) => {
    lines.forEach((line, index) => {
      // Skip comments and documentation
      if (line.includes('// TODO') ||
          line.includes('// ✅') ||
          line.includes('// ❌') ||
          line.includes('// MOCK_DATA') ||
          line.includes('From auth context') ||
          line.trim().startsWith('*') ||
          line.trim().startsWith('//')) {
        return;
      }

      regex.lastIndex = 0; // Reset regex state
      if (regex.test(line)) {
        if (!hasViolations) {
          console.error(''); // Add newline before first error
        }

        console.error(`${severity === 'error' ? '❌' : '⚠️'} ${message}:`);
        console.error(`  ${filePath}:${index + 1}:${line.trim()}`);
        violationCount++;

        if (severity === 'error') {
          hasViolations = true;
        }
      }
    });
  });
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);

    if (shouldSkipPath(fullPath)) {
      return;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(fullPath);
    }
  });
}

console.log('🔍 Checking for hardcoded values...\n');

const srcPath = path.join(process.cwd(), 'src');
if (fs.existsSync(srcPath)) {
  scanDirectory(srcPath);
}

console.log('');

if (hasViolations) {
  console.error(`\n🚫 Found ${violationCount} hardcoding violation(s)`);
  console.error('\n💡 Fix guide:');
  console.error('   - Use useAuth() hook to get user.tenantId and user.id');
  console.error('   - Never hardcode tenant IDs or user IDs');
  console.error('   - Refer to docs/coding-standards/NO-HARDCODING-POLICY.md\n');
  process.exit(1);
}

console.log('✅ No hardcoded values found!');
console.log('');
process.exit(0);
