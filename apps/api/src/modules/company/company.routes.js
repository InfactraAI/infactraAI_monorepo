const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const upload = require('../../config/multer');
const ctrl = require('./company.controller');

const router = Router();

router.use(authenticate);

router.get('/profile', ctrl.getCompany);
router.post('/update', ctrl.updateCompany);
router.post('/upload-logo', upload.single('logo'), ctrl.uploadLogo);

module.exports = router;
