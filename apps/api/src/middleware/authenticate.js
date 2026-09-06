const jwt = require('jsonwebtoken');

/**
 * Validates the Bearer token and pins the request to a tenant.
 *
 * req.orgId is the scope key for every query behind this middleware — no
 * controller should ever take an org or user id from the query string.
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: missing token' });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);

    // Tokens minted before organisations existed carry no orgId. Reject them
    // rather than letting an unscoped request through.
    if (!payload.orgId) {
      return res.status(401).json({ message: 'Session predates organisations. Please sign in again.' });
    }

    req.userId = payload.id;
    req.userRole = payload.role;
    req.orgId = payload.orgId;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
};
