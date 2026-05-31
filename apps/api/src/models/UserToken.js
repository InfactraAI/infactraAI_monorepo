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

const userTokenSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true, unique: true, index: true },
    oneDrives: [oneDriveSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserToken', userTokenSchema);
