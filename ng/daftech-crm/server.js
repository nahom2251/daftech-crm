const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Log the current directory for debugging
console.log('=== SERVER STARTUP DEBUG ===');
console.log('Current directory:', __dirname);

// Try multiple possible paths where Angular files might be
const possiblePaths = [
  path.join(__dirname, 'dist/daftech-crm/browser'),
  path.join(__dirname, 'dist/daftech-crm'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, '../dist/daftech-crm/browser'),
  path.join(__dirname, '../dist/daftech-crm'),
];

let distPath = null;

// Find the first path that actually exists
for (const testPath of possiblePaths) {
  if (fs.existsSync(testPath)) {
    distPath = testPath;
    console.log(`✅ Found dist at: ${distPath}`);
    console.log(`   Files: ${fs.readdirSync(distPath).join(', ')}`);
    break;
  } else {
    console.log(`❌ Path not found: ${testPath}`);
  }
}

if (!distPath) {
  console.error('❌ CRITICAL: Could not find any dist directory!');
  // Fallback to the most common path
  distPath = path.join(__dirname, 'dist/daftech-crm/browser');
  console.log(`   Using fallback path: ${distPath}`);
}

// Serve static files from the found directory
app.use(express.static(distPath));

// All routes fallback to index.html (SPA routing)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`❌ index.html not found at: ${indexPath}`);
    res.status(404).send(`
      <h1>404 - File Not Found</h1>
      <p>Index file not found at: ${indexPath}</p>
      <p>Dist path: ${distPath}</p>
      <p>Current directory: ${__dirname}</p>
    `);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`=== SERVER STARTED ===`);
  console.log(`Server running on port ${port}`);
  console.log(`Serving files from: ${distPath}`);
  console.log(`Visit: http://localhost:${port}`);
});