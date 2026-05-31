const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, trim: true },
    mobile:   { type: String, unique: true, sparse: true, trim: true },
    email:    { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role:     { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    address:  { type: String, default: '' },
    active:   { type: Boolean, default: true },
    resetOtp:       String,
    resetOtpExpiry: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
