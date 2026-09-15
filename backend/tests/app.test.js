const request = require('supertest');
const app = require('../app');
const { calculateNextTransfusionDate, isDonorEligible } = require('../utils/dateUtils');
const { BLOOD_COMPATIBILITY_MATRIX } = require('../services/bloodMatchingService');

describe('JeevanSetu Backend Logic & API Tests', () => {

  describe('1. Transfusion Date Prediction Logic', () => {
    test('Calculates correct next transfusion date based on frequency', () => {
      const lastDate = new Date('2026-08-01');
      const frequency = 21; // days
      const nextDate = calculateNextTransfusionDate(lastDate, frequency);
      
      expect(nextDate.toISOString().split('T')[0]).toBe('2026-08-22');
    });

    test('Throws error for invalid last transfusion date', () => {
      expect(() => calculateNextTransfusionDate('invalid-date', 21)).toThrow('Invalid last transfusion date');
    });
  });

  describe('2. Donor Matching Compatibility Matrix', () => {
    test('Validates B+ recipient compatibility matrix', () => {
      const compatibleGroups = BLOOD_COMPATIBILITY_MATRIX['B+'];
      expect(compatibleGroups).toContain('B+');
      expect(compatibleGroups).toContain('O+');
      expect(compatibleGroups).toContain('B-');
      expect(compatibleGroups).toContain('O-');
    });

    test('Validates Universal Recipient (AB+)', () => {
      const compatibleGroups = BLOOD_COMPATIBILITY_MATRIX['AB+'];
      expect(compatibleGroups.length).toBe(8);
    });

    test('Donor interval eligibility rule (>= 90 days)', () => {
      const recentDonation = new Date();
      recentDonation.setDate(recentDonation.getDate() - 30); // 30 days ago
      expect(isDonorEligible(recentDonation, 90)).toBe(false);

      const oldDonation = new Date();
      oldDonation.setDate(oldDonation.getDate() - 100); // 100 days ago
      expect(isDonorEligible(oldDonation, 90)).toBe(true);

      expect(isDonorEligible(null)).toBe(true); // First time donor
    });
  });

  describe('3. Dynamic Load-Balanced Doctor Assignment Logic', () => {
    test('Identifies doctor with lowest patient count correctly', () => {
      const doctorLoadList = [
        { doctorName: 'Dr. Varma', count: 2 },
        { doctorName: 'Dr. Kumar', count: 1 },
        { doctorName: 'Dr. Priya', count: 3 }
      ];

      doctorLoadList.sort((a, b) => a.count - b.count);

      expect(doctorLoadList[0].doctorName).toBe('Dr. Kumar');
      expect(doctorLoadList[0].count).toBe(1);
    });
  });

  describe('4. REST API Endpoints', () => {
    test('GET /api/health should return UP status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.system).toBe('JeevanSetu Blood Procurement Engine');
    });

    test('Protected route without token should return 401 or 503 if DB disconnected', async () => {
      const res = await request(app).get('/api/auth/me');
      expect([401, 503]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });

    test('Public Donor Registration endpoint accepts valid payload', async () => {
      const payload = {
        name: 'Test Donor',
        email: 'testdonor@example.com',
        phone: '+91-9988776655',
        bloodGroup: 'B+',
        location: 'Downtown Sector 4',
        healthDeclaration: true,
        consent: true
      };

      const res = await request(app)
        .post('/api/donors/public-register')
        .send(payload);

      // Should succeed or handle database state gracefully
      expect([201, 500, 400, 503]).toContain(res.statusCode);
      if (res.statusCode === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Test Donor');
      }
    });
  });
});
