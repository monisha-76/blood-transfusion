const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const { initCronJobs } = require('./jobs/bloodSearchJob');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Connect MongoDB
  await connectDB();

  // 2. Initialize Cron Jobs
  initCronJobs();

  // 3. Start Express Server
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  JEEVANSETU BACKEND RUNNING ON PORT ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  API Health: http://localhost:${PORT}/api/health`);
    console.log(`==================================================`);
  });
};

startServer();
