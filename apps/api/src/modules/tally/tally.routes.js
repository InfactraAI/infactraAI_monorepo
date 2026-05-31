const { Router } = require('express');
const ctrl = require('./tally.controller');

const router = Router();
router.post('/connect', ctrl.connectTally);

module.exports = router;
