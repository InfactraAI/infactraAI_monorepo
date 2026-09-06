const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./tally.controller');

const router = Router();
router.use(authenticate);
router.post('/connect', ctrl.connectTally);

module.exports = router;
