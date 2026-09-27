/**
 * Reads a spreadsheet the user picked in Google Drive and normalises it into
 * the same { columns, data } shape the OneDrive Excel path produces, so the
 * existing FileData-backed screens render it with no frontend change.
 *
 * Drive holds two different things people both call "a spreadsheet":
 *   - native Google Sheets  → read with the Sheets API
 *   - uploaded .xlsx/.xls   → the Sheets API refuses these ("must not be an
 *                             Office file"), so download the bytes from Drive
 *                             and parse them locally
 * Both appear in the picker, so both are supported here.
 */
const axios = require('axios');
const XLSX = require('xlsx');

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const NATIVE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

const auth = (accessToken) => ({ headers: { Authorization: `Bearer ${accessToken}` } });

const isNative = (mimeType) => !mimeType || mimeType === NATIVE_SHEET_MIME;

/**
 * Accepts anything a user is likely to paste: a full edit URL, a sharing URL,
 * or the bare id. Google ids are 20+ chars of [A-Za-z0-9_-].
 */
exports.parseSpreadsheetId = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const fromUrl = raw.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (fromUrl) return fromUrl[1];

  // A bare id, but not a URL we failed to understand.
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) return raw;

  return null;
};

exports.NATIVE_SHEET_MIME = NATIVE_SHEET_MIME;
exports.isNative = isNative;

// ─── Office files, via Drive ────────────────────────────────────────────────

/** Downloads an uploaded workbook. drive.file covers files picked in the Picker. */
async function downloadWorkbook(accessToken, fileId) {
  const { data } = await axios.get(`${DRIVE_API}/${encodeURIComponent(fileId)}`, {
    ...auth(accessToken),
    params: { alt: 'media', supportsAllDrives: true },
    responseType: 'arraybuffer',
  });
  return XLSX.read(data, { type: 'buffer' });
}

async function driveFileName(accessToken, fileId) {
  const { data } = await axios.get(`${DRIVE_API}/${encodeURIComponent(fileId)}`, {
    ...auth(accessToken),
    params: { fields: 'name', supportsAllDrives: true },
  });
  return data.name;
}

// ─── Metadata ───────────────────────────────────────────────────────────────

/** Spreadsheet title plus its worksheet tabs, for either file type. */
exports.getMetadata = async (accessToken, fileId, mimeType) => {
  if (!isNative(mimeType)) {
    const [workbook, name] = await Promise.all([
      downloadWorkbook(accessToken, fileId),
      driveFileName(accessToken, fileId),
    ]);
    return {
      title: name || 'Untitled workbook',
      sheets: workbook.SheetNames.map((title, index) => ({ title, index })),
    };
  }

  const { data } = await axios.get(`${SHEETS_API}/${encodeURIComponent(fileId)}`, {
    ...auth(accessToken),
    params: { fields: 'properties.title,sheets.properties(title,index,sheetType)' },
  });

  return {
    title: data.properties?.title || 'Untitled spreadsheet',
    sheets: (data.sheets || [])
      .filter((s) => s.properties?.sheetType === 'GRID' || !s.properties?.sheetType)
      .map((s) => ({ title: s.properties.title, index: s.properties.index })),
  };
};

// ─── Normalisation ──────────────────────────────────────────────────────────

/**
 * Header rows in the wild are messy: blanks, duplicates, stray whitespace.
 * Every column still needs a stable, unique key or rows silently lose fields.
 */
function normaliseHeaders(headerRow) {
  const seen = new Map();

  return headerRow.map((raw, i) => {
    const cleaned = String(raw ?? '').trim();
    let name = cleaned || `Column ${i + 1}`;

    if (seen.has(name)) {
      const n = seen.get(name) + 1;
      seen.set(name, n);
      name = `${name} (${n})`;
    } else {
      seen.set(name, 1);
    }
    return name;
  });
}

/** Rows-of-arrays → { columns, data }. Row 1 is the header. */
function toColumnsAndData(rows) {
  if (!rows.length) return { columns: [], data: [] };

  const columns = normaliseHeaders(rows[0]);

  const data = rows
    .slice(1)
    // Trailing empty cells are omitted, so a blank row can arrive as [].
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i] ?? ''; });
      return obj;
    });

  return { columns, data };
}

// ─── Reading ────────────────────────────────────────────────────────────────

exports.readSheet = async (accessToken, fileId, sheetName, mimeType) => {
  if (!isNative(mimeType)) {
    const workbook = await downloadWorkbook(accessToken, fileId);
    const name = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
    if (!name) return { columns: [], data: [] };

    // header:1 gives rows-of-arrays, matching the Sheets API shape so both
    // paths share one normaliser.
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true });
    return toColumnsAndData(rows);
  }

  // An unqualified A1 range reads the whole grid of that tab; no tab name
  // means the first one, which is what the Sheets API defaults to.
  const range = sheetName ? `'${String(sheetName).replace(/'/g, "''")}'` : undefined;

  const url = range
    ? `${SHEETS_API}/${encodeURIComponent(fileId)}/values/${encodeURIComponent(range)}`
    : `${SHEETS_API}/${encodeURIComponent(fileId)}/values/A:ZZZ`;

  const { data } = await axios.get(url, {
    ...auth(accessToken),
    params: {
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    },
  });

  return toColumnsAndData(data.values || []);
};
