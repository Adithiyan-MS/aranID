import express from 'express';
import {
    forgotPassword,
    getMe,
    login,
    logout,
    refresh,
    register,
    resetPassword,
    verifyOTP
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify', verifyOTP);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/logout', logout);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);
router.get('/me', protect, getMe);

export default router;
