const mongoose = require('mongoose');

/**
 * A pending invitation to join an organisation.
 *
 * Only the SHA-256 hash of the token is stored — the raw value exists solely
 * in the emailed link, so a database read cannot be replayed into an account.
 * Same approach as the password-reset flow.
 */
const invitationSchema = new mongoose.Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email:     { type: String, required: true, lowercase: true, trim: true },
    role:      { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    tokenHash: { type: String, required: true, index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status:    { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending', index: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
  },
  { timestamps: true }
);

// One live invitation per email per organisation. Re-inviting replaces it.
invitationSchema.index(
  { orgId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('Invitation', invitationSchema);
