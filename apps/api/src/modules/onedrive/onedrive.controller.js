const axios = require('axios');
const qs = require('querystring');

const UserToken = require('../../models/UserToken');
const FileData = require('../../models/FileData');
const { getValidAccessToken } = require('../../utils/token');
const { parseExcelFromUrl } = require('../../utils/fileParser');
const { encrypt } = require('../../utils/crypto');
const oauthState = require('../../utils/oauthState');

const STATE_PURPOSE = 'onedrive-oauth';

function azureConfig() {
  const clientId     = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri  = process.env.REDIRECT_URI;
  const tenantId     = process.env.TENANT_ID || 'common';

  if (!clientId || !clientSecret || !redirectUri) {
    const err = new Error(
      'OneDrive is not configured on the server. Set CLIENT_ID, CLIENT_SECRET and REDIRECT_URI.'
    );
    err.status = 503;
    throw err;
  }
  return { clientId, clientSecret, redirectUri, tenantId };
}

const returnTo = (params) =>
  `${process.env.FRONTEND_URL || 'http://localhost'}/one-drive-config?${new URLSearchParams(params).toString()}`;

// ─── OAuth ──────────────────────────────────────────────────────────────────

/**
 * Returns the consent URL rather than redirecting, so the SPA can call this
 * with its Bearer token and then navigate itself.
 *
 * The Azure app is platform config in env — tenants no longer paste a client
 * secret into a form, and it no longer travels through the URL bar.
 */
exports.login = (req, res, next) => {
  try {
    const { clientId, redirectUri, tenantId } = azureConfig();
    const { department } = req.query;

    if (!department) return res.status(400).json({ message: 'department is required' });

    const state = oauthState.sign(STATE_PURPOSE, {
      orgId: req.orgId,
      uid: req.userId,
      department,
    });

    const url =
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      qs.stringify({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: 'User.Read Files.Read Files.Read.All offline_access',
        state,
      });

    res.json({ url });
  } catch (err) {
    next(err);
  }
};

exports.callback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(returnTo({ onedrive: 'error', reason: error }));
  if (!code) return res.redirect(returnTo({ onedrive: 'error', reason: 'missing_code' }));

  try {
    const { orgId, uid, department } = oauthState.verify(STATE_PURPOSE, state);
    const { clientId, clientSecret, redirectUri, tenantId } = azureConfig();

    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      qs.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    const meRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { id: accountId, userPrincipalName: email } = meRes.data;

    let conn = await UserToken.findOne({ orgId });
    if (!conn) conn = new UserToken({ orgId, userId: uid, oneDrives: [] });
    conn.userId = uid;

    conn.oneDrives.forEach((d) => { d.active = false; });

    const drive = {
      accountId,
      email,
      department,
      accessToken: encrypt(access_token),
      refreshToken: encrypt(refresh_token),
      expiry: new Date(Date.now() + (expires_in || 3600) * 1000),
      active: true,
    };

    const idx = conn.oneDrives.findIndex((d) => d.accountId === accountId);
    if (idx > -1) conn.oneDrives[idx].set(drive);
    else conn.oneDrives.push(drive);

    await conn.save();

    res.redirect(returnTo({ onedrive: 'connected', email: email || '' }));
  } catch (err) {
    const reason = err.response?.data?.error_description || err.message || 'connect_failed';
    res.redirect(returnTo({ onedrive: 'error', reason }));
  }
};

// ─── Connected drives ───────────────────────────────────────────────────────

exports.getOneDrives = async (req, res, next) => {
  try {
    const conn = await UserToken.findOne({ orgId: req.orgId }).lean();

    const oneDrives = (conn?.oneDrives || []).map((d) => ({
      accountId: d.accountId,
      email: d.email,
      expiry: d.expiry,
      department: d.department,
      connected: !!d.refreshToken,
      active: d.active || false,
    }));

    res.json({ success: true, totalAccounts: oneDrives.length, oneDrives });
  } catch (err) {
    next(err);
  }
};

// ─── Sync files from OneDrive → MongoDB ────────────────────────────────────

exports.getFiles = async (req, res, next) => {
  try {
    const { department } = req.query;
    if (!department) return res.status(400).json({ message: 'department is required' });

    const conn = await UserToken.findOne({ orgId: req.orgId });
    if (!conn) return res.status(404).json({ message: 'OneDrive not connected' });

    const drive = conn.oneDrives.find((d) => d.department === department);
    if (!drive) return res.status(404).json({ message: 'No OneDrive connected for that department' });

    const accessToken = await getValidAccessToken(req.orgId, drive.accountId);
    const headers = { Authorization: `Bearer ${accessToken}` };

    const root = await axios.get('https://graph.microsoft.com/v1.0/me/drive/root/children', { headers });

    const folder = root.data.value.find(
      (i) => i.folder && i.name.trim().toLowerCase() === department.trim().toLowerCase()
    );
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const folderItems = await axios.get(
      `https://graph.microsoft.com/v1.0/me/drive/items/${folder.id}/children`, { headers }
    );

    const excelFile = folderItems.data.value.find((f) => f.file && /\.(xlsx|xls|xlsm)$/i.test(f.name));
    if (!excelFile) return res.status(404).json({ message: 'Excel file not found' });

    const rawData = await parseExcelFromUrl(excelFile['@microsoft.graph.downloadUrl']);
    if (!rawData?.length) return res.status(400).json({ message: 'Excel file is empty' });

    const headerRow = rawData[0];
    const headerKeys = Object.keys(headerRow);
    const columns = headerKeys.map((k) => headerRow[k]).filter(Boolean);

    const processedData = rawData.slice(1)
      .filter((row) => Object.keys(row).length > 0)
      .map((row) => {
        const newRow = {};
        headerKeys.forEach((k) => { if (headerRow[k]) newRow[headerRow[k]] = row[k]; });
        return newRow;
      });

    // A department holds one dataset per organisation.
    await FileData.deleteMany({ orgId: req.orgId, department });
    const saved = await FileData.create({
      orgId: req.orgId,
      department,
      fileType: department,
      fileName: excelFile.name,
      columns,
      data: processedData,
    });

    res.json({
      success: true,
      folderName: folder.name,
      fileName: excelFile.name,
      totalRows: processedData.length,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Read cached data ───────────────────────────────────────────────────────

exports.getInventoryData = async (req, res, next) => {
  try {
    const { department } = req.query;

    const record = await FileData.findOne(
      { orgId: req.orgId, department },
      { fileName: 1, columns: 1, data: 1 }
    );
    if (!record) return res.status(404).json({ message: 'Data not found' });

    res.json({
      success: true,
      fileName: record.fileName,
      columns: record.columns,
      data: record.data,
      totalRows: record.data.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Download ───────────────────────────────────────────────────────────────

exports.downloadFile = async (req, res, next) => {
  try {
    const { accountId } = req.query;
    if (!accountId) return res.status(400).json({ message: 'accountId is required' });

    const token = await getValidAccessToken(req.orgId, accountId);

    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/me/drive/items/${req.params.id}/content`,
      { headers: { Authorization: `Bearer ${token}` }, responseType: 'stream' }
    );

    res.setHeader('Content-Disposition', 'attachment');
    response.data.pipe(res);
  } catch (err) {
    next(err);
  }
};
