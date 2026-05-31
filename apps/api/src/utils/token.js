/**
 * Merged token utility.
 * getValidAccessToken  — used by controllers (refresh only when near-expiry)
 * refreshAccessToken   — used by the cron job (force-refresh)
 */
const axios = require('axios');
const qs = require('querystring');

const UserToken = require('../models/UserToken');
const AzureConfig = require('../models/AzureConfig');

const BUFFER_MS = 5 * 60 * 1000; // 5 min

// ─── helpers ────────────────────────────────────────────────────────────────

async function _doRefresh(drive, clientId, clientSecret, tenantId = 'common') {
  const response = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    qs.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: drive.refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data;
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Returns a valid access token, refreshing if within the 5-min buffer.
 * Reads Azure credentials from the AzureConfig collection.
 */
exports.getValidAccessToken = async (userId, accountId) => {
  const user = await UserToken.findOne({ userId });
  if (!user) throw new Error('User not found');

  const drive = user.oneDrives.find((d) => d.accountId === accountId);
  if (!drive) throw new Error('OneDrive account not found');

  const isExpired = Date.now() >= new Date(drive.expiry).getTime() - BUFFER_MS;
  if (!isExpired) return drive.accessToken;

  const config = await AzureConfig.findOne({ userId });
  if (!config) throw new Error('Azure config not found for user');

  const { access_token, refresh_token, expires_in } = await _doRefresh(
    drive,
    config.clientId,
    config.clientSecret,
    config.tenantId
  );

  await UserToken.updateOne(
    { userId },
    {
      $set: {
        'oneDrives.$[od].accessToken': access_token,
        'oneDrives.$[od].refreshToken': refresh_token || drive.refreshToken,
        'oneDrives.$[od].expiry': new Date(Date.now() + expires_in * 1000),
      },
    },
    { arrayFilters: [{ 'od.accountId': accountId }] }
  );

  return access_token;
};

/**
 * Force-refreshes a token (used by the cron job).
 * Falls back to env-level credentials if drive doesn't carry them.
 */
exports.refreshAccessToken = async (userId, accountId) => {
  const user = await UserToken.findOne({ userId });
  if (!user) throw new Error('User not found');

  const drive = user.oneDrives.find((d) => d.accountId === accountId);
  if (!drive) throw new Error('OneDrive not found');
  if (!drive.refreshToken) throw new Error('Refresh token missing');

  const clientId = drive.clientId || process.env.CLIENT_ID;
  const clientSecret = drive.clientSecret || process.env.CLIENT_SECRET;

  const { access_token, refresh_token, expires_in } = await _doRefresh(
    drive,
    clientId,
    clientSecret
  );

  drive.accessToken = access_token;
  drive.refreshToken = refresh_token || drive.refreshToken;
  drive.expiry = new Date(Date.now() + expires_in * 1000);
  await user.save();

  return { accessToken: access_token, expiry: drive.expiry };
};
