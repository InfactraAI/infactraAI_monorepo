const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const User = require('../../models/User');

const SALT_ROUNDS = 12;

function mailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
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

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '8h',
    });

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ token, user: userObj });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, unitName, mobile, address } = req.body;
    if (!name || !email || !password || !unitName)
      return res.status(400).json({ message: 'Required fields missing' });

    if (await User.findOne({ email }))
      return res.status(409).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      name, email, mobile, password: hashedPassword,
      unit: unitName, address, role: 'ADMIN',
    });

    await mailer().sendMail({
      to: email,
      subject: 'Account Created — Infactra',
      html: `<h3>Welcome ${name}</h3><p>Email: ${email}</p><p>Password: ${password}</p>
             <a href="${process.env.FRONTEND_URL}/login">Login</a>`,
    });

    res.json({ message: 'User registered successfully', userId: user._id });
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
    await mailer().sendMail({
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
