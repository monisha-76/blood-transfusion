const mongoose = require('mongoose');

// Disable query buffering so disconnected queries fail fast instead of hanging 10s
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevansetu', {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[DATABASE] MongoDB Connected Successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`\n[DATABASE CONNECTION ERROR]`);
    console.error(`-> ${error.message}`);
    console.error(`-> IF USING MONGODB ATLAS: Whitelist your IP in Atlas (Network Access -> Add IP Address -> Allow Access From Anywhere 0.0.0.0/0)`);
    console.error(`-> IF USING LOCAL MONGODB: Ensure local MongoDB service is started (net start MongoDB or mongod)\n`);
    return null;
  }
};

module.exports = connectDB;
