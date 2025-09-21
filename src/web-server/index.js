const express = require('express');
const http = require('http');
const path = require('path');

// Create Express app
const app = express();
const server = http.createServer(app);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../public')));

// Configuration
const PORT = process.env.WEB_PORT || 3000;

// Start server
server.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

module.exports = { app, server };
