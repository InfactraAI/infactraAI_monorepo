const mongoose = require('mongoose');

const oneDriveSchema = new mongoose.Schema(
  {
    accountId:    { type: String, required: true },
    email:        String,
    department:   String,
    accessToken:  String,
    refreshToken: String,
    expiry:       Date,
    active:       { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Connections belong to the organisation, not the individual who authorised
// them, so a teammate can sync data a colleague connected. userId records who
// that was.
const userTokenSchema = new mongoose.Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
    userId:    { type: String },
    oneDrives: [oneDriveSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserToken', userTokenSchema);
