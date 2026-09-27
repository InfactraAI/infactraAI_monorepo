const FileData = require('../../models/FileData');
const GoogleConnection = require('../../models/GoogleConnection');
const googleAuth = require('../../utils/googleAuth');
const { getMetadata, readSheet, parseSpreadsheetId } = require('../../utils/sheetsParser');
const googleErrors = require('../../utils/googleErrors');

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost';

/** Where the OAuth round-trip lands the user back in the SPA. */
const returnTo = (params) =>
  `${frontendUrl()}/google-sheets-config?${new URLSearchParams(params).toString()}`;

const publicSheet = (s) => ({
  id:             s._id,
  spreadsheetId:  s.spreadsheetId,
  title:          s.title,
  sheetName:      s.sheetName || null,
  department:     s.department,
  lastSyncedAt:   s.lastSyncedAt,
  lastSyncStatus: s.lastSyncStatus,
  lastSyncError:  s.lastSyncError || null,
  rowCount:       s.rowCount,
});

/**
 * Turns an axios failure into something a person can act on. Google states the
 * real reason in the response body; without this the user sees only
 * "Request failed with status code 400".
 */
function describeGoogleFailure(err) {
  if (googleErrors.isApiDisabled(err)) {
    const which = /drive/i.test(err.response?.data?.error?.message || '') ? 'Drive' : 'Sheets';
    const e = new Error(
      `The Google ${which} API is not enabled for this server's Google Cloud project. ` +
      `An administrator needs to enable it, then retry.`
    );
    e.status = 503;
    return e;
  }

  const wrapped = googleErrors.wrap(err);

  // A token minted before spreadsheets.readonly was added cannot read a pasted
  // sheet. Google's wording ("insufficient authentication scopes") tells the
  // user nothing actionable.
  if (/insufficient authentication scopes/i.test(err.response?.data?.error?.message || '')) {
    const e = new Error(
      'Your Google connection was made before this feature existed. ' +
      'Click Disconnect, then Continue with Google to re-authorise.'
    );
    e.status = 403;
    return e;
  }

  if (err.response?.status === 404) {
    const e = new Error(
      'That spreadsheet could not be opened. Check the link is right and that ' +
      'the connected Google account has access to it.'
    );
    e.status = 404;
    return e;
  }

  if (/must not be an Office file/i.test(wrapped.message)) {
    wrapped.message =
      'That file is an uploaded Excel workbook rather than a Google Sheet. ' +
      'Enable the Google Drive API for this server, or open it in Sheets and ' +
      'choose File → Save as Google Sheets, then pick it again.';
  }
  return wrapped;
}

// ─── Status ─────────────────────────────────────────────────────────────────

exports.status = async (req, res, next) => {
  try {
    const conn = await GoogleConnection.findOne({ orgId: req.orgId });

    res.json({
      configured: googleAuth.isConfigured(),
      connected: Boolean(conn?.refreshToken),
      email: conn?.email || null,
      connectedAt: conn?.createdAt || null,
      sheets: (conn?.sheets || []).map(publicSheet),
    });
  } catch (err) {
    next(err);
  }
};

// ─── OAuth ──────────────────────────────────────────────────────────────────

/**
 * Returns the consent URL rather than redirecting, because the SPA calls this
 * with a Bearer token — a redirect would drop the header. The frontend then
 * navigates to the URL itself.
 */
exports.authUrl = (req, res, next) => {
  try {
    res.json(googleAuth.buildAuthUrl(req.orgId, req.userId));
  } catch (err) {
    next(err);
  }
};

/** Google redirects the browser here. Identity comes from the signed state. */
exports.callback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(returnTo({ google: 'error', reason: error }));
  }
  if (!code) {
    return res.redirect(returnTo({ google: 'error', reason: 'missing_code' }));
  }

  try {
    const { orgId, uid } = googleAuth.verifyState(state);
    const tokens = await googleAuth.exchangeCode(code);
    await googleAuth.saveConnection(orgId, uid, tokens);

    res.redirect(returnTo({ google: 'connected', email: tokens.email || '' }));
  } catch (err) {
    const reason = err.response?.data?.error_description || err.message || 'connect_failed';
    res.redirect(returnTo({ google: 'error', reason }));
  }
};

exports.disconnect = async (req, res, next) => {
  try {
    await googleAuth.revokeAndDelete(req.orgId);
    res.json({ message: 'Google account disconnected' });
  } catch (err) {
    next(err);
  }
};

// ─── Picker ─────────────────────────────────────────────────────────────────

/**
 * Everything the Google Picker needs, minted per request. The access token is
 * short-lived and scoped to drive.file, and the client ID / API key / project
 * number are public identifiers by design — the client secret never leaves
 * the server.
 */
exports.pickerConfig = async (req, res, next) => {
  try {
    const { clientId } = googleAuth.config();
    const apiKey = process.env.GOOGLE_API_KEY;
    const appId = process.env.GOOGLE_PROJECT_NUMBER;

    if (!apiKey || !appId) {
      const err = new Error(
        'Google Picker is not configured. Set GOOGLE_API_KEY and GOOGLE_PROJECT_NUMBER.'
      );
      err.status = 503;
      throw err;
    }

    res.json({
      clientId,
      apiKey,
      appId,
      accessToken: await googleAuth.getValidAccessToken(req.orgId),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Sheets ─────────────────────────────────────────────────────────────────

/** Worksheet tabs for a picked spreadsheet, so the user can choose one. */
exports.listTabs = async (req, res, next) => {
  try {
    const accessToken = await googleAuth.getValidAccessToken(req.orgId);
    const id = parseSpreadsheetId(req.params.spreadsheetId);
    if (!id) return res.status(400).json({ message: 'Invalid spreadsheet reference' });

    const meta = await getMetadata(accessToken, id, req.query.mimeType);
    res.json({ title: meta.title, sheets: meta.sheets });
  } catch (err) {
    next(describeGoogleFailure(err));
  }
};

/**
 * Pulls a sheet into FileData under the given department.
 *
 * A department holds one dataset at a time — syncing replaces whatever is
 * there, whether it came from OneDrive or another sheet. Same rule the
 * OneDrive importer already follows.
 */
async function pullIntoFileData(accessToken, { orgId, spreadsheetId, sheetName, department, title, mimeType }) {
  const { columns, data } = await readSheet(accessToken, spreadsheetId, sheetName, mimeType);

  if (!columns.length) {
    const err = new Error('That sheet appears to be empty — no header row found.');
    err.status = 400;
    throw err;
  }

  // fileName carries a unique index, so keep Google rows in their own
  // namespace and clear the department first to avoid colliding with an
  // existing OneDrive document.
  const fileName = `${title} · ${department} (Google Sheets)`;

  await FileData.deleteMany({ orgId, department });
  await FileData.create({
    orgId,
    fileName,
    fileType: department,
    department,
    columns,
    data,
  });

  return { columns, rowCount: data.length };
}

exports.selectSheet = async (req, res, next) => {
  try {
    const { department, sheetName, mimeType } = req.body;

    // The Picker sends an id; the paste field sends whatever the user copied.
    const spreadsheetId = parseSpreadsheetId(req.body.spreadsheetId || req.body.url);

    if (!spreadsheetId) {
      return res.status(400).json({
        message: "That doesn't look like a Google Sheets link. Paste the URL from your browser's address bar.",
      });
    }
    if (!department) {
      return res.status(400).json({ message: 'department is required' });
    }

    const conn = await GoogleConnection.findOne({ orgId: req.orgId });
    if (!conn) return res.status(404).json({ message: 'Google account not connected' });

    const accessToken = await googleAuth.getValidAccessToken(req.orgId);
    const meta = await getMetadata(accessToken, spreadsheetId, mimeType);

    const { rowCount } = await pullIntoFileData(accessToken, {
      orgId: req.orgId,
      spreadsheetId,
      sheetName,
      department,
      mimeType,
      title: meta.title,
    });

    const entry = {
      spreadsheetId,
      title: meta.title,
      sheetName: sheetName || '',
      mimeType: mimeType || '',
      department,
      lastSyncedAt: new Date(),
      lastSyncStatus: 'ok',
      lastSyncError: undefined,
      rowCount,
    };

    // One sheet per department — re-picking replaces the previous choice.
    const idx = conn.sheets.findIndex((s) => s.department === department);
    if (idx > -1) conn.sheets[idx].set(entry);
    else conn.sheets.push(entry);

    await conn.save();

    res.json({
      message: `Imported ${rowCount} rows from "${meta.title}"`,
      sheet: publicSheet(conn.sheets.find((s) => s.department === department)),
    });
  } catch (err) {
    next(describeGoogleFailure(err));
  }
};

exports.syncSheet = async (req, res, next) => {
  try {
    const conn = await GoogleConnection.findOne({ orgId: req.orgId });
    if (!conn) return res.status(404).json({ message: 'Google account not connected' });

    const sheet = conn.sheets.id(req.params.id);
    if (!sheet) return res.status(404).json({ message: 'Sheet not found' });

    try {
      const accessToken = await googleAuth.getValidAccessToken(req.orgId);
      const { rowCount } = await pullIntoFileData(accessToken, {
        orgId: req.orgId,
        spreadsheetId: sheet.spreadsheetId,
        sheetName: sheet.sheetName,
        department: sheet.department,
        mimeType: sheet.mimeType,
        title: sheet.title,
      });

      sheet.lastSyncedAt = new Date();
      sheet.lastSyncStatus = 'ok';
      sheet.lastSyncError = undefined;
      sheet.rowCount = rowCount;
      await conn.save();

      res.json({ message: `Synced ${rowCount} rows`, sheet: publicSheet(sheet) });
    } catch (syncErr) {
      // Record the failure against the sheet so the UI can show why, then
      // surface it normally.
      const described = describeGoogleFailure(syncErr);
      sheet.lastSyncStatus = 'error';
      sheet.lastSyncError = described.message;
      await conn.save();
      throw described;
    }
  } catch (err) {
    next(err);
  }
};

exports.removeSheet = async (req, res, next) => {
  try {
    const conn = await GoogleConnection.findOne({ orgId: req.orgId });
    if (!conn) return res.status(404).json({ message: 'Google account not connected' });

    const sheet = conn.sheets.id(req.params.id);
    if (!sheet) return res.status(404).json({ message: 'Sheet not found' });

    const { department } = sheet;
    conn.sheets.pull({ _id: sheet._id });
    await conn.save();
    await FileData.deleteMany({ orgId: req.orgId, department });

    res.json({ message: 'Sheet removed' });
  } catch (err) {
    next(err);
  }
};
