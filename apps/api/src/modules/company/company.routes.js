const { Router } = require('express');
const upload = require('../../config/multer');
const ctrl = require('./company.controller');

const router = Router();

router.get('/profile', ctrl.getCompany);
router.post('/update', ctrl.updateCompany);
router.post('/upload-logo', upload.single('logo'), ctrl.uploadLogo);

module.exports = router;
