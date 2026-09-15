/**
 * Date Utilities for JeevanSetu Transfusion Scheduling
 */

/**
 * Calculates predicted next transfusion date.
 * @param {Date|string} lastTransfusionDate 
 * @param {number} frequencyInDays 
 * @returns {Date}
 */
const calculateNextTransfusionDate = (lastTransfusionDate, frequencyInDays) => {
  const lastDate = new Date(lastTransfusionDate);
  if (isNaN(lastDate.getTime())) {
    throw new Error('Invalid last transfusion date');
  }
  const freq = parseInt(frequencyInDays, 10);
  if (isNaN(freq) || freq <= 0) {
    throw new Error('Invalid transfusion frequency');
  }
  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + freq);
  return nextDate;
};

/**
 * Returns difference in full days between two dates (date2 - date1).
 */
const getDifferenceInDays = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formats a Date object to YYYY-MM-DD
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Calculates eligibility for donor based on last donation date (min 90 days interval).
 */
const isDonorEligible = (lastDonationDate, minDays = 90) => {
  if (!lastDonationDate) return true; // Never donated before
  const daysSince = getDifferenceInDays(lastDonationDate, new Date());
  return daysSince >= minDays;
};

module.exports = {
  calculateNextTransfusionDate,
  getDifferenceInDays,
  formatDate,
  isDonorEligible
};
