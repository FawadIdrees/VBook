const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const path = require('path');
const app = express();
app.use(bodyParser.json());
app.use(cors());

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const legacyPublic = path.join(__dirname, 'public');
// Prefer built React frontend when available, fallback to legacy static demo.
app.use(express.static(frontendDist));
app.use(express.static(legacyPublic));

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Require routes as a factory so it can receive `io` and emit events
const routes = require('./routes')(io);
app.use('/api', routes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      // Fallback when frontend has not been built yet.
      res.sendFile(path.join(legacyPublic, 'seatmap.html'));
    }
  });
});

const port = process.env.PORT || 3000;
// Run DB migrations then start server
const { poolPromise } = require('./db');
const { runMigrations } = require('./migrations/init_db');

poolPromise.then(async (pool) => {
  try {
    await runMigrations(pool);
  } catch (e) { console.warn('Migration warning:', e.message || e); }
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}).catch(err => { console.error('DB pool error on startup', err); process.exit(1); });
