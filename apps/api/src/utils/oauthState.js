const jwt = require('jsonwebtoken');

/**
 * OAuth redirects leave the SPA, so the Authorization header is lost on the
 * way back. Identity travels in a short-lived signed state token instead of a
 * query parameter a caller could forge.
 */
const STATE_TTL = '10m';

exports.sign = (purpose, claims) =>
  jwt.sign({ ...claims, purpose }, process.env.JWT_SECRET, { expiresIn: STATE_TTL });

exports.verify = (purpose, state) => {
  if (!state) {
    const err = new Error('Missing state');
    err.status = 400;
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    const err = new Error('Authorisation link expired. Please try connecting again.');
    err.status = 400;
    throw err;
  }

  if (payload.purpose !== purpose) {
    const err = new Error('Invalid state');
    err.status = 400;
    throw err;
  }
  return payload;
};
