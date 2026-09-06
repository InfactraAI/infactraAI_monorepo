const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const requireAdmin = require('../../middleware/requireAdmin');
const ctrl = require('./org.controller');

const router = Router();

// Public: an invitee has no account yet, so these cannot require a token.
// The invitation token itself is the credential.
router.get('/invites/lookup', ctrl.lookupInvite);
router.post('/invites/accept', ctrl.acceptInvite);

router.use(authenticate);

// Any member can see who else is in the organisation.
router.get('/members', ctrl.listMembers);

// Changing who has access is admin-only.
router.post('/invites', requireAdmin, ctrl.createInvite);
router.post('/invites/:id/resend', requireAdmin, ctrl.resendInvite);
router.delete('/invites/:id', requireAdmin, ctrl.revokeInvite);
router.patch('/members/:id/role', requireAdmin, ctrl.updateMemberRole);
router.delete('/members/:id', requireAdmin, ctrl.removeMember);

module.exports = router;
