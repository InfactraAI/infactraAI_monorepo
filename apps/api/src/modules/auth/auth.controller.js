const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../../models/User');
const Organization = require('../../models/Organization');
const mailer = require('../../utils/mailer');

const SALT_ROUNDS = 12;
const TOKEN_TTL = '8h';

/** Every token is org-scoped — authenticate rejects tokens without an orgId. */
function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, orgId: user.orgId },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const org = await Organization.findById(user.orgId);
    if (!org?.active) {
      return res.status(403).json({ message: 'This organisation is no longer active.' });
    }

    const userObj = user.toObject();
    delete userObj.password;

    res.json({
      token: signToken(user),
      user: userObj,
      organization: { id: org._id, name: org.name, logo: org.logo },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registration creates a new organisation and its first user, who becomes the
 * owner and an ADMIN of *that organisation only*. Joining an existing
 * organisation is a separate invite flow, not this endpoint.
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, organizationName, mobile, address } = req.body;

    // organizationName replaces the old unitName, which the API required and
    // no client ever sent.
    if (!name || !email || !password || !organizationName) {
      return res.status(400).json({
        message: 'Name, email, password and organisation name are required',
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const org = await Organization.create({ name: organizationName.trim() });

    let user;
    try {
      user = await User.create({
        orgId: org._id,
        name,
        email,
        mobile,
        address,
        password: await bcrypt.hash(password, SALT_ROUNDS),
        role: 'ADMIN',
      });
    } catch (err) {
      // Don't strand an empty organisation if user creation fails.
      await Organization.deleteOne({ _id: org._id });
      throw err;
    }

    org.ownerId = user._id;
    await org.save();

    // Never email a password. Point at the login page instead.
    mailer
      .send({
        to: email,
        subject: 'Welcome to Infactra',
        html: `<h3>Welcome ${name}</h3>
               <p>Your organisation <strong>${org.name}</strong> is ready.</p>
               <p>Sign in with <strong>${email}</strong> and the password you chose.</p>
               <a href="${process.env.FRONTEND_URL}/login">Sign in</a>`,
      })
      .catch(() => {});

    res.status(201).json({
      message: 'Organisation created',
      userId: user._id,
      organization: { id: org._id, name: org.name },
    });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email not registered' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetOtp = crypto.createHash('sha256').update(token).digest('hex');
    user.resetOtpExpiry = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/resetPassword?token=${token}`;
    await mailer.send({
      to: email,
      subject: 'Reset Password — Infactra',
      html: `<p>Click to reset (expires in 15 min):</p><a href="${resetLink}">${resetLink}</a>`,
    });

    res.json({ message: 'Reset link sent' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetOtp: hashedToken,
      resetOtpExpiry: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(password, SALT_ROUNDS);
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};
