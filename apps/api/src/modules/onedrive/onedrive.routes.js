const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./onedrive.controller');

const router = Router();

// Public: Microsoft redirects the browser here, so no Authorization header is
// possible. The org is carried in the signed state token instead.
router.get('/callback', ctrl.callback);

router.use(authenticate);

router.get('/login', ctrl.login);
router.get('/getOneDrives', ctrl.getOneDrives);
router.get('/files', ctrl.getFiles);
router.get('/getExcelInventoryHrData', ctrl.getInventoryData);
router.get('/download/:id', ctrl.downloadFile);

module.exports = router;
