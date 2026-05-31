const { Router } = require('express');
const ctrl = require('./onedrive.controller');

const router = Router();

router.get('/login', ctrl.login);
router.get('/callback', ctrl.callback);
router.get('/getOneDrives', ctrl.getOneDrives);
router.get('/files', ctrl.getFiles);
router.get('/getExcelInventoryHrData', ctrl.getInventoryData);
router.get('/download/:id', ctrl.downloadFile);

module.exports = router;
