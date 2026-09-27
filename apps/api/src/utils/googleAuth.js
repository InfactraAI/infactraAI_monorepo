/**
 * Google OAuth2 helper.
 *
 * The app owns a single Google Cloud OAuth client (env). Users never see or
 * supply a credential — they click Connect, approve on Google's screen, and
 * come back. Refresh credentials therefore always exist server-side.
 */
const axios = require('axios');
const qs = require('querystring');

const GoogleConnection = require('../models/GoogleConnection');
const { encrypt, decrypt } = require('./crypto');
const oauthState = require('./oauthState');

const AUTH_URL     = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const REVOKE_URL   = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * drive.file grants access only to files handed to us through the Picker —
 * the narrowest option, but it cannot authorise a spreadsheet the user pastes
 * a link to, because that file was never "opened by the app".
 *
 * spreadsheets.readonly covers the paste path. It is a *sensitive* scope
 * (Google brand review before publishing to external users) but NOT a
 * *restricted* one, so it still avoids the annual CASA security assessment
 * that drive.readonly would trigger. Read-only, spreadsheets only — it cannot
 * see the rest of Drive.
 */
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
].join(' ');

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const STATE_PURPOSE = 'google-oauth';

const FORM = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Reads and validates server-side Google config. Throws 503 if unconfigured. */
function config() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw httpError(
      503,
      'Google Sheets is not configured on the server. Set GOOGLE_CLIENT_ID, ' +
      'GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.'
    );
  }
  return { clientId, clientSecret, redirectUri };
}

exports.SCOPES = SCOPES;
exports.config = config;

exports.isConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

// ─── Consent URL ────────────────────────────────────────────────────────────

/**
 * The browser navigates away for OAuth, so the Authorization header is lost.
 * We carry identity in a short-lived signed state token instead of trusting a
 * userId query param.
 */
exports.buildAuthUrl = (orgId, userId) => {
  const { clientId, redirectUri } = config();

  const state = oauthState.sign(STATE_PURPOSE, { orgId, uid: userId });

  const url = `${AUTH_URL}?${qs.stringify({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    // offline + consent guarantees a refresh_token on every connect. Without
    // prompt=consent Google only returns one on the very first authorisation,
    // and the connection dies an hour later with no way to recover.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })}`;

  return { url, state };
};

exports.verifyState = (state) => oauthState.verify(STATE_PURPOSE, state);

// ─── Code exchange ──────────────────────────────────────────────────────────

exports.exchangeCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = config();

  const { data } = await axios.post(
    TOKEN_URL,
    qs.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    FORM
  );

  const { data: profile } = await axios.get(USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in || 3600,
    scope:        data.scope,
    accountId:    profile.sub,
    email:        profile.email,
  };
};

/** Upserts the connection, preserving already-picked sheets on reconnect. */
exports.saveConnection = async (orgId, userId, tokens) => {
  const existing = await GoogleConnection.findOne({ orgId });

  const update = {
    orgId,
    connectedByUserId: userId,
    googleAccountId: tokens.accountId,
    email:           tokens.email,
    accessToken:     encrypt(tokens.accessToken),
    expiry:          new Date(Date.now() + tokens.expiresIn * 1000),
    scope:           tokens.scope,
  };

  // Google omits refresh_token on some re-consents — never clobber a good one.
  if (tokens.refreshToken) update.refreshToken = encrypt(tokens.refreshToken);

  // A different Google account replaces the picked sheets, since drive.file
  // grants from the old account no longer apply.
  if (existing && existing.googleAccountId && existing.googleAccountId !== tokens.accountId) {
    update.sheets = [];
  }

  return GoogleConnection.findOneAndUpdate({ orgId }, { $set: update }, { upsert: true, returnDocument: 'after' });
};

// ─── Access tokens ──────────────────────────────────────────────────────────

/**
 * Returns a usable access token, refreshing inside a 5-minute buffer.
 * Refresh credentials come from env, so this cannot fail for want of config
 * the way the OneDrive equivalent does.
 */
exports.getValidAccessToken = async (orgId) => {
  const conn = await GoogleConnection.findOne({ orgId });
  if (!conn) throw httpError(404, 'Google account not connected');

  const stillFresh = conn.expiry && Date.now() < new Date(conn.expiry).getTime() - REFRESH_BUFFER_MS;
  if (stillFresh && conn.accessToken) return decrypt(conn.accessToken);

  if (!conn.refreshToken) {
    throw httpError(401, 'Google connection expired. Please reconnect.');
  }

  const { clientId, clientSecret } = config();

  let data;
  try {
    ({ data } = await axios.post(
      TOKEN_URL,
      qs.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decrypt(conn.refreshToken),
        grant_type: 'refresh_token',
      }),
      FORM
    ));
  } catch (err) {
    // invalid_grant = user revoked access, or the token was rotated out.
    if (err.response?.data?.error === 'invalid_grant') {
      conn.accessToken = undefined;
      conn.refreshToken = undefined;
      conn.expiry = undefined;
      await conn.save();
      throw httpError(401, 'Google access was revoked. Please reconnect.');
    }
    throw err;
  }

  conn.accessToken = encrypt(data.access_token);
  if (data.refresh_token) conn.refreshToken = encrypt(data.refresh_token);
  conn.expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  await conn.save();

  return data.access_token;
};

// ─── Disconnect ─────────────────────────────────────────────────────────────

exports.revokeAndDelete = async (orgId) => {
  const conn = await GoogleConnection.findOne({ orgId });
  if (!conn) return false;

  const token = conn.refreshToken || conn.accessToken;
  if (token) {
    // Best effort — a revoked or already-expired token still 400s here.
    try {
      await axios.post(REVOKE_URL, qs.stringify({ token: decrypt(token) }), FORM);
    } catch {
      /* ignore */
    }
  }

  await GoogleConnection.deleteOne({ orgId });
  return true;
};
