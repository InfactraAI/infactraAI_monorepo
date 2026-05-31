// Central error handler — must have 4 params for Express to treat it as error middleware
// eslint-disable-next-line no-unused-vars
module.exports = (err, _req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${status} — ${message}`, err.stack || '');
  }

  res.status(status).json({ message });
};
