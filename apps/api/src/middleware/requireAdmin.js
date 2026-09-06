/**
 * Gates organisation administration. Must run after `authenticate`, which is
 * what puts the role on the request.
 */
module.exports = (req, res, next) => {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ message: 'Only organisation admins can do that.' });
  }
  next();
};
