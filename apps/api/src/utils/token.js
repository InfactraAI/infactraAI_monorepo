/**
 * OneDrive token refresh, scoped to an organisation.
 *
 * Credentials come from platform env, so refresh cannot fail for want of
 * config — the previous version read an AzureConfig collection that nothing
 * ever wrote to, which silently killed every connection after an hour.
 */
const axios = require('axios');
const qs = require('querystring');

const UserToken = require('../models/UserToken');
const { encrypt, decrypt } = require('./crypto');

const BUFFER_MS = 5 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function azureConfig() {
  const clientId     = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const tenantId     = process.env.TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    throw httpError(503, 'OneDrive is not configured on the server.');
  }
  return { clientId, clientSecret, tenantId };
}

async function requestRefresh(refreshToken) {
  const { clientId, clientSecret, tenantId } = azureConfig();

  const { data } = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    qs.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data;
}

/** Applies a refresh response to a drive subdocument. Caller saves. */
function applyRefresh(drive, data) {
  drive.accessToken = encrypt(data.access_token);
  if (data.refresh_token) drive.refreshToken = encrypt(data.refresh_token);
  drive.expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
}

exports.getValidAccessToken = async (orgId, accountId) => {
  const conn = await UserToken.findOne({ orgId });
  if (!conn) throw httpError(404, 'OneDrive not connected');

  const drive = conn.oneDrives.find((d) => d.accountId === accountId);
  if (!drive) throw httpError(404, 'OneDrive account not found');

  const stillFresh = drive.expiry && Date.now() < new Date(drive.expiry).getTime() - BUFFER_MS;
  if (stillFresh && drive.accessToken) return decrypt(drive.accessToken);

  if (!drive.refreshToken) throw httpError(401, 'OneDrive connection expired. Please reconnect.');

  const data = await requestRefresh(decrypt(drive.refreshToken));
  applyRefresh(drive, data);
  await conn.save();

  return data.access_token;
};

/** Force-refreshes one drive. Used by the cron job. */
exports.refreshAccessToken = async (conn, drive) => {
  if (!drive.refreshToken) throw new Error('Refresh token missing');

  const data = await requestRefresh(decrypt(drive.refreshToken));
  applyRefresh(drive, data);

  return drive.expiry;
};
