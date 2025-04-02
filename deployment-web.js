// Simple deployment web server to expose port 5000
require('dotenv').config();
const express = require('express');
const app = express();
const port = 5000;

// Keep the server alive
const keepAlive = () => {
  console.log('Keep-alive ping at ' + new Date().toISOString());
};
// Run every 5 minutes
setInterval(keepAlive, 5 * 60 * 1000);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Discord bot is running!');
});

// Required for Replit - ping endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Public status page
app.get('/status', (req, res) => {
  // Get current status information
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  
  // Memory usage
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'online',
    server_time: new Date().toISOString(),
    uptime: uptimeFormatted,
    uptime_seconds: uptime,
    environment: 'replit',
    version: '1.0.0',
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  // Get current status
  const startTime = new Date().toISOString();
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  res.send(`
    <html>
      <head>
        <title>Discord Bot Deployment</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #36393f; /* Discord dark background */
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #dcddde; /* Discord text color */
          }
          .container {
            max-width: 800px;
            width: 100%;
            background-color: #2f3136; /* Discord darker background */
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
            border: 1px solid #202225; /* Discord border color */
          }
          h1 { 
            color: #ffffff; 
            margin-bottom: 20px;
          }
          .status { 
            padding: 10px; 
            border-radius: 5px; 
            margin: 10px 0;
            background-color: #57F287;
            color: white;
            display: inline-block;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .info-box {
            background-color: #40444b;
            border-radius: 5px;
            padding: 15px;
            border: 1px solid #202225;
          }
          .info-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #ffffff;
          }
          .info-value {
            color: #b9bbbe;
          }
          p {
            color: #b9bbbe; /* Discord secondary text color */
            margin-bottom: 15px;
            line-height: 1.5;
          }
          @media (max-width: 600px) {
            .info-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
        <script>
          // Auto refresh the page every 30 seconds
          setTimeout(() => {
            window.location.reload();
          }, 30000);
        </script>
      </head>
      <body>
        <div class="container">
          <h1>The Royal Court Herald - Deployment</h1>
          <div class="status">Status: Online</div>
          <p>The Discord bot is currently running in Replit deployment environment.</p>
          
          <div class="info-grid">
            <div class="info-box">
              <div class="info-title">Server Time</div>
              <div class="info-value">${startTime}</div>
            </div>
            <div class="info-box">
              <div class="info-title">Uptime</div>
              <div class="info-value">${uptimeFormatted}</div>
            </div>
            <div class="info-box">
              <div class="info-title">Environment</div>
              <div class="info-value">Replit</div>
            </div>
            <div class="info-box">
              <div class="info-title">Version</div>
              <div class="info-value">1.0.0</div>
            </div>
          </div>
          
          <p>This deployment page auto-refreshes every 30 seconds.</p>
        </div>
      </body>
    </html>
  `);
});

// Start the server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Web server running on port ${port}`);
  
  // Immediately make a request to the health endpoint to confirm it's working
  const http = require('http');
  const startTime = Date.now();
  
  setTimeout(() => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      const endTime = Date.now();
      console.log(`✅ Health check response: ${res.statusCode} in ${endTime - startTime}ms`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Health check response body: ${data}`);
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Health check request failed: ${error.message}`);
    });
    
    req.end();
  }, 500); // Wait 500ms before checking to give the server time to start
});