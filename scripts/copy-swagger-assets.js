'use strict';

// Copies the Swagger UI static assets from node_modules/swagger-ui-dist into a
// repo-tracked directory (src/assets/swagger-ui-dist/) so they are always
// included in the Vercel serverless bundle. swagger-ui-express resolves the
// asset directory at runtime, which the Vercel file tracer cannot follow, so
// else they deploy as nothing and /api/docs serves HTML for every asset URL.
// Run after installing/upgrading swagger-ui-express: npm run copy:swagger

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'node_modules', 'swagger-ui-dist');
const DEST = path.join(__dirname, '..', 'src', 'assets', 'swagger-ui-dist');
const FILES = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'favicon-16x16.png',
  'favicon-32x32.png',
];

fs.mkdirSync(DEST, { recursive: true });
for (const file of FILES) {
  fs.copyFileSync(path.join(SOURCE, file), path.join(DEST, file));
}
console.log(`Copied ${FILES.length} Swagger UI assets to ${DEST}`);