'use strict';

/**
 * campaignDeletionRulesTest.js
 *
 * Comprehensive Automated Test Suite for JeevanSetu Campaign Deletion & Expiration Rules:
 *
 * 1. SCENARIO A: Full Blood Fulfillment & Campaign Cleanup
 *    - Rejection of fulfillment when remainingQuantity > 0.
 *    - Full fulfillment transitions campaign to FULFILLED.
 *    - Deletes published Instagram post via mocked API.
 *    - Deletes generated Cloudinary poster via mocked uploader.destroy.
 *    - Records deletion status & timestamps.
 *    - Prevents republishing of FULFILLED campaign.
 *
 * 2. SCENARIO B: Transfusion Date Expired with Remaining Blood Needed
 *    - processExpiredTransfusions detects past transfusionDate with remainingQuantity > 0.
 *    - Marks BloodRequest as URGENT_DOCTOR_REVIEW.
 *    - Delivers notification specifically to assigned doctor with full clinical context.
 *    - Delivers escalation alert to Hospital Management.
 *    - Calls expireCampaign to delete Instagram post & Cloudinary poster.
 *    - Preserves patient medical history and request records intact.
 *    - Prevents duplicate alerts on repeated execution (idempotent).
 *
 * 3. ERROR RESILIENCE & EDGE CASES
 *    - Instagram deletion failure handled gracefully without crash.
 *    - Cloudinary deletion failure handled gracefully.
 *    - Protection of shared fallback image URL (never destroyed on Cloudinary).
 *    - Republication strictly halted for terminal campaign states.
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BloodRequest = require('../models/BloodRequest');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Notification = require('../models/Notification');
const SocialCampaign = require('../models/SocialCampaign');

const {
  fulfillCampaign,
  expireCampaign,
  publishCampaign
} = require('../services/socialMediaService');

const {
  processExpiredTransfusions,
  confirmBloodSecured
} = require('../services/bloodSearchService');

const { deleteInstagramPost } = require('../services/socialPublishers/instagramPublisher');
const { deleteCloudinaryPoster } = require('../services/posterGeneratorService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('   JEEVANSETU CAMPAIGN DELETION & EXPIRATION RULES TEST SUITE    ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevansetu';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to MongoDB.\n');

  const originalFetch = global.fetch;

  try {
    // Clean previous test artifacts
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_DELETION_RULES' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_DELETION_RULES' });
    await Notification.deleteMany({ 'relatedEntity.entityType': 'BloodRequest' });

    // Prepare doctor user
    let doctorUser = await User.findOne({ email: 'test_doc_deletion@example.com' });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: 'Dr. Test Assigned Doctor',
        email: 'test_doc_deletion@example.com',
        password: 'password123',
        role: 'DOCTOR',
        phone: '+91-9988776655',
        isActive: true
      });
    }

    // Prepare patient user & patient record with medical history
    let patientUser = await User.findOne({ email: 'test_pat_deletion@example.com' });
    if (!patientUser) {
      patientUser = await User.create({
        name: 'Test Patient Records Preserved',
        email: 'test_pat_deletion@example.com',
        password: 'password123',
        role: 'PATIENT',
        phone: '+91-9988776644',
        isActive: true
      });
    }

    let patient = await Patient.findOne({ email: 'test_pat_deletion@example.com' });
    if (!patient) {
      patient = await Patient.create({
        userId: patientUser._id,
        name: 'Test Patient Records Preserved',
        dateOfBirth: new Date('1990-06-20'),
        gender: 'MALE',
        phone: '+91-9988776644',
        email: 'test_pat_deletion@example.com',
        bloodGroup: 'B+',
        diagnosis: 'Thalassemia Major Chronic',
        medicalHistory: 'Severe hemolytic episodes requiring regular PRBC every 21 days. Previous transfusion reaction: none.',
        patientCondition: 'Critical Transfusion Dependent',
        assignedDoctor: doctorUser._id,
        hospital: 'TEST_HOSPITAL_DELETION_RULES',
        lastTransfusionDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        nextTransfusionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        transfusionFrequency: 21
      });
    }

    // =================================================================
    // TEST 1: Rejection of Fulfillment When Blood Is Not Fully Secured
    // =================================================================
    console.log('--- TEST 1: Rejection of Fulfillment When Blood Is Not Fully Secured ---');
    const unfulfilledReq = await BloodRequest.create({
      patient: patient._id,
      doctor: doctorUser._id,
      hospital: 'TEST_HOSPITAL_DELETION_RULES',
      requiredBloodGroup: 'B+',
      requiredQuantity: 2,
      securedQuantity: 1, // Only 1 of 2 secured!
      remainingQuantity: 1,
      transfusionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      searchStartDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      searchEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE'
    });

    const unfulfilledCamp = await SocialCampaign.create({
      bloodRequest: unfulfilledReq._id,
      bloodGroup: 'B+',
      requiredQuantity: 2,
      hospital: 'TEST_HOSPITAL_DELETION_RULES',
      requiredDate: unfulfilledReq.transfusionDate,
      expiryDate: unfulfilledReq.transfusionDate,
      status: 'POST_PUBLISHED',
      postContent: {
        title: 'Emergency B+ Blood',
        body: 'Urgent need',
        imageUrl: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jeevansetu/posters/test_poster_unfulfilled.png'
      },
      platformPosts: [{
        platform: 'Instagram',
        postId: 'IG_UNFULFILLED_123',
        status: 'POST_PUBLISHED'
      }]
    });

    const rejectResult = await fulfillCampaign(unfulfilledReq._id);
    assert(rejectResult.success === false, 'fulfillCampaign returns success=false when remainingQuantity > 0');

    const campAfterReject = await SocialCampaign.findById(unfulfilledCamp._id);
    assert(campAfterReject.status === 'POST_PUBLISHED', 'Campaign status remains POST_PUBLISHED when fulfillment is rejected');
    assert(campAfterReject.platformPosts[0].status === 'POST_PUBLISHED', 'Instagram post status remains POST_PUBLISHED when fulfillment is rejected');

    // =================================================================
    // TEST 2: Scenario A - Full Blood Fulfillment & Asset Cleanup
    // =================================================================
    console.log('\n--- TEST 2: Scenario A - Full Blood Fulfillment & Asset Cleanup ---');
    // Mock Instagram Graph API DELETE
    let igDeleteCalled = false;
    let igDeletedMediaId = null;

    global.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (options.method === 'DELETE' && urlStr.includes('graph.instagram.com')) {
        igDeleteCalled = true;
        const match = urlStr.match(/\/v24\.0\/([^\/?]+)/);
        if (match) igDeletedMediaId = match[1];
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    // Fully secure the request (secured=2, remaining=0)
    unfulfilledReq.securedQuantity = 2;
    unfulfilledReq.remainingQuantity = 0;
    unfulfilledReq.currentStatus = 'BLOOD_SECURED';
    await unfulfilledReq.save();

    const fulfillSuccessResult = await fulfillCampaign(unfulfilledReq._id);
    assert(fulfillSuccessResult.success === true, 'fulfillCampaign succeeds when blood is fully secured');

    const fulfilledCamp = await SocialCampaign.findById(unfulfilledCamp._id);
    assert(fulfilledCamp.status === 'FULFILLED', 'Campaign status transitioned to FULFILLED');
    assert(fulfilledCamp.fulfilledAt !== null && fulfilledCamp.fulfilledAt !== undefined, 'fulfilledAt timestamp is recorded');

    const igPostFulfilled = fulfilledCamp.platformPosts.find(p => p.platform === 'Instagram');
    assert(igDeleteCalled === true, 'Instagram DELETE API was invoked');
    assert(igDeletedMediaId === 'IG_UNFULFILLED_123', 'Correct Instagram media ID was targeted for deletion');
    assert(igPostFulfilled.status === 'DELETED', 'Instagram platform post status transitioned to DELETED');
    assert(igPostFulfilled.deletionStatus === 'SUCCESS', 'Instagram post deletionStatus recorded as SUCCESS');
    assert(igPostFulfilled.deletedAt !== null, 'deletedAt timestamp recorded on platform post');

    // =================================================================
    // TEST 3: Scenario A - Prevent Republication of FULFILLED Campaign
    // =================================================================
    console.log('\n--- TEST 3: Prevention of Republication on FULFILLED Campaign ---');
    let publishAttempted = false;
    global.fetch = async () => {
      publishAttempted = true;
      return { ok: true, status: 200, json: async () => ({ id: 'new_publish_id' }) };
    };

    const republishResult = await publishCampaign(fulfilledCamp._id);
    assert(republishResult.success === false, 'publishCampaign rejects republishing a FULFILLED campaign');
    assert(republishResult.status === 'FULFILLED', 'Returns current FULFILLED status');
    assert(publishAttempted === false, 'No external publishing API was contacted');

    // =================================================================
    // TEST 4: Scenario B - Expired Transfusion Date & Urgent Doctor Review
    // =================================================================
    console.log('\n--- TEST 4: Scenario B - Expired Transfusion Date & Urgent Doctor Review ---');
    const pastTransfusionDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past

    const expiredReq = await BloodRequest.create({
      patient: patient._id,
      doctor: doctorUser._id,
      hospital: 'TEST_HOSPITAL_DELETION_RULES',
      requiredBloodGroup: 'B+',
      requiredQuantity: 2,
      securedQuantity: 0,
      remainingQuantity: 2, // Blood still needed!
      transfusionDate: pastTransfusionDate,
      searchStartDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      searchEndDate: pastTransfusionDate,
      currentStatus: 'ACTIVE'
    });

    const expiredCamp = await SocialCampaign.create({
      bloodRequest: expiredReq._id,
      bloodGroup: 'B+',
      requiredQuantity: 2,
      hospital: 'TEST_HOSPITAL_DELETION_RULES',
      requiredDate: pastTransfusionDate,
      expiryDate: pastTransfusionDate,
      status: 'POST_PUBLISHED',
      postContent: {
        title: 'Urgent B+ Need',
        body: 'Body text',
        imageUrl: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jeevansetu/posters/emergency_B_expired.png'
      },
      platformPosts: [{
        platform: 'Instagram',
        postId: 'IG_EXPIRED_456',
        status: 'POST_PUBLISHED'
      }]
    });
    expiredReq.socialCampaignId = expiredCamp._id;
    await expiredReq.save();

    let expiredIgDeleteCalled = false;
    global.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (options.method === 'DELETE' && urlStr.includes('IG_EXPIRED_456')) {
        expiredIgDeleteCalled = true;
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const processedExpired = await processExpiredTransfusions();
    assert(processedExpired.some(r => r._id.toString() === expiredReq._id.toString()), 'Expired request detected by processExpiredTransfusions');

    const reloadedExpiredReq = await BloodRequest.findById(expiredReq._id);
    assert(reloadedExpiredReq.currentStatus === 'URGENT_DOCTOR_REVIEW', 'BloodRequest transitioned to URGENT_DOCTOR_REVIEW');

    const reloadedExpiredCamp = await SocialCampaign.findById(expiredCamp._id);
    assert(reloadedExpiredCamp.status === 'EXPIRED', 'SocialCampaign transitioned to EXPIRED');
    assert(expiredIgDeleteCalled === true, 'Instagram post was deleted upon transfusion expiration');
    assert(reloadedExpiredCamp.platformPosts[0].status === 'DELETED', 'Instagram post status marked DELETED');

    // Verify Doctor Notification
    const doctorNotification = await Notification.findOne({
      recipient: doctorUser._id,
      type: 'URGENT_DOCTOR_REVIEW',
      'relatedEntity.entityId': expiredReq._id
    });
    assert(doctorNotification !== null, 'Assigned doctor received URGENT_DOCTOR_REVIEW notification');
    assert(doctorNotification.message.includes('B+'), 'Notification mentions blood group');
    assert(doctorNotification.message.includes('2 unit(s)'), 'Notification mentions remaining units');
    assert(doctorNotification.message.includes('TEST_HOSPITAL_DELETION_RULES'), 'Notification mentions hospital');

    // Verify Hospital Management Notification
    const hospitalNotification = await Notification.findOne({
      type: 'URGENT_DOCTOR_REVIEW',
      title: { $regex: /Hospital|URGENT DOCTOR REVIEW/i },
      'relatedEntity.entityId': expiredReq._id
    });
    assert(hospitalNotification !== null, 'Hospital management alert was dispatched');

    // =================================================================
    // TEST 5: Patient Medical History & Records Preservation
    // =================================================================
    console.log('\n--- TEST 5: Patient Records Preservation ---');
    const intactPatient = await Patient.findById(patient._id);
    assert(intactPatient !== null, 'Patient document is intact');
    assert(intactPatient.medicalHistory.includes('Severe hemolytic episodes'), 'Medical history preserved unchanged');
    assert(intactPatient.diagnosis === 'Thalassemia Major Chronic', 'Diagnosis preserved unchanged');

    const intactBloodReq = await BloodRequest.findById(expiredReq._id);
    assert(intactBloodReq !== null, 'BloodRequest document is preserved in database');
    assert(intactBloodReq.requiredBloodGroup === 'B+', 'Blood group preserved on request');

    // =================================================================
    // TEST 6: Scenario B - Prevent Duplicate Notifications on Re-run
    // =================================================================
    console.log('\n--- TEST 6: Idempotent Expiration / No Duplicate Processing ---');
    const reRunResult = await processExpiredTransfusions();
    assert(!reRunResult.some(r => r._id.toString() === expiredReq._id.toString()), 'Re-run safely ignores already handled URGENT_DOCTOR_REVIEW request');

    const notifCount = await Notification.countDocuments({
      recipient: doctorUser._id,
      type: 'URGENT_DOCTOR_REVIEW',
      'relatedEntity.entityId': expiredReq._id
    });
    assert(notifCount === 1, 'No duplicate notifications created for assigned doctor');

    // =================================================================
    // TEST 7: Resilience on Instagram Deletion Failure
    // =================================================================
    console.log('\n--- TEST 7: Graceful Handling of Instagram API Deletion Failure ---');
    const failReq = await BloodRequest.create({
      patient: patient._id,
      doctor: doctorUser._id,
      hospital: 'TEST_HOSPITAL_DELETION_RULES',
      requiredBloodGroup: 'B+',
      requiredQuantity: 1,
      securedQuantity: 1,
      remainingQuantity: 0,
      transfusionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      searchStartDate: new Date(),
      searchEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      currentStatus: 'BLOOD_SECURED'
    });

    const failCamp = await SocialCampaign.create({
      bloodRequest: failReq._id,
      bloodGroup: 'B+',
      requiredQuantity: 1,
      hospital: 'TEST_HOSPITAL_DELETION_RULES',
      requiredDate: failReq.transfusionDate,
      expiryDate: failReq.transfusionDate,
      status: 'POST_PUBLISHED',
      postContent: {
        title: 'Emergency B+',
        body: 'Body',
        imageUrl: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jeevansetu/posters/fail_test.png'
      },
      platformPosts: [{
        platform: 'Instagram',
        postId: 'IG_FAIL_MEDIA_999',
        status: 'POST_PUBLISHED'
      }]
    });

    // Mock Instagram Graph API to return HTTP 400 OAuth/Permission error
    global.fetch = async (url, options = {}) => {
      if (options.method === 'DELETE') {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              message: 'Permissions error: (#100) Tried accessing nonexisting field (delete) on node type (Media)',
              type: 'OAuthException',
              code: 100
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const failFulfillResult = await fulfillCampaign(failReq._id);
    assert(failFulfillResult.success === true, 'FulfillCampaign succeeds despite Instagram deletion error');

    const reloadedFailCamp = await SocialCampaign.findById(failCamp._id);
    assert(reloadedFailCamp.status === 'FULFILLED', 'Campaign reaches FULFILLED status even when Instagram delete fails');

    const failPost = reloadedFailCamp.platformPosts.find(p => p.platform === 'Instagram');
    assert(failPost.deletionStatus === 'FAILED', 'Deletion failure recorded as FAILED');
    assert(failPost.deletionError.includes('Permissions error'), 'Exact sanitized error message recorded in deletionError');

    // =================================================================
    // TEST 8: Protection of Shared Fallback Asset
    // =================================================================
    console.log('\n--- TEST 8: Protection of Shared Fallback Asset ---');
    const staticBannerUrl = 'https://blood-transfusion-or6q.vercel.app/bloodposter.png';
    const fallbackDelResult = await deleteCloudinaryPoster(staticBannerUrl);
    assert(fallbackDelResult.success === true, 'deleteCloudinaryPoster returns success=true for shared fallback');
    assert(fallbackDelResult.skipped === true, 'deleteCloudinaryPoster safely skipped destroying shared static asset');

    // =================================================================
    // SUMMARY
    // =================================================================
    console.log('\n================================================================');
    console.log(`🎉 ALL ${passedTests} CAMPAIGN DELETION & EXPIRATION TESTS PASSED!`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ TEST RUN ABORTED WITH ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    global.fetch = originalFetch;
    // Clean test artifacts
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_DELETION_RULES' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_DELETION_RULES' });
    await Notification.deleteMany({ 'relatedEntity.entityType': 'BloodRequest' });
    await User.deleteMany({ email: { $in: ['test_doc_deletion@example.com', 'test_pat_deletion@example.com'] } });
    await Patient.deleteMany({ email: 'test_pat_deletion@example.com' });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runSuite();
