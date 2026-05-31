const mongoose = require('mongoose');

const azureConfigSchema = new mongoose.Schema({
  userId:      { type: String, unique: true },
  tenantId:    String,
  clientId:    String,
  clientSecret: String,
  redirectUri: String,
});

module.exports = mongoose.model('AzureConfig', azureConfigSchema);
