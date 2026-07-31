const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the Angular build output
app.use(express.static(path.join(__dirname, 'dist/daftech-crm/browser')));

// All routes fallback to index.html (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/daftech-crm/browser/index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});