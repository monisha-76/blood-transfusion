const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BloodRequest = require('../models/BloodRequest');
const Patient = require('../models/Patient');
const SocialCampaign = require('../models/SocialCampaign');
const { publishToInstagram } = require('../services/socialPublishers/instagramPublisher');
const { createCampaign, publishCampaign, fulfillCampaign } = require('../services/socialMediaService');
const { processDay3SocialMediaEmergency } = require('../services/bloodSearchService');

const runInstagramTests = async () => {
  console.log('=== STARTING INSTAGRAM REAL INTEGRATION TESTS (MOCKED API RESPONSES) ===\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevansetu';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB:', mongoUri);

  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  try {
    // Cleanup any previous test data
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_INSTAGRAM' });
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_INSTAGRAM' });

    let patient = await Patient.findOne();
    if (!patient) {
      const User = require('../models/User');
      let dummyUser = await User.findOne();
      if (!dummyUser) {
        dummyUser = await User.create({
          name: 'Test Patient User',
          email: 'test_patient_ig@example.com',
          password: 'Password123!',
          role: 'PATIENT',
          phone: '+91-9123456789'
        });
      }
      patient = await Patient.create({
        userId: dummyUser._id,
        name: 'Instagram Test Patient',
        gender: 'Male',
        dateOfBirth: new Date('1995-01-01'),
        lastTransfusionDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        nextTransfusionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        phone: '+91-9123456789',
        email: 'ig_patient@example.com',
        bloodGroup: 'O+',
        diagnosis: 'Thalassemia Major',
        hospital: 'TEST_HOSPITAL_INSTAGRAM'
      });
    }

    // -------------------------------------------------------------
    // TEST 1: Instagram credentials missing -> POST_FAILED
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Missing Credentials Handling ---');
    delete process.env.INSTAGRAM_ACCOUNT_ID;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    const resMissing = await publishToInstagram({
      title: 'Emergency Blood Request',
      body: 'Need O+ blood urgently',
      hashtags: ['#BloodDonation']
    });

    console.log(`Missing credentials result: status=${resMissing.status}, error="${resMissing.errorMessage}"`);
    if (resMissing.status !== 'POST_FAILED' || resMissing.success !== false) {
      throw new Error(`Test 1 Failed: Expected POST_FAILED, got ${resMissing.status}`);
    }
    if (!resMissing.errorMessage.includes('Missing required environment configuration')) {
      throw new Error('Test 1 Failed: Error message should specify missing configuration');
    }
    console.log('✓ Test 1 Passed: Missing credentials cleanly yield POST_FAILED without secrets leak.');

    // Restore test credentials for subsequent tests
    process.env.INSTAGRAM_ACCOUNT_ID = '17841422425670288';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'mock_secret_access_token_12345';
    process.env.INSTAGRAM_IMAGE_URL = 'https://blood-transfusion-or6q.vercel.app/bloodposter.png';

    // -------------------------------------------------------------
    // TEST 2: Media container creation succeeds -> container ID captured internally
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Media Container Creation & ID Tracking ---');
    let fetchCalls = [];
    global.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      if (url.includes('/media') && !url.includes('/media_publish')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: '18122321344747523' })
        };
      }
      // Fail publish step to verify containerId is retained even if publish fails
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Simulated publish error' } })
      };
    };

    const resContainer = await publishToInstagram({
      title: 'Emergency Blood Request',
      body: 'Need O+ blood urgently',
      imageUrl: 'https://blood-transfusion-or6q.vercel.app/bloodposter.png'
    });

    console.log(`Container step result: status=${resContainer.status}, containerId=${resContainer.containerId}`);
    if (resContainer.containerId !== '18122321344747523') {
      throw new Error(`Test 2 Failed: Container ID was not properly captured. Got ${resContainer.containerId}`);
    }
    console.log('✓ Test 2 Passed: Media container creation captures container ID (18122321344747523).');

    // -------------------------------------------------------------
    // TEST 3: Media publish succeeds -> POST_PUBLISHED & published media ID stored
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Media Container Creation + Publishing Flow ---');
    global.fetch = async (url, options) => {
      if (url.includes('/media') && !url.includes('/media_publish')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: '18122321344747523' })
        };
      }
      if (url.includes('/media_publish')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: '18099462203295599' })
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const resPublish = await publishToInstagram({
      title: 'Emergency Blood Request',
      body: 'Need O+ blood urgently',
      hashtags: ['#JeevanSetu', '#BloodDonation']
    });

    console.log(`Publish result: status=${resPublish.status}, postId=${resPublish.postId}, postUrl=${resPublish.postUrl}`);
    if (resPublish.status !== 'POST_PUBLISHED' || resPublish.postId !== '18099462203295599') {
      throw new Error(`Test 3 Failed: Expected POST_PUBLISHED with postId 18099462203295599, got ${resPublish.status} / ${resPublish.postId}`);
    }
    if (!resPublish.postUrl.includes('18099462203295599')) {
      throw new Error('Test 3 Failed: postUrl missing published media ID');
    }
    console.log('✓ Test 3 Passed: Two-step publish completed successfully with media ID stored.');

    // -------------------------------------------------------------
    // TEST 4: Instagram already POST_PUBLISHED -> API is NOT called again (Idempotency)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Idempotency Verification ---');
    const reqTest4 = await BloodRequest.create({
      patient: patient._id,
      hospital: 'TEST_HOSPITAL_INSTAGRAM',
      requiredBloodGroup: 'O+',
      requiredQuantity: 2,
      transfusionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      searchStartDate: new Date(),
      searchEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE'
    });

    const { campaign: campTest4 } = await createCampaign(reqTest4);
    // Mark Instagram post as already published
    const igPost = campTest4.platformPosts.find(p => p.platform === 'Instagram');
    igPost.status = 'POST_PUBLISHED';
    igPost.postId = '18099462203295599';
    igPost.postUrl = 'https://www.instagram.com/p/18099462203295599';
    await campTest4.save();

    let apiCalledForInstagram = false;
    global.fetch = async (url) => {
      if (url.includes('17841422425670288')) {
        apiCalledForInstagram = true;
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };

    await publishCampaign(campTest4._id);
    if (apiCalledForInstagram) {
      throw new Error('Test 4 Failed: Instagram API was invoked even though platform was already POST_PUBLISHED!');
    }

    const reloadedCampTest4 = await SocialCampaign.findById(campTest4._id);
    const reloadedIgPost = reloadedCampTest4.platformPosts.find(p => p.platform === 'Instagram');
    if (reloadedIgPost.status !== 'POST_PUBLISHED' || reloadedIgPost.postId !== '18099462203295599') {
      throw new Error('Test 4 Failed: Post status or ID was mutated during idempotent run!');
    }
    console.log('✓ Test 4 Passed: Already published Instagram post was safely skipped.');

    // -------------------------------------------------------------
    // TEST 5: Instagram POST_FAILED -> retry is allowed
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Failed Post Retry Mechanism ---');
    reloadedIgPost.status = 'POST_FAILED';
    reloadedIgPost.errorMessage = 'Previous simulated error';
    await reloadedCampTest4.save();

    // Configure mock to succeed this time
    global.fetch = async (url) => {
      if (url.includes('/media') && !url.includes('/media_publish')) {
        return { ok: true, status: 200, json: async () => ({ id: '18122321344747523' }) };
      }
      if (url.includes('/media_publish')) {
        return { ok: true, status: 200, json: async () => ({ id: '18099462203295599' }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    await publishCampaign(campTest4._id);
    const retriedCamp = await SocialCampaign.findById(campTest4._id);
    const retriedIgPost = retriedCamp.platformPosts.find(p => p.platform === 'Instagram');
    console.log(`After retry: status=${retriedIgPost.status}, postId=${retriedIgPost.postId}`);
    if (retriedIgPost.status !== 'POST_PUBLISHED' || !retriedIgPost.postId) {
      throw new Error(`Test 5 Failed: Retry should have transitioned Instagram to POST_PUBLISHED, got ${retriedIgPost.status}`);
    }
    console.log('✓ Test 5 Passed: Retry for POST_FAILED platform executed and succeeded.');

    // -------------------------------------------------------------
    // TEST 6: Blood request fully fulfilled -> campaign becomes FULFILLED, publishing stopped
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Blood Request Fulfillment Stops Publishing ---');
    await fulfillCampaign(reqTest4._id);
    const fulfilledCamp = await SocialCampaign.findById(campTest4._id);
    console.log(`Fulfilled campaign status: ${fulfilledCamp.status}`);
    if (fulfilledCamp.status !== 'FULFILLED') {
      throw new Error(`Test 6 Failed: Expected campaign status FULFILLED, got ${fulfilledCamp.status}`);
    }

    let publishCalledAfterFulfillment = false;
    global.fetch = async () => {
      publishCalledAfterFulfillment = true;
      return { ok: true, status: 200, json: async () => ({ id: 'new_id' }) };
    };

    const attemptAfterFulfill = await publishCampaign(campTest4._id);
    if (publishCalledAfterFulfillment || attemptAfterFulfill.status !== 'FULFILLED') {
      throw new Error('Test 6 Failed: Publishing should be strictly prevented when campaign is FULFILLED');
    }
    console.log('✓ Test 6 Passed: FULFILLED status permanently halts publishing.');

    // -------------------------------------------------------------
    // TEST 7: Day-3 campaign -> automatically invokes Instagram publishing service
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Day-3 Automatic Campaign & Publishing Invocation ---');
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const reqDay3 = await BloodRequest.create({
      patient: patient._id,
      hospital: 'TEST_HOSPITAL_INSTAGRAM',
      requiredBloodGroup: 'O+',
      requiredQuantity: 1,
      transfusionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      searchStartDate: threeDaysAgo,
      searchEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE',
      createdAt: threeDaysAgo
    });

    let day3IgInvoked = false;
    global.fetch = async (url) => {
      if (url.includes('17841422425670288')) {
        day3IgInvoked = true;
        if (url.includes('/media') && !url.includes('/media_publish')) {
          return { ok: true, status: 200, json: async () => ({ id: '18122321344747523' }) };
        }
        if (url.includes('/media_publish')) {
          return { ok: true, status: 200, json: async () => ({ id: '18099462203295599' }) };
        }
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    await processDay3SocialMediaEmergency();

    const reloadedReqDay3 = await BloodRequest.findById(reqDay3._id);
    if (!reloadedReqDay3.socialCampaignId) {
      throw new Error('Test 7 Failed: Day-3 blood request did not have socialCampaignId generated');
    }

    const day3Campaign = await SocialCampaign.findById(reloadedReqDay3.socialCampaignId);
    const day3IgPost = day3Campaign.platformPosts.find(p => p.platform === 'Instagram');
    console.log(`Day-3 Instagram Post Status: ${day3IgPost.status}, Post ID: ${day3IgPost.postId}`);
    if (!day3IgInvoked) {
      throw new Error('Test 7 Failed: Day-3 trigger did not invoke Instagram publisher');
    }
    if (day3IgPost.status !== 'POST_PUBLISHED' || day3IgPost.postId !== '18099462203295599') {
      throw new Error(`Test 7 Failed: Expected Instagram post to be POST_PUBLISHED with ID 18099462203295599, got ${day3IgPost.status}`);
    }
    console.log('✓ Test 7 Passed: Day-3 trigger automatically generated campaign and published to Instagram.');

    console.log('\n🎉 ALL 7 INSTAGRAM INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnv;
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_INSTAGRAM' });
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_INSTAGRAM' });
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runInstagramTests();
