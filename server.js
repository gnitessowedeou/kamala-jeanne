/**
 * ==============================================================================
 * VANDIA AI — SECURE LOCAL SERVER ENGINE
 * Hardened against: Path Traversal, Sensitive File Disclosure (.env, .git),
 * Clickjacking, MIME Confusion, and Unsupported HTTP Methods.
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.resolve(__dirname);

// Whitelist strict MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Security Headers applied to every response
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

const server = http.createServer((req, res) => {
  // 1. Restrict HTTP Methods: only GET and HEAD are allowed
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Method Not Allowed');
  }

  // 2. Parse and normalize requested path
  const parsedUrl = req.url.split('?')[0];
  const decodedPath = decodeURIComponent(parsedUrl);
  const normalizedPath = path.normalize(decodedPath === '/' ? '/index.html' : decodedPath);

  // 3. Security: Block Path Traversal (Directory Traversal CWE-22)
  const resolvedPath = path.resolve(ROOT_DIR, '.' + normalizedPath);
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Denied: Path Traversal Blocked');
  }

  // 4. Security: Block Sensitive & Hidden Files (.env, .git, .gitignore, etc.)
  const relativeFromRoot = path.relative(ROOT_DIR, resolvedPath);
  const pathParts = relativeFromRoot.split(path.sep);
  const isHiddenOrSensitive = pathParts.some(part => part.startsWith('.') || part.toLowerCase() === '.env' || part.toLowerCase() === 'server.js');
  
  if (isHiddenOrSensitive) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Denied: Protected File');
  }

  // 5. Verify allowed file extensions
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext];
  if (!contentType) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access Denied: Unsupported File Type');
  }

  // 6. Read and serve the file safely
  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }

    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': contentType,
      'Content-Length': stats.size
    });

    if (req.method === 'HEAD') {
      return res.end();
    }

    const stream = fs.createReadStream(resolvedPath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[VANDIA AI] Secure Server running at http://localhost:${PORT}/dashboard.html`);
});
