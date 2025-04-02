// Simple deployment web server to expose port 5000
require('dotenv').config();
const express = require('express');
const app = express();
const port = 5000;

// Keep the server alive
function keepAlive() {
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    console.log(`✅ Keep-alive ping: ${res.statusCode}`);
  });
  
  req.on('error', (error) => {
    console.error(`❌ Keep-alive ping failed: ${error.message}`);
  });
  
  req.end();
}

// Run a keep-alive ping every 5 minutes
setInterval(keepAlive, 5 * 60 * 1000);

// Custom logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('The Royal Court Herald is online!');
});

// Status endpoint
app.get('/status', (req, res) => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    environment: 'replit'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Server error: ${err.message}`);
  res.status(500).send('Internal Server Error');
});

// Start the server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Deployment server running on port ${port}`);
  
  // Initial keep-alive ping
  setTimeout(keepAlive, 1000);
});