const cron = require('node-cron');
const UserToken = require('../models/UserToken');
const { refreshAccessToken } = require('../utils/token');

const BUFFER_MS = 5 * 60 * 1000;
let isRefreshing = false;

cron.schedule('*/5 * * * *', async () => {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const users = await UserToken.find({});
    const now = Date.now();

    for (const user of users) {
      let updated = false;

      for (const drive of user.oneDrives) {
        if (!drive.refreshToken) continue;
        if (new Date(drive.expiry).getTime() - now >= BUFFER_MS) continue;

        try {
          const refreshed = await refreshAccessToken(user.userId, drive.accountId);
          drive.accessToken = refreshed.accessToken;
          drive.expiry = refreshed.expiry;
          updated = true;
        } catch (err) {
          console.error(`[tokenRefresh] Failed for ${drive.email}: ${err.message}`);
          drive.accessToken = null;
        }
      }

      if (updated) await user.save();
    }
  } catch (err) {
    console.error('[tokenRefresh] Cron error:', err.message);
  } finally {
    isRefreshing = false;
  }
});
