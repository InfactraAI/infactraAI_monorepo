const cron = require('node-cron');
const UserToken = require('../models/UserToken');
const { refreshAccessToken } = require('../utils/token');

const BUFFER_MS = 5 * 60 * 1000;
let isRefreshing = false;

cron.schedule('*/5 * * * *', async () => {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const connections = await UserToken.find({});
    const now = Date.now();

    for (const conn of connections) {
      let dirty = false;

      for (const drive of conn.oneDrives) {
        if (!drive.refreshToken) continue;
        if (drive.expiry && new Date(drive.expiry).getTime() - now >= BUFFER_MS) continue;

        try {
          await refreshAccessToken(conn, drive);
        } catch (err) {
          console.error(`[tokenRefresh] org ${conn.orgId} / ${drive.email}: ${err.message}`);
          drive.accessToken = undefined;
        }
        // Either way the subdocument changed and must be persisted — the
        // previous version only saved on success, so invalidations were lost.
        dirty = true;
      }

      if (dirty) await conn.save();
    }
  } catch (err) {
    console.error('[tokenRefresh] Cron error:', err.message);
  } finally {
    isRefreshing = false;
  }
});
