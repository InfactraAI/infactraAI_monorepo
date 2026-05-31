const { Router } = require('express');
const ctrl = require('./auth.controller');

const router = Router();

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.post('/forgotPassword', ctrl.forgotPassword);
router.post('/resetPassword', ctrl.resetPassword);

module.exports = router;
