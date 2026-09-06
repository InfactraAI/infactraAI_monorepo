const mongoose = require('mongoose');

// One picked spreadsheet, bound to a department so the existing
// FileData-backed screens (inventory, hr) can render it.
const selectedSheetSchema = new mongoose.Schema(
  {
    spreadsheetId: { type: String, required: true },
    title:         String,
    sheetName:     String, // worksheet/tab; empty = first tab
    mimeType:      String, // native Google Sheet vs uploaded .xlsx
    department:    { type: String, required: true },
    lastSyncedAt:  Date,
    lastSyncStatus: { type: String, enum: ['ok', 'error'], default: 'ok' },
    lastSyncError:  String,
    rowCount:      { type: Number, default: 0 },
  },
  { timestamps: true }
);

/**
 * A Google connection belongs to the organisation, so any teammate can sync
 * the data — but it records which user authorised it.
 *
 * Tokens are stored encrypted (utils/crypto). The OAuth *app* credentials are
 * platform config in env: tenants never supply a client ID or secret, which is
 * what keeps the connect flow two clicks.
 */
const googleConnectionSchema = new mongoose.Schema(
  {
    orgId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
    connectedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    googleAccountId:  String,
    email:            String,
    accessToken:      String,
    refreshToken:     String,
    expiry:           Date,
    scope:            String,
    sheets:           [selectedSheetSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('GoogleConnection', googleConnectionSchema);
