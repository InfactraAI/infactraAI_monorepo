const mongoose = require('mongoose');

/**
 * The tenant. Every other collection hangs off an orgId, and every query is
 * scoped by the orgId carried in the caller's JWT.
 *
 * Absorbs what the old singleton Company model held (name + logo), so an
 * organisation owns its own branding instead of the whole install sharing one.
 */
const organizationSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    logo:    { type: String, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    active:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
