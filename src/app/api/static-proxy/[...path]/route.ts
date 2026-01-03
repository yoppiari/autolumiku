/**
 * Static File Proxy API Route
 * Serves URL-encoded static chunk files that Next.js standalone fails to serve consistently
 * Workaround for Next.js multi-threaded filesystem access bug
 *
 * SOLUTION: In-memory cache to avoid repeated filesystem access from multiple threads
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// In-memory cache for file contents
// Populated on first access, persists for process lifetime
const fileCache = new Map<string, Buffer>();

export async function GET(
  request: NextRequest,
  { params }: { params: any }
) {
  try {
    // Reconstruct the path from params
    const { path: pathSegments } = await params;
    const requestedPath = pathSegments.join('/');

    // Decode URL-encoded brackets
    const decodedPath = requestedPath.replace(/%5B/g, '[').replace(/%5D/g, ']');

    // Build filesystem path
    const filePath = join(process.cwd(), '.next', 'static', decodedPath);

    // Check cache first
    let fileContent = fileCache.get(filePath);

    if (!fileContent) {
      console.log(`[Static Proxy] Cache MISS - Loading: ${filePath}`);
      // Use synchronous readFileSync to avoid race conditions across threads
      fileContent = readFileSync(filePath);
      // Store in cache
      fileCache.set(filePath, fileContent);
    } else {
      console.log(`[Static Proxy] Cache HIT: ${filePath}`);
    }

    // Determine content type
    const contentType = requestedPath.endsWith('.js')
      ? 'application/javascript; charset=utf-8'
      : requestedPath.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'application/octet-stream';

    // Return cached file with proper caching headers
    // Use Buffer directly - Next.js handles it correctly
    return new NextResponse(fileContent as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error(`[Static Proxy] Failed to serve file:`, error.message);
    return new NextResponse('Not Found', { status: 404 });
  }
}
