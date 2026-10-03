const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BloodRequest = require('../models/BloodRequest');
const BloodInventory = require('../models/BloodInventory');
const Donor = require('../models/Donor');
const DonorMatch = require('../models/DonorMatch');
const Patient = require('../models/Patient');
const SocialCampaign = require('../models/SocialCampaign');
const {
  initiateBloodSearch,
  checkBloodBankInventory,
  searchRegisteredDonors,
  checkAndMatchNewDonor,
  monitorActiveBloodRequests,
  processDay3SocialMediaEmergency,
  processDonorResponse,
  confirmBloodSecured
} = require('../services/bloodSearchService');
const { fulfillCampaign } = require('../services/socialMediaService');

const runTest = async () => {
  console.log('=== STARTING CONTINUOUS BLOOD SEARCH & DONOR MATCHING TESTS ===');
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevansetu';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB:', mongoUri);

  try {
    // 0. Cleanup any previous test data
    await DonorMatch.deleteMany({});
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_CONTINUOUS' });
    await Donor.deleteMany({ location: 'TEST_LOCATION_CONTINUOUS' });
    await BloodInventory.deleteMany({ bloodBank: 'TEST_BLOOD_BANK' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_CONTINUOUS' });
    console.log('[CLEANUP] Previous test artifacts cleared.');

    // 1. Create a dummy patient
    let patient = await Patient.findOne();
    if (!patient) {
      patient = await Patient.create({
        name: 'Continuous Test Patient',
        phone: '+91-9999988888',
        email: 'testpatient_cont@example.com',
        bloodGroup: 'O+',
        diagnosis: 'Thalassemia Major',
        hospital: 'TEST_HOSPITAL_CONTINUOUS'
      });
    }

    // 2. TEST CASE 1: Partial vs Full Securing & ACTIVE status lifecycle
    console.log('\n--- TEST 1: Partial Securing & Remaining Units Calculation ---');
    // Ensure no pre-existing AB- inventory
    await BloodInventory.deleteMany({ bloodGroup: 'AB-' });

    const req1 = await BloodRequest.create({
      patient: patient._id,
      hospital: 'TEST_HOSPITAL_CONTINUOUS',
      requiredBloodGroup: 'AB-',
      requiredQuantity: 2,
      transfusionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      searchStartDate: new Date(),
      searchEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE'
    });

    console.log(`Created Request #${req1._id}: Required=${req1.requiredQuantity}, Secured=${req1.securedQuantity}, Remaining=${req1.remainingQuantity}, Status=${req1.currentStatus}`);
    if (req1.remainingQuantity !== 2 || req1.currentStatus !== 'ACTIVE') {
      throw new Error(`Test 1 Failed: Initial remainingQuantity should be 2 and status ACTIVE. Got remaining=${req1.remainingQuantity}, status=${req1.currentStatus}`);
    }

    // Add exactly 1 unit of inventory
    const inv1 = await BloodInventory.create({
      bloodBank: 'TEST_BLOOD_BANK',
      bloodGroup: 'AB-',
      quantity: 1,
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'AVAILABLE'
    });

    // Run inventory check
    await checkBloodBankInventory(req1);
    console.log(`After 1 unit inventory: Secured=${req1.securedQuantity}, Remaining=${req1.remainingQuantity}, Status=${req1.currentStatus}`);
    if (req1.securedQuantity !== 1 || req1.remainingQuantity !== 1 || req1.currentStatus !== 'ACTIVE') {
      throw new Error(`Test 1 Failed: Should have 1 unit secured, 1 unit remaining, and remain ACTIVE!`);
    }

    // 3. TEST CASE 2: Duplicate Email & DonorMatch Prevention
    console.log('\n--- TEST 2: DonorMatch Duplicate Notification Prevention ---');
    const donor1 = await Donor.create({
      name: 'Amit Sharma',
      bloodGroup: 'AB-',
      phone: '+91-9111122222',
      email: 'amit.donor.test@example.com',
      location: 'TEST_LOCATION_CONTINUOUS',
      willingToDonate: true,
      availabilityStatus: 'AVAILABLE'
    });

    // Run searchRegisteredDonors on req1
    const searchRes1 = await searchRegisteredDonors(req1);
    console.log(`First donor scan found & notified: ${searchRes1.count} donor(s)`);
    if (searchRes1.count < 1) {
      throw new Error(`Test 2 Failed: Expected at least 1 donor notified, got ${searchRes1.count}`);
    }

    // Run searchRegisteredDonors AGAIN immediately - should NOT notify again
    const searchRes2 = await searchRegisteredDonors(req1);
    console.log(`Second donor scan found & notified: ${searchRes2.count} donor(s)`);
    if (searchRes2.count !== 0) {
      throw new Error(`Test 2 Failed: Duplicate scan should notify 0 donors, got ${searchRes2.count}`);
    }

    const matches = await DonorMatch.find({ bloodRequestId: req1._id });
    console.log(`Total DonorMatch records for Request #${req1._id}: ${matches.length}`);
    if (matches.length < 1 || matches.some(m => m.notificationStatus !== 'EMAIL_SENT')) {
      throw new Error(`Test 2 Failed: Expected all DonorMatch records to have EMAIL_SENT`);
    }

    // 4. TEST CASE 3: Donor Acceptance Does NOT premature increment securedQuantity
    console.log('\n--- TEST 3: Donor Response Verification ---');
    await processDonorResponse(req1._id, donor1._id, 'ACCEPTED');
    const reloadedReq1 = await BloodRequest.findById(req1._id);
    console.log(`After donor accepted: Secured=${reloadedReq1.securedQuantity}, Remaining=${reloadedReq1.remainingQuantity}, Status=${reloadedReq1.currentStatus}`);
    if (reloadedReq1.securedQuantity !== 1 || reloadedReq1.remainingQuantity !== 1) {
      throw new Error(`Test 3 Failed: Donor willingness acceptance must NOT prematurely increment securedQuantity!`);
    }

    // 5. TEST CASE 4: Event-Driven New Donor Registration Matching
    console.log('\n--- TEST 4: Event-Driven Matching on New Donor Registration ---');
    // We register a new AB- donor later; it should immediately match req1 (which needs 1 more unit)
    const newDonor = await Donor.create({
      name: 'Sunita Rao',
      bloodGroup: 'AB-',
      phone: '+91-9333344444',
      email: 'sunita.donor.test@example.com',
      location: 'TEST_LOCATION_CONTINUOUS',
      willingToDonate: true,
      availabilityStatus: 'AVAILABLE'
    });

    const eventMatchRes = await checkAndMatchNewDonor(newDonor);
    console.log(`Event-driven match result for Sunita Rao: matched ${eventMatchRes.matchedRequests} active request(s)`);
    if (eventMatchRes.matchedRequests < 1) {
      throw new Error(`Test 4 Failed: New willing donor should match active AB- request!`);
    }

    // 6. TEST CASE 5: Day-3 Emergency Social Media Campaign Generation
    console.log('\n--- TEST 5: Day-3 Social Media Emergency Campaign ---');
    // Create an unfulfilled blood request with createdAt = 3 days ago
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const reqDay3 = await BloodRequest.create({
      patient: patient._id,
      hospital: 'TEST_HOSPITAL_CONTINUOUS',
      requiredBloodGroup: 'B-',
      requiredQuantity: 1,
      transfusionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      searchStartDate: threeDaysAgo,
      searchEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE',
      createdAt: threeDaysAgo
    });

    // Run Day-3 trigger
    await processDay3SocialMediaEmergency();
    const reloadedDay3 = await BloodRequest.findById(reqDay3._id);
    if (!reloadedDay3.socialCampaignId) {
      throw new Error(`Test 5 Failed: Day-3 unfulfilled request should have socialCampaignId generated!`);
    }
    const campaign = await SocialCampaign.findById(reloadedDay3.socialCampaignId);
    console.log(`Generated Social Campaign Status: ${campaign.status}, Title: "${campaign.postContent?.title}"`);
    console.log(`Post Body preview:\n${campaign.postContent?.body}`);
    const validPostStatuses = ['POST_READY', 'POST_CREATED', 'POST_FAILED'];
    if (!validPostStatuses.includes(campaign.status)) {
      throw new Error(`Test 5 Failed: Campaign status should be POST_READY/POST_CREATED/POST_FAILED, got ${campaign.status}`);
    }
    // Verify no patient sensitive phone or private email is leaked in public body
    if (campaign.postContent.body.includes(patient.phone) || campaign.postContent.body.includes(patient.email)) {
      throw new Error(`Test 5 Failed: Patient sensitive phone/email leaked into public social post!`);
    }

    // 7. TEST CASE 6: Full Blood Securing & Campaign Fulfillment
    console.log('\n--- TEST 6: Securing Final Unit & Marking FULFILLED ---');
    await confirmBloodSecured(reqDay3._id, 1, 'REGISTERED_DONOR');
    const finalDay3Req = await BloodRequest.findById(reqDay3._id);
    const finalCampaign = await SocialCampaign.findById(finalDay3Req.socialCampaignId);
    console.log(`After securing blood: Request Status=${finalDay3Req.currentStatus}, Secured=${finalDay3Req.securedQuantity}, Remaining=${finalDay3Req.remainingQuantity}, Campaign Status=${finalCampaign.status}`);
    if (finalDay3Req.currentStatus !== 'BLOOD_SECURED' || finalDay3Req.remainingQuantity !== 0 || finalCampaign.status !== 'FULFILLED') {
      throw new Error(`Test 6 Failed: BloodRequest should be BLOOD_SECURED with 0 remaining, and Campaign should be FULFILLED!`);
    }

    console.log('\n🎉 ALL 6 COMPREHENSIVE TEST CASES PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    await DonorMatch.deleteMany({});
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_CONTINUOUS' });
    await Donor.deleteMany({ location: 'TEST_LOCATION_CONTINUOUS' });
    await BloodInventory.deleteMany({ bloodBank: 'TEST_BLOOD_BANK' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_CONTINUOUS' });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runTest();
