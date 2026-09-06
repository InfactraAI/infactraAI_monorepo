const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./google.controller');

const router = Router();

// Public: Google redirects the browser here, so no Authorization header is
// possible. Identity is carried by the signed state token instead.
router.get('/callback', ctrl.callback);

// Everything else is bound to the caller's JWT — never a userId query param.
router.use(authenticate);

router.get('/status', ctrl.status);
router.get('/auth-url', ctrl.authUrl);
router.get('/picker-config', ctrl.pickerConfig);
router.delete('/disconnect', ctrl.disconnect);

router.get('/spreadsheets/:spreadsheetId/tabs', ctrl.listTabs);
router.post('/sheets', ctrl.selectSheet);
router.post('/sheets/:id/sync', ctrl.syncSheet);
router.delete('/sheets/:id', ctrl.removeSheet);

module.exports = router;
