const rateLimit = require('express-rate-limit');

const message = (m) => ({ message: m });

/**
 * Credential endpoints are the ones worth brute-forcing, so they get a tight
 * per-IP budget. Correct client IPs depend on `trust proxy` being set to the
 * real number of proxy hops in app.js — otherwise every request appears to
 * come from nginx and one attacker exhausts everyone's allowance.
 */
exports.auth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed attempts count against you
  message: message('Too many attempts. Please try again in 15 minutes.'),
});

/** Invitations send mail, so they are a spam vector as well as a cost. */
exports.invites = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many invitations sent. Please try again later.'),
});

/** Backstop for everything else — generous enough not to affect normal use. */
exports.general = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many requests. Please slow down.'),
});
