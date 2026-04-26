import jwt from 'jsonwebtoken';

export const generateAccessToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );
};

export const generateRefreshToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
};

const getCookieOptions = () => {
    const isProd = process.env.NODE_ENV === 'production';

    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax', // 'none' is required for cross-domain SSO on Render
        path: '/'
    };
};

export const setAuthCookies = (res, accessToken, refreshToken) => {
    const commonOptions = getCookieOptions();

    res.cookie('accessToken', accessToken, {
        ...commonOptions,
        maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
        ...commonOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
};

export const clearAuthCookies = (res) => {
    const commonOptions = getCookieOptions();
    res.clearCookie('accessToken', commonOptions);
    res.clearCookie('refreshToken', commonOptions);
};
