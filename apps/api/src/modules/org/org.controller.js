const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Invitation = require('../../models/Invitation');
const mailer = require('../../utils/mailer');

const SALT_ROUNDS = 12;
const INVITE_TTL_DAYS = 7;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const publicMember = (u, org) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  isOwner: String(org.ownerId) === String(u._id),
  joinedAt: u.createdAt,
});

const publicInvite = (i) => ({
  id: i._id,
  email: i.email,
  role: i.role,
  invitedAt: i.createdAt,
  expiresAt: i.expiresAt,
  expired: i.expiresAt < new Date(),
});

const inviteLink = (token) =>
  `${process.env.FRONTEND_URL || 'http://localhost'}/accept-invite?token=${token}`;

/** Refuses to leave an organisation with no administrator. */
async function assertNotLastAdmin(orgId, userId) {
  const admins = await User.countDocuments({ orgId, role: 'ADMIN', active: true });
  if (admins <= 1) {
    const target = await User.findOne({ _id: userId, orgId });
    if (target?.role === 'ADMIN') {
      throw httpError(400, 'This is the only admin. Promote someone else first.');
    }
  }
}

// ─── Members ────────────────────────────────────────────────────────────────

exports.listMembers = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ message: 'Organisation not found' });

    const [members, invites] = await Promise.all([
      User.find({ orgId: req.orgId }).sort({ createdAt: 1 }),
      Invitation.find({ orgId: req.orgId, status: 'pending' }).sort({ createdAt: -1 }),
    ]);

    res.json({
      organization: { id: org._id, name: org.name },
      canManage: req.userRole === 'ADMIN',
      emailEnabled: mailer.isConfigured(),
      members: members.map((m) => publicMember(m, org)),
      invitations: invites.map(publicInvite),
    });
  } catch (err) {
    next(err);
  }
};

exports.updateMemberRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Role must be USER or ADMIN' });
    }

    const org = await Organization.findById(req.orgId);
    const member = await User.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    if (String(org.ownerId) === String(member._id)) {
      return res.status(400).json({ message: "The owner's role cannot be changed." });
    }
    if (role === 'USER') await assertNotLastAdmin(req.orgId, member._id);

    member.role = role;
    await member.save();

    res.json({ message: 'Role updated', member: publicMember(member, org) });
  } catch (err) {
    next(err);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.orgId);
    const member = await User.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!member) return res.status(404).json({ message: 'Member not found' });

    if (String(org.ownerId) === String(member._id)) {
      return res.status(400).json({ message: 'The owner cannot be removed.' });
    }
    if (String(member._id) === String(req.userId)) {
      return res.status(400).json({ message: 'You cannot remove yourself.' });
    }
    await assertNotLastAdmin(req.orgId, member._id);

    await User.deleteOne({ _id: member._id, orgId: req.orgId });
    res.json({ message: `${member.email} removed` });
  } catch (err) {
    next(err);
  }
};

// ─── Invitations ────────────────────────────────────────────────────────────

exports.createInvite = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role === 'ADMIN' ? 'ADMIN' : 'USER';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }

    // Email is unique across the install, so an existing account cannot be
    // pulled into a second organisation.
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        message: String(existing.orgId) === String(req.orgId)
          ? 'They are already in this organisation.'
          : 'That email already has an Infactra account.',
      });
    }

    const org = await Organization.findById(req.orgId);
    const token = crypto.randomBytes(32).toString('hex');

    // Re-inviting the same address replaces the outstanding invitation, so an
    // older link stops working.
    await Invitation.deleteOne({ orgId: req.orgId, email, status: 'pending' });

    const invite = await Invitation.create({
      orgId: req.orgId,
      email,
      role,
      tokenHash: hash(token),
      invitedBy: req.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000),
    });

    const link = inviteLink(token);
    const sent = await mailer.send({
      to: email,
      subject: `You've been invited to ${org.name} on Infactra`,
      html: `<h3>Join ${org.name}</h3>
             <p>You've been invited to collaborate on Infactra.</p>
             <p><a href="${link}">Accept your invitation</a></p>
             <p>This link expires in ${INVITE_TTL_DAYS} days.</p>`,
    });

    res.status(201).json({
      message: sent ? `Invitation sent to ${email}` : `Invitation created for ${email}`,
      emailSent: sent,
      // Returned only when mail is unconfigured, so an admin can still pass
      // the link along by hand.
      inviteLink: sent ? undefined : link,
      invitation: publicInvite(invite),
    });
  } catch (err) {
    next(err);
  }
};

exports.revokeInvite = async (req, res, next) => {
  try {
    const invite = await Invitation.findOne({
      _id: req.params.id,
      orgId: req.orgId,
      status: 'pending',
    });
    if (!invite) return res.status(404).json({ message: 'Invitation not found' });

    invite.status = 'revoked';
    await invite.save();

    res.json({ message: `Invitation to ${invite.email} revoked` });
  } catch (err) {
    next(err);
  }
};

exports.resendInvite = async (req, res, next) => {
  try {
    const invite = await Invitation.findOne({
      _id: req.params.id,
      orgId: req.orgId,
      status: 'pending',
    });
    if (!invite) return res.status(404).json({ message: 'Invitation not found' });

    const org = await Organization.findById(req.orgId);

    // Issue a fresh token — the old one is unrecoverable by design.
    const token = crypto.randomBytes(32).toString('hex');
    invite.tokenHash = hash(token);
    invite.expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);
    await invite.save();

    const link = inviteLink(token);
    const sent = await mailer.send({
      to: invite.email,
      subject: `Reminder: join ${org.name} on Infactra`,
      html: `<h3>Join ${org.name}</h3>
             <p><a href="${link}">Accept your invitation</a></p>
             <p>This link expires in ${INVITE_TTL_DAYS} days.</p>`,
    });

    res.json({
      message: sent ? `Invitation resent to ${invite.email}` : 'Invitation refreshed',
      emailSent: sent,
      inviteLink: sent ? undefined : link,
      invitation: publicInvite(invite),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Public: accepting ──────────────────────────────────────────────────────

async function findLiveInvite(token) {
  if (!token) throw httpError(400, 'Missing invitation token');

  const invite = await Invitation.findOne({ tokenHash: hash(token), status: 'pending' });
  if (!invite) throw httpError(404, 'This invitation is no longer valid.');
  if (invite.expiresAt < new Date()) throw httpError(410, 'This invitation has expired.');

  return invite;
}

/** Lets the accept page show who invited you before you fill anything in. */
exports.lookupInvite = async (req, res, next) => {
  try {
    const invite = await findLiveInvite(req.query.token);
    const org = await Organization.findById(invite.orgId);

    res.json({
      email: invite.email,
      role: invite.role,
      organizationName: org?.name || 'an organisation',
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

exports.acceptInvite = async (req, res, next) => {
  try {
    const { token, name, password } = req.body;

    if (!name?.trim() || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const invite = await findLiveInvite(token);

    // Re-check at accept time: the address may have registered independently
    // between the invitation being sent and this request.
    if (await User.findOne({ email: invite.email })) {
      return res.status(409).json({ message: 'That email already has an account. Please sign in.' });
    }

    const org = await Organization.findById(invite.orgId);
    if (!org?.active) return res.status(403).json({ message: 'This organisation is no longer active.' });

    const user = await User.create({
      orgId: invite.orgId,
      name: name.trim(),
      email: invite.email,
      role: invite.role,
      password: await bcrypt.hash(password, SALT_ROUNDS),
    });

    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    await invite.save();

    // Sign them straight in — no second trip through the login form.
    const authToken = jwt.sign(
      { id: user._id, role: user.role, orgId: user.orgId },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({
      message: `Welcome to ${org.name}`,
      token: authToken,
      user: userObj,
      organization: { id: org._id, name: org.name, logo: org.logo },
    });
  } catch (err) {
    next(err);
  }
};
