import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
    clearAuthCookies,
    generateAccessToken,
    generateRefreshToken,
    setAuthCookies
} from '../utils/tokenLogic.js';
import sendEmail from '../utils/sendEmail.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- REGISTER ---
export const register = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400);
        throw new Error('Username, email, and password are required');
    }

    const existingUser = await User.findOne({
        $or: [{ email }, { username }]
    });

    if (existingUser) {
        res.status(400);
        throw new Error('A user with that email or username already exists');
    }

    const otp = generateOtp();
    const otpExpires = Date.now() + OTP_EXPIRY_MS;
    const user = await User.create({ username, email, password, otp, otpExpires });

    try {
        await sendEmail({
            email,
            subject: 'Archive Identity - Code',
            message: `Your verification code is ${otp}`
        });
    } catch (error) {
        await User.findByIdAndDelete(user._id);
        res.status(502);
        throw new Error('Unable to send verification email right now. Please try again.');
    }

    res.status(201).json({ message: 'Code sent', email });
});

// --- VERIFY ---
export const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email, otp, otpExpires: { $gt: Date.now() } });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired code');
    }

    user.isVerified = true;
    user.accountStatus = 'active';
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Identity verified' });
});

// --- LOGIN (With Rotation) ---
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Email and password are required');
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        res.status(401);
        throw new Error('Invalid identity');
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
        res.status(429);
        throw new Error('Account temporarily locked due to repeated failed sign-in attempts');
    }

    const passwordMatches = await user.matchPassword(password);
    if (!passwordMatches) {
        user.loginAttempts += 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockUntil = Date.now() + ACCOUNT_LOCK_MS;
        }
        await user.save();
        res.status(401);
        throw new Error('Invalid identity');
    }

    if (!user.isVerified) {
        res.status(401);
        throw new Error('Verify identity first');
    }

    if (user.accountStatus === 'suspended') {
        res.status(403);
        throw new Error('Account is suspended');
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    user.accountStatus = 'active';
    await user.save();

    setAuthCookies(res, accessToken, refreshToken);
    res.status(200).json({
        message: 'Authenticated',
        user: {
            username: user.username,
            email: user.email
        }
    });
});

// --- REFRESH (Rotation) ---
export const refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
        res.status(401);
        throw new Error('Session expired');
    }

    const user = await User.findOne({ refreshToken });
    if (!user) {
        clearAuthCookies(res);
        res.status(403);
        throw new Error('Security breach detected');
    }

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
        clearAuthCookies(res);
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });
        res.status(403);
        throw new Error('Invalid session');
    }

    if (decoded.id !== user._id.toString()) {
        clearAuthCookies(res);
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });
        res.status(403);
        throw new Error('Invalid session');
    }

    const newAccess = generateAccessToken(user._id);
    const newRefresh = generateRefreshToken(user._id);

    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, newAccess, newRefresh);
    res.status(200).json({ message: 'Rotated' });
});

// --- FORGOT ---
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('Identity not found');
    }

    const otp = generateOtp();
    user.resetPasswordToken = otp;
    user.resetPasswordExpire = Date.now() + OTP_EXPIRY_MS;
    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user.email,
        subject: 'Archive - Recovery',
        message: `Your recovery code is ${otp}`
    });

    res.status(200).json({ message: 'Recovery code sent' });
});

// --- RESET ---
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, password } = req.body;
    const user = await User.findOne({
        email,
        resetPasswordToken: otp,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired code');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.refreshToken = undefined;
    await user.save();

    clearAuthCookies(res);
    res.status(200).json({ message: 'Security updated' });
});

// --- ME ---
export const getMe = asyncHandler(async (req, res) => {
    res.status(200).json(req.user);
});

// --- LOGOUT ---
export const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
        const user = await User.findOne({ refreshToken });
        if (user) {
            user.refreshToken = undefined;
            await user.save({ validateBeforeSave: false });
        }
    }

    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out' });
});
