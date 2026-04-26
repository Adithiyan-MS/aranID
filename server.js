import 'dotenv/config'; // Modern way to load .env
import app from './src/app.js'; // MUST include .js
import connectDB from './src/config/db.js';

// We use process.env.PORT for production (Render/Heroku) 
// and 5000 as a fallback for our local machine.
const PORT = process.env.PORT || 5000;

// db connection
connectDB();

app.listen(PORT, () => {
    console.log(`----------------------------------------`);
    console.log(`Auth Service running on Port: ${PORT}`);
    console.log(`----------------------------------------`);
});
