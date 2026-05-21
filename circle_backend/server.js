require('dotenv').config();

const http  = require('http');  // plain HTTP — Railway handles HTTPS
const { connectDB } = require('./src/config/db');
const app   = require('./src/app');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB(); // logs success/failure but no longer crashes (fixed in db.js)

  http.createServer(app).listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Circle API running on port ${PORT}`);
  });
}

start();