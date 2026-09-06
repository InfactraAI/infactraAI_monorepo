/**
 * Google's APIs return a precise reason in the response body; axios throws with
 * only "Request failed with status code 400". Unwrapping matters — the
 * difference between "wrong file type" and "API not enabled" is the whole
 * diagnosis.
 */
exports.wrap = (err, fallback = 'Google request failed') => {
  const body = err.response?.data;
  const g = body?.error;

  if (!g) return err;

  const message = typeof g === 'string' ? g : g.message || fallback;
  const wrapped = new Error(message);

  // 401/403 from Google usually mean the user must act (reconnect, enable an
  // API); anything else is a bad request we should report as such.
  wrapped.status = err.response?.status === 401 ? 401 : err.response?.status === 403 ? 403 : 400;
  wrapped.googleReason = g.status || g.errors?.[0]?.reason;
  return wrapped;
};

/** True when Google is telling us an API is switched off in the project. */
exports.isApiDisabled = (err) =>
  err.response?.status === 403 &&
  /has not been used in project|is disabled/i.test(err.response?.data?.error?.message || '');
