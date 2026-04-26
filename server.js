import 'dotenv/config'; 
import app from './src/app.js'; 
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 5000;

// Initialize DB connection
connectDB();

// Only call app.listen if we are NOT on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`----------------------------------------`);
        console.log(`Auth Service running on Port: ${PORT}`);
        console.log(`----------------------------------------`);
    });
}

export default app;
