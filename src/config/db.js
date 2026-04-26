import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // Use the exact name from your .env file
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`----------------------------------------`);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
