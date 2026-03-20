const mongoose = require('mongoose');
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shadowAccess');
        console.log("Connected to MongoDB 🚀");
    } catch (err) {
        console.error("DB Connection Error:", err);
        process.exit(1);
    }
};
module.exports = connectDB;
