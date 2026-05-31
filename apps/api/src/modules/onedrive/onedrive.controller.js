const axios = require('axios');
const qs = require('querystring');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

const UserToken = require('../../models/UserToken');
const FileData = require('../../models/FileData');
const { getValidAccessToken } = require('../../utils/token');
const { parseExcelFromUrl } = require('../../utils/fileParser');

// ─── OAuth login redirect ─────────────────────────────────────────────────

exports.login = (req, res) => {
  const { clientId, clientSecret, redirectUri, department, userId } = req.query;
  const tenantId = 'common';

  const state = Buffer.from(
    JSON.stringify({ tenantId, clientId, clientSecret, redirectUri, department, userId })
  ).toString('base64');

  const url =
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    qs.stringify({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri?.trim(),
      response_mode: 'query',
      scope: 'User.Read Files.Read Files.Read.All offline_access',
      state,
    });

  res.redirect(url);
};

// ─── OAuth callback ───────────────────────────────────────────────────────

exports.callback = async (req, res, next) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const { tenantId, clientId, clientSecret, redirectUri, department, userId } = JSON.parse(
      Buffer.from(state, 'base64').toString()
    );
    if (!userId) return res.status(400).send('Missing userId');

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

    let user = await UserToken.findOne({ userId });
    if (!user) user = new UserToken({ userId, oneDrives: [] });

    user.oneDrives.forEach((d) => { d.active = false; });

    const drive = {
      accountId, email, accessToken: access_token, refreshToken: refresh_token,
      department, expiry: new Date(Date.now() + (expires_in || 3600) * 1000), active: true,
    };

    const idx = user.oneDrives.findIndex((d) => d.accountId === accountId);
    if (idx > -1) user.oneDrives[idx] = drive;
    else user.oneDrives.push(drive);

    await user.save();

    res.redirect(`${process.env.FRONTEND_URL}?login=success`);
  } catch (err) {
    next(err);
  }
};

// ─── List connected drives ────────────────────────────────────────────────

exports.getOneDrives = async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const user = await UserToken.findOne({ userId }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const oneDrives = (user.oneDrives || []).map((d) => ({
      accountId: d.accountId,
      email: d.email,
      expiry: d.expiry,
      department: d.department,
      connected: !!d.refreshToken,
      active: d.active || false,
    }));

    res.json({ success: true, userId, totalAccounts: oneDrives.length, oneDrives });
  } catch (err) {
    next(err);
  }
};

// ─── Sync files from OneDrive → MongoDB ──────────────────────────────────

exports.getFiles = async (req, res, next) => {
  try {
    const { userId, department } = req.query;

    const user = await UserToken.findOne({ userId });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const drive = user.oneDrives.find((d) => d.department === department);
    if (!drive) return res.status(404).json({ message: 'OneDrive not found' });

    const accessToken = await getValidAccessToken(userId, drive.accountId);

    const headers = { Authorization: `Bearer ${accessToken}` };
    const root = await axios.get(
      'https://graph.microsoft.com/v1.0/me/drive/root/children', { headers }
    );

    const folder = root.data.value.find(
      (i) => i.folder && i.name.trim().toLowerCase() === department.trim().toLowerCase()
    );
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const folderItems = await axios.get(
      `https://graph.microsoft.com/v1.0/me/drive/items/${folder.id}/children`, { headers }
    );

    const excelFile = folderItems.data.value.find(
      (f) => f.file && /\.(xlsx|xls|xlsm)$/i.test(f.name)
    );
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

    await FileData.deleteMany({ department });
    const saved = await FileData.findOneAndUpdate(
      { fileName: excelFile.name },
      { $set: { department, fileType: department, fileName: excelFile.name, columns, data: processedData, updatedAt: new Date() } },
      { returnDocument: 'after', upsert: true }
    );

    res.json({ success: true, folderName: folder.name, fileName: excelFile.name, totalRows: processedData.length, data: saved });
  } catch (err) {
    next(err);
  }
};

// ─── Read cached data from MongoDB ───────────────────────────────────────

exports.getInventoryData = async (req, res, next) => {
  try {
    const { department } = req.query;
    const record = await FileData.findOne({ department }, { fileName: 1, columns: 1, data: 1 });
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

// ─── Download a file from OneDrive ───────────────────────────────────────

exports.downloadFile = async (req, res, next) => {
  try {
    const token = await getValidAccessToken(req.userId, req.query.accountId);
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
