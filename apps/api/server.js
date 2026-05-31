require('dotenv').config();

const mongoose = require('mongoose');

// Start background jobs after env is loaded
require('./src/jobs/tokenRefresh.job');

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('[db] MongoDB connected');

    const server = app.listen(PORT, () => {
      console.log(`[server] Listening on port ${PORT}`);
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────
    const shutdown = (signal) => {
      console.log(`[server] ${signal} received — shutting down`);
      server.close(() => {
        mongoose.connection.close(false).then(() => {
          console.log('[server] Clean exit');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('[db] Connection failed:', err.message);
    process.exit(1);
  });
