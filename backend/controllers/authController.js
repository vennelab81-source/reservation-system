const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const signToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const sanitize = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// @route POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email and password are required', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    // Only allow 'admin' role if explicitly requested — in a real production
    // system this would be gated further (invite code / manual promotion).
    // Kept simple here per assignment scope.
    const user = await User.create({
      name,
      email,
      password,
      role: role === 'admin' ? 'admin' : 'customer',
    });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
};

// @route POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user);
    res.status(200).json({ token, user: sanitize(user) });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  res.status(200).json({ user: sanitize(req.user) });
};
