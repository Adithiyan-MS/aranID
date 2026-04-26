import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // Use the exact name from your .env file
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`----------------------------------------`);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Do NOT use process.exit(1) in serverless environments
    }
};

export default connectDB;
