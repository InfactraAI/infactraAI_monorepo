const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, default: 'Demo Company' },
    logo: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
