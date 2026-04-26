import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import errorHandler from './middleware/errorMiddleware.js';

const app = express();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many authentication requests. Please try again shortly.'
    }
});

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(mongoSanitize());
app.use(xss());

app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins for your "Universal Auth" service
        // You can restrict this later to a specific list of your domains
        callback(null, true);
    },
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use(express.static('public'));

// Health check for your other apps to "ping"
app.get('/api/auth/health', (req, res) => {
    res.status(200).json({ status: 'active', message: 'Auth Service is running' });
});

app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes);

app.use(errorHandler);

export default app;
