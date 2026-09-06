const mongoose = require('mongoose');

const FileDataSchema = new mongoose.Schema(
  {
    orgId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fileType:   String,
    department: String,
    fileName:   String,
    columns:    [String],
    data:       [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true }
);

// A department holds one dataset per organisation. fileName was previously
// unique across the whole collection, which meant two organisations could not
// import a workbook of the same name.
FileDataSchema.index({ orgId: 1, department: 1 });
FileDataSchema.index({ orgId: 1, fileName: 1 }, { unique: true });

module.exports = mongoose.model('FileData', FileDataSchema);
