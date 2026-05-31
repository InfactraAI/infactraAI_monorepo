const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId:       { type: String, default: 'default_user' },
  accessToken:  String,
  refreshToken: String,
  updatedAt:    Date,
});

module.exports = mongoose.model('Token', tokenSchema);
