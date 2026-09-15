const cron = require('node-cron');
const { trigger10DayBloodSearch } = require('../services/transfusionScheduler');
const { process7DayEscalation, checkLateBloodAvailability } = require('../services/bloodSearchService');

/**
 * Scheduled Cron Jobs for Automated Pre-Transfusion Workflow
 */
const initCronJobs = () => {
  console.log('[CRON JOBS] Initializing JeevanSetu Background Automated Scheduler...');

  // JOB 1 & 2: Daily at Midnight - Detect upcoming transfusions & start 10-day blood search
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON JOB 1&2] Running 10-day upcoming transfusion detection...');
    await trigger10DayBloodSearch();
  });

  // JOB 6: Daily at 1:00 AM - Check 7-day search period escalation (Day 7 escalation)
  cron.schedule('0 1 * * *', async () => {
    console.log('[CRON JOB 6] Processing 7-day search escalation...');
    await process7DayEscalation();
  });

  // JOB 7: Every 6 hours - Check for late blood availability on escalated cases
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON JOB 7] Scanning for late blood availability...');
    await checkLateBloodAvailability();
  });

  console.log('[CRON JOBS] All scheduled jobs registered successfully.');
};

module.exports = {
  initCronJobs
};
