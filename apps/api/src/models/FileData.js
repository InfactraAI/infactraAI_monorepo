const mongoose = require('mongoose');

const FileDataSchema = new mongoose.Schema(
  {
    fileType:   String,
    department: String,
    fileName:   { type: String, unique: true },
    columns:    [String],
    data:       [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true }
);

module.exports = mongoose.model('FileData', FileDataSchema);
