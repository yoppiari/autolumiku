#!/usr/bin/env tsx
/**
 * Sync Tenant Domains to Traefik Configuration
 *
 * This script reads all active tenants from the database and generates
 * a Traefik configuration file that routes custom domains to the app.
 *
 * Usage:
 *   npm run sync-traefik-domains
 *
 * Or from host:
 *   ssh root@cf.avolut.com "docker exec autolumiku-app npm run sync-traefik-domains"
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration
const TRAEFIK_CONFIG_PATH = '/data/coolify/proxy/dynamic/autolmk.yaml';
const COOLIFY_HOST = 'root@cf.avolut.com';
const SERVICE_NAME = 'app-autoleads';
const CONTAINER_URL = 'http://b8sc48s8s0c4w00008k808w8:3000'; // Update if container changes

interface TenantDomain {
  tenantId: string;
  slug: string;
  name: string;
  domain: string | null;
}

async function getTenantDomains(): Promise<TenantDomain[]> {
  const tenants = await prisma.tenant.findMany({
    where: {
      status: 'active',
      domain: {
        not: null, // Only get tenants with a domain set
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      domain: true,
    },
  });

  return tenants.map((t) => ({
    tenantId: t.id,
    slug: t.slug,
    name: t.name,
    domain: t.domain,
  }));
}

function generateTraefikConfig(tenants: TenantDomain[]): string {
  const routers: string[] = [];
  let priority = 100;

  // Generate explicit routes for each tenant domain
  for (const tenant of tenants) {
    if (!tenant.domain) continue; // Skip if no domain

    const safeName = tenant.slug.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    routers.push(`
    autoleads-${safeName}-http:
      rule: "Host(\`${tenant.domain}\`)"
      service: ${SERVICE_NAME}
      entryPoints: ["http"]
      middlewares: ["https-redirect"]
      priority: ${priority}

    autoleads-${safeName}-https:
      rule: "Host(\`${tenant.domain}\`)"
      service: ${SERVICE_NAME}
      entryPoints: ["https"]
      middlewares: ["compression", "buffering", "security-headers"]
      priority: ${priority}
      tls:
        certResolver: "letsencrypt"
        domains:
          - main: "${tenant.domain}"`);

    priority--;
  }

  return `# AutoLumiku Multi-Tenant Traefik Configuration
# Generated automatically from tenant database
# Last updated: ${new Date().toISOString()}
# To regenerate: npm run traefik:sync
#
# IMPORTANT: All tenant domains must be explicitly configured here
# Each tenant has ONE domain (Tenant.domain) which can be:
# - Subdomain: showroom1.autolumiku.com
# - Custom domain: showroom1.com
# - Any domain pointing to this server
#
# After adding a new tenant domain:
# 1. Update Tenant.domain in database
# 2. Run: npm run traefik:sync
# 3. Point DNS to server IP
# 4. Wait for Let's Encrypt SSL (~2 min)

http:
  routers:
    # ==========================================================================
    # TENANT ROUTES
    # ==========================================================================
    # Each tenant gets explicit HTTP and HTTPS routes with dedicated SSL cert
${routers.join('\n')}

  services:
    ${SERVICE_NAME}:
      loadBalancer:
        servers:
          - url: "${CONTAINER_URL}"
        healthCheck:
          path: "/api/health"
          interval: "30s"
          timeout: "10s"

  middlewares:
    https-redirect:
      redirectScheme:
        scheme: "https"
        permanent: true

    compression:
      compress:
        excludedContentTypes: ["text/event-stream", "application/grpc"]
        minResponseBodyBytes: 1024

    buffering:
      buffering:
        maxRequestBodyBytes: 10485760
        memRequestBodyBytes: 1048576
        maxResponseBodyBytes: 10485760
        memResponseBodyBytes: 1048576
        retryExpression: "IsNetworkError() && Attempts() < 3"

    security-headers:
      headers:
        customRequestHeaders:
          X-Frame-Options: "SAMEORIGIN"
          X-Content-Type-Options: "nosniff"
          X-XSS-Protection: "1; mode=block"
          Referrer-Policy: "strict-origin-when-cross-origin"
        customResponseHeaders:
          X-Powered-By: "AutoLumiku"
`;
}

async function updateTraefikConfig(config: string) {
  try {
    // Check if running inside container (has volume mount) or outside (needs SSH)
    const isInContainer = fs.existsSync(TRAEFIK_CONFIG_PATH);

    if (isInContainer) {
      // Running inside container with volume mount - write directly
      console.log('📝 Writing Traefik configuration to mounted volume...');

      // Create backup first
      const backupPath = `${TRAEFIK_CONFIG_PATH}.backup`;
      if (fs.existsSync(TRAEFIK_CONFIG_PATH)) {
        fs.copyFileSync(TRAEFIK_CONFIG_PATH, backupPath);
        console.log(`💾 Created backup: ${backupPath}`);
      }

      // Write new config
      fs.writeFileSync(TRAEFIK_CONFIG_PATH, config);
      console.log('✅ Traefik configuration updated successfully!');
    } else {
      // Running outside container - use SSH/SCP
      console.log('📤 Uploading Traefik configuration via SSH...');

      const tempFile = path.join('/tmp', `autolmk-${Date.now()}.yaml`);
      fs.writeFileSync(tempFile, config);

      try {
        execSync(`scp ${tempFile} ${COOLIFY_HOST}:${TRAEFIK_CONFIG_PATH}`, {
          stdio: 'inherit',
        });
        fs.unlinkSync(tempFile);
        console.log('✅ Traefik configuration uploaded successfully!');
      } catch (error) {
        fs.unlinkSync(tempFile);
        throw error;
      }
    }

    console.log('🔄 Traefik will auto-reload the configuration in ~30 seconds.');
  } catch (error) {
    console.error('❌ Failed to update Traefik configuration:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔍 Fetching tenant domains from database...');
    const tenants = await getTenantDomains();

    console.log(`📋 Found ${tenants.length} active tenant(s) with domains:`);
    for (const tenant of tenants) {
      console.log(`  - ${tenant.name} (${tenant.slug})`);
      console.log(`    └─ Domain: ${tenant.domain}`);
    }

    console.log('\n⚙️  Generating Traefik configuration...');
    const config = generateTraefikConfig(tenants);

    console.log(`📝 Generated ${config.split('\n').length} lines of configuration`);

    // Check for --no-confirm flag
    const noConfirm = process.argv.includes('--no-confirm');

    // Ask for confirmation in interactive mode (unless --no-confirm)
    if (process.stdin.isTTY && !noConfirm) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        readline.question(
          '\n❓ Update Traefik configuration on Coolify host? (yes/no): ',
          (ans: string) => {
            readline.close();
            resolve(ans.toLowerCase().trim());
          }
        );
      });

      if (answer !== 'yes' && answer !== 'y') {
        console.log('❌ Aborted by user');
        process.exit(0);
      }
    }

    await updateTraefikConfig(config);

    console.log('\n✨ Done! New tenant domains will be accessible in ~30 seconds.');
    console.log('💡 Tip: Point tenant custom domains to this server\'s IP address.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
