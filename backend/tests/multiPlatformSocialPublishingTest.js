const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BloodRequest = require('../models/BloodRequest');
const SocialCampaign = require('../models/SocialCampaign');
const User = require('../models/User');
const Patient = require('../models/Patient');
const { publishToFacebook, deleteFacebookPost } = require('../services/socialPublishers/facebookPublisher');
const { publishToTwitter, deleteTwitterPost } = require('../services/socialPublishers/twitterPublisher');
const { publishCampaign, fulfillCampaign, expireCampaign } = require('../services/socialMediaService');

const runMultiPlatformTests = async () => {
  console.log('================================================================');
  console.log('   JEEVANSETU MULTI-PLATFORM SOCIAL PUBLISHING TEST SUITE      ');
  console.log('   (Facebook Pages, X/Twitter, Instagram - MOCKED NETWORKS)    ');
  console.log('================================================================\n');

  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevansetu';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    // Clean up test data before starting
    await BloodRequest.deleteMany({ hospital: 'TEST_MULTI_PLATFORM_HOSPITAL' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_MULTI_PLATFORM_HOSPITAL' });
    await User.deleteMany({ email: { $in: ['test_multi_doc@example.com', 'test_multi_pat@example.com'] } });
    await Patient.deleteMany({ email: 'test_multi_pat@example.com' });

    // Create test user and patient fixtures
    const doctorUser = await User.create({
      name: 'Dr. Multi Platform',
      email: 'test_multi_doc@example.com',
      password: 'HashedPassword123!',
      role: 'DOCTOR',
      phone: '+91-9988776655',
      isActive: true
    });

    const patientUser = await User.create({
      name: 'Test Multi Patient',
      email: 'test_multi_pat@example.com',
      password: 'HashedPassword123!',
      role: 'PATIENT',
      phone: '+91-9988776644',
      isActive: true
    });

    const patient = await Patient.create({
      userId: patientUser._id,
      name: 'Test Multi Patient',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      phone: '+91-9988776644',
      email: 'test_multi_pat@example.com',
      bloodGroup: 'AB+',
      hospital: 'TEST_MULTI_PLATFORM_HOSPITAL',
      attendingDoctor: doctorUser._id,
      diagnosis: 'Acute Anemia',
      patientCondition: 'Stable Transfusion Dependent',
      lastTransfusionDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      nextTransfusionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      transfusionFrequency: 21,
      status: 'Admitted'
    });

    // =================================================================
    // TEST 1: Facebook Page Photo Publishing with Poster & Deletion
    // =================================================================
    console.log('--- TEST 1: Facebook Page Publishing with Generated Poster & Deletion ---');
    process.env.FACEBOOK_PAGE_ID = '109876543210987';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'EAA_TEST_FACEBOOK_PAGE_TOKEN_SECRET_XYZ';

    let fbPhotoEndpointCalled = false;
    let fbReceivedBody = null;

    global.fetch = async (url, options = {}) => {
      if (url.includes('/photos') && options.method === 'POST') {
        fbPhotoEndpointCalled = true;
        fbReceivedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'PHOTO_ID_111',
            post_id: '109876543210987_PHOTO_POST_222'
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fbPostContent = {
      title: '🚨 EMERGENCY: AB+ Blood Urgently Needed',
      body: 'Patient in critical condition at Chennai Test Hospital.',
      hashtags: ['#BloodUrgent', '#SaveLife'],
      registrationUrl: 'https://jeevansetu.org/register',
      imageUrl: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jeevansetu/posters/test_fb.png'
    };

    const fbPublishResult = await publishToFacebook(fbPostContent);
    assert(fbPublishResult.success === true, 'publishToFacebook returns success=true');
    assert(fbPublishResult.status === 'POST_PUBLISHED', 'Facebook status is POST_PUBLISHED');
    assert(fbPublishResult.postId === '109876543210987_PHOTO_POST_222', 'Captures Facebook post ID');
    assert(fbPublishResult.postUrl.includes('109876543210987_PHOTO_POST_222'), 'Post URL is formatted correctly');
    assert(fbPhotoEndpointCalled === true, 'Meta Graph /photos endpoint was invoked');
    assert(fbReceivedBody.url === fbPostContent.imageUrl, 'Cloudinary poster URL was passed to Facebook');
    assert(fbReceivedBody.caption.includes('EMERGENCY: AB+'), 'Caption includes emergency title');
    assert(fbReceivedBody.caption.includes('https://jeevansetu.org/register'), 'Caption includes registration URL');
    console.log('  ✓ Facebook Page photo publishing successfully invoked with poster and caption');

    // Test Facebook post deletion
    let fbDeleteCalled = false;
    global.fetch = async (url, options = {}) => {
      if (options.method === 'DELETE' && url.includes('109876543210987_PHOTO_POST_222')) {
        fbDeleteCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fbDeleteResult = await deleteFacebookPost('109876543210987_PHOTO_POST_222');
    assert(fbDeleteResult.success === true, 'deleteFacebookPost returns success=true');
    assert(fbDeleteCalled === true, 'Facebook DELETE endpoint was invoked');
    console.log('  ✓ Facebook post deletion successfully confirmed');

    // =================================================================
    // TEST 2: Facebook Fallback to /feed When No Image Present
    // =================================================================
    console.log('\n--- TEST 2: Facebook Feed Fallback When No Image Present ---');
    let fbFeedEndpointCalled = false;
    global.fetch = async (url, options = {}) => {
      if (url.includes('/feed') && options.method === 'POST') {
        fbFeedEndpointCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: '109876543210987_FEED_POST_333' })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fbTextContent = {
      title: '🚨 Urgent Blood Need',
      body: 'Text only requirement',
      registrationUrl: 'https://jeevansetu.org/register'
    };

    const fbFeedResult = await publishToFacebook(fbTextContent);
    assert(fbFeedResult.success === true, 'Text-only publish returns success=true');
    assert(fbFeedEndpointCalled === true, 'Meta Graph /feed endpoint was invoked when no image is present');
    assert(fbFeedResult.postId === '109876543210987_FEED_POST_333', 'Feed post ID captured');
    console.log('  ✓ Facebook fallback to /feed verified for text-only posts');

    // =================================================================
    // TEST 3: Facebook Missing Credentials & Error Sanitization
    // =================================================================
    console.log('\n--- TEST 3: Facebook Missing Credentials & Error Sanitization ---');
    delete process.env.FACEBOOK_PAGE_ID;
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    const fbMissingResult = await publishToFacebook(fbPostContent);
    assert(fbMissingResult.success === false, 'publishToFacebook fails when credentials missing');
    assert(fbMissingResult.status === 'POST_FAILED', 'Status is POST_FAILED');
    assert(fbMissingResult.errorMessage.includes('FACEBOOK_PAGE_ID'), 'Reports missing FACEBOOK_PAGE_ID');
    assert(fbMissingResult.errorMessage.includes('FACEBOOK_PAGE_ACCESS_TOKEN'), 'Reports missing FACEBOOK_PAGE_ACCESS_TOKEN');
    console.log('  ✓ Missing credentials cleanly yield POST_FAILED without crashing');

    // Restore FB credentials for subsequent tests
    process.env.FACEBOOK_PAGE_ID = '109876543210987';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'EAA_TEST_SECRET_TOKEN_DO_NOT_LEAK';

    // Verify token redaction in error output
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'Error with access_token=EAA_TEST_SECRET_TOKEN_DO_NOT_LEAK and token EAA_TEST_SECRET_TOKEN_DO_NOT_LEAK invalid'
        }
      })
    });

    const fbErrorResult = await publishToFacebook(fbPostContent);
    assert(fbErrorResult.success === false, 'API error returns success=false');
    assert(!fbErrorResult.errorMessage.includes('EAA_TEST_SECRET_TOKEN_DO_NOT_LEAK'), 'Access token is scrubbed from error message');
    assert(fbErrorResult.errorMessage.includes('[REDACTED'), 'Token replaced with redaction placeholder');
    console.log('  ✓ Sensitive tokens properly sanitized from Facebook error messages');

    // =================================================================
    // TEST 4: Twitter / X Publishing with Media Upload & Deletion
    // =================================================================
    console.log('\n--- TEST 4: Twitter/X Publishing with User-Context & Media Upload ---');
    process.env.TWITTER_API_KEY = 'MOCK_CONSUMER_KEY';
    process.env.TWITTER_API_SECRET = 'MOCK_CONSUMER_SECRET_KEY';
    process.env.TWITTER_ACCESS_TOKEN = 'MOCK_USER_ACCESS_TOKEN';
    process.env.TWITTER_ACCESS_TOKEN_SECRET = 'MOCK_USER_ACCESS_TOKEN_SECRET';

    let twMediaUploadCalled = false;
    let twTweetCreateCalled = false;
    let twTweetPayload = null;
    let twAuthHeader = null;

    global.fetch = async (url, options = {}) => {
      // Mock image download from Cloudinary
      if (url.includes('res.cloudinary.com')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from('MOCK_PNG_IMAGE_BYTES')
        };
      }
      // Mock Twitter v1.1 Media Upload
      if (url.includes('upload.twitter.com/1.1/media/upload.json')) {
        twMediaUploadCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ media_id_string: '987654321012345678' })
        };
      }
      // Mock Twitter v2 Tweet Creation
      if (url.includes('api.twitter.com/2/tweets') && options.method === 'POST') {
        twTweetCreateCalled = true;
        twTweetPayload = JSON.parse(options.body);
        twAuthHeader = options.headers['Authorization'];
        return {
          ok: true,
          status: 201,
          json: async () => ({
            data: { id: '179988776655443322', text: twTweetPayload.text }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const twPostContent = {
      title: '🚨 EMERGENCY: AB+ Needed',
      body: 'Urgent donor required at Chennai Test Hospital. Every second counts.',
      hashtags: ['#BloodDonor', '#SaveLife'],
      registrationUrl: 'https://jeevansetu.org/register',
      imageUrl: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jeevansetu/posters/test_tw.png'
    };

    const twPublishResult = await publishToTwitter(twPostContent);
    assert(twPublishResult.success === true, 'publishToTwitter returns success=true');
    assert(twPublishResult.status === 'POST_PUBLISHED', 'Twitter status is POST_PUBLISHED');
    assert(twPublishResult.postId === '179988776655443322', 'Captures Tweet ID');
    assert(twMediaUploadCalled === true, 'Twitter v1.1 Media Upload was called');
    assert(twTweetCreateCalled === true, 'Twitter v2 Tweet Creation was called');
    assert(twTweetPayload.media.media_ids[0] === '987654321012345678', 'Media ID attached to tweet payload');
    assert(twAuthHeader.startsWith('OAuth oauth_consumer_key="MOCK_CONSUMER_KEY"'), 'OAuth 1.0a Authorization header formatted correctly');
    console.log('  ✓ Twitter/X publishing successfully attached uploaded media poster and verified OAuth 1.0a header');

    // Test Twitter tweet deletion
    let twDeleteCalled = false;
    global.fetch = async (url, options = {}) => {
      if (url.includes('api.twitter.com/2/tweets/179988776655443322') && options.method === 'DELETE') {
        twDeleteCalled = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { deleted: true } })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const twDeleteResult = await deleteTwitterPost('179988776655443322');
    assert(twDeleteResult.success === true, 'deleteTwitterPost returns success=true');
    assert(twDeleteCalled === true, 'Twitter DELETE /2/tweets endpoint was invoked');
    console.log('  ✓ Twitter/X tweet deletion successfully confirmed');

    // =================================================================
    // TEST 5: Twitter / X Graceful Fallback When Media Upload Fails
    // =================================================================
    console.log('\n--- TEST 5: Twitter/X Graceful Fallback When Media Upload Not Permitted ---');
    let twFallbackTweetPayload = null;
    global.fetch = async (url, options = {}) => {
      if (url.includes('res.cloudinary.com')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from('MOCK_IMAGE')
        };
      }
      // Simulate Twitter Free Tier 403 on v1.1 media upload
      if (url.includes('upload.twitter.com/1.1/media/upload.json')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            errors: [{ message: 'Your API access tier does not permit media uploads.', code: 453 }]
          })
        };
      }
      if (url.includes('api.twitter.com/2/tweets') && options.method === 'POST') {
        twFallbackTweetPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ data: { id: 'TWEET_TEXT_ONLY_333' } })
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const twFallbackResult = await publishToTwitter(twPostContent);
    assert(twFallbackResult.success === true, 'Tweet still succeeds when media upload is not permitted');
    assert(twFallbackResult.postId === 'TWEET_TEXT_ONLY_333', 'Returns text tweet ID');
    assert(twFallbackTweetPayload.media === undefined, 'No media attached in fallback payload');
    assert(twFallbackTweetPayload.text.includes('EMERGENCY: AB+'), 'Tweet text intact in fallback');
    console.log('  ✓ Gracefully fell back to text-only tweet when media upload was unpermitted');

    // =================================================================
    // TEST 6: Independent Platform Status & Selective Retry (No Duplication)
    // =================================================================
    console.log('\n--- TEST 6: Independent Platform Status & Selective Retry ---');
    // Ensure all credentials are set
    process.env.INSTAGRAM_ACCOUNT_ID = '17841422425670288';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'MOCK_IG_TOKEN';
    process.env.FACEBOOK_PAGE_ID = '109876543210987';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'MOCK_FB_PAGE_TOKEN';
    process.env.TWITTER_API_KEY = 'MOCK_TW_KEY';
    process.env.TWITTER_API_SECRET = 'MOCK_TW_SECRET';
    process.env.TWITTER_ACCESS_TOKEN = 'MOCK_TW_ACCESS';
    process.env.TWITTER_ACCESS_TOKEN_SECRET = 'MOCK_TW_ACCESS_SECRET';

    const bloodReq = await BloodRequest.create({
      patient: patient._id,
      doctor: doctorUser._id,
      hospital: 'TEST_MULTI_PLATFORM_HOSPITAL',
      requiredBloodGroup: 'AB+',
      requiredQuantity: 2,
      remainingQuantity: 2,
      securedQuantity: 0,
      transfusionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      searchStartDate: new Date(),
      searchEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE'
    });

    const campaign = await SocialCampaign.create({
      bloodRequest: bloodReq._id,
      bloodGroup: 'AB+',
      requiredQuantity: 2,
      hospital: 'TEST_MULTI_PLATFORM_HOSPITAL',
      requiredDate: bloodReq.transfusionDate,
      expiryDate: bloodReq.transfusionDate,
      status: 'POST_READY',
      postContent: {
        title: '🚨 Emergency AB+ Blood Needed',
        body: 'Urgent donor required at Chennai Test Hospital.',
        registrationUrl: 'https://jeevansetu.org/register',
        imageUrl: 'https://res.cloudinary.com/test_cloud/image/upload/v1/jeevansetu/posters/test_multi.png'
      },
      platformPosts: [
        { platform: 'Instagram', status: 'POST_READY' },
        { platform: 'Facebook', status: 'POST_READY' },
        { platform: 'Twitter/X', status: 'POST_READY' }
      ]
    });

    // PASS 1: Instagram succeeds, Facebook and Twitter fail
    let igCalls = 0;
    let fbCalls = 0;
    let twCalls = 0;

    global.fetch = async (url, options = {}) => {
      // Instagram
      if (url.includes('graph.instagram.com')) {
        igCalls++;
        if (url.includes('/media_publish')) {
          return { ok: true, status: 200, json: async () => ({ id: 'IG_MEDIA_REAL_111' }) };
        }
        return { ok: true, status: 200, json: async () => ({ id: 'IG_CONTAINER_111' }) };
      }
      // Facebook fails
      if (url.includes('graph.facebook.com')) {
        fbCalls++;
        return { ok: false, status: 500, json: async () => ({ error: { message: 'Facebook API temporary outage' } }) };
      }
      // Twitter fails
      if (url.includes('api.twitter.com') || url.includes('upload.twitter.com')) {
        twCalls++;
        return { ok: false, status: 503, json: async () => ({ errors: [{ message: 'Twitter API temporary unavailable' }] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const pass1Result = await publishCampaign(campaign._id);
    assert(pass1Result.success === true, 'Top-level campaign succeeds because Instagram published');
    assert(pass1Result.status === 'POST_PUBLISHED', 'Top-level status is POST_PUBLISHED');

    const pass1Camp = await SocialCampaign.findById(campaign._id);
    const igPost1 = pass1Camp.platformPosts.find(p => p.platform === 'Instagram');
    const fbPost1 = pass1Camp.platformPosts.find(p => p.platform === 'Facebook');
    const twPost1 = pass1Camp.platformPosts.find(p => p.platform === 'Twitter/X');

    assert(igPost1.status === 'POST_PUBLISHED', 'Instagram reached POST_PUBLISHED');
    assert(igPost1.postId === 'IG_MEDIA_REAL_111', 'Instagram post ID stored');
    assert(fbPost1.status === 'POST_FAILED', 'Facebook marked POST_FAILED');
    assert(twPost1.status === 'POST_FAILED', 'Twitter marked POST_FAILED');
    console.log('  ✓ Pass 1: Instagram published, Facebook & Twitter independently recorded as POST_FAILED');

    // PASS 2 (Selective Retry): Instagram must be SKIPPED! Facebook succeeds! Twitter fails again!
    const igCallsBeforePass2 = igCalls;
    global.fetch = async (url, options = {}) => {
      if (url.includes('graph.instagram.com')) {
        igCalls++;
        return { ok: true, status: 200, json: async () => ({ id: 'DUPLICATE_IG_UNWANTED' }) };
      }
      if (url.includes('graph.facebook.com')) {
        fbCalls++;
        return { ok: true, status: 200, json: async () => ({ id: 'FB_PHOTO_REAL_222' }) };
      }
      if (url.includes('api.twitter.com') || url.includes('upload.twitter.com')) {
        twCalls++;
        return { ok: false, status: 503, json: async () => ({ errors: [{ message: 'Twitter rate limit' }] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await publishCampaign(campaign._id);
    assert(igCalls === igCallsBeforePass2, 'Zero new Instagram calls made (Idempotent skip)');

    const pass2Camp = await SocialCampaign.findById(campaign._id);
    const igPost2 = pass2Camp.platformPosts.find(p => p.platform === 'Instagram');
    const fbPost2 = pass2Camp.platformPosts.find(p => p.platform === 'Facebook');
    const twPost2 = pass2Camp.platformPosts.find(p => p.platform === 'Twitter/X');

    assert(igPost2.status === 'POST_PUBLISHED' && igPost2.postId === 'IG_MEDIA_REAL_111', 'Instagram unchanged');
    assert(fbPost2.status === 'POST_PUBLISHED' && fbPost2.postId === 'FB_PHOTO_REAL_222', 'Facebook now POST_PUBLISHED');
    assert(twPost2.status === 'POST_FAILED', 'Twitter remains POST_FAILED');
    console.log('  ✓ Pass 2 (Retry): Instagram skipped, Facebook published, Twitter retried without duplicates');

    // PASS 3 (Retry Twitter): Instagram and Facebook must both be SKIPPED!
    const igCallsBeforePass3 = igCalls;
    const fbCallsBeforePass3 = fbCalls;

    global.fetch = async (url, options = {}) => {
      if (url.includes('graph.instagram.com')) {
        igCalls++;
        return { ok: true, status: 200, json: async () => ({ id: 'DUPLICATE_IG' }) };
      }
      if (url.includes('graph.facebook.com')) {
        fbCalls++;
        return { ok: true, status: 200, json: async () => ({ id: 'DUPLICATE_FB' }) };
      }
      if (url.includes('upload.twitter.com')) {
        return { ok: true, status: 200, json: async () => ({ media_id_string: 'TW_MEDIA_333' }) };
      }
      if (url.includes('api.twitter.com/2/tweets')) {
        return { ok: true, status: 201, json: async () => ({ data: { id: 'TW_TWEET_REAL_333' } }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await publishCampaign(campaign._id);
    assert(igCalls === igCallsBeforePass3, 'Instagram was skipped on Pass 3');
    assert(fbCalls === fbCallsBeforePass3, 'Facebook was skipped on Pass 3');

    const pass3Camp = await SocialCampaign.findById(campaign._id);
    const twPost3 = pass3Camp.platformPosts.find(p => p.platform === 'Twitter/X');
    assert(twPost3.status === 'POST_PUBLISHED' && twPost3.postId === 'TW_TWEET_REAL_333', 'Twitter reached POST_PUBLISHED');
    console.log('  ✓ Pass 3 (Retry): Twitter succeeded; Instagram & Facebook untouched');

    // =================================================================
    // TEST 7: Multi-Platform Campaign Fulfillment & Asset Deletion
    // =================================================================
    console.log('\n--- TEST 7: Multi-Platform Campaign Fulfillment & Asset Deletion ---');
    // Track deletion calls for each platform
    const deletedMedia = {
      instagram: null,
      facebook: null,
      twitter: null
    };

    global.fetch = async (url, options = {}) => {
      if (options.method === 'DELETE') {
        if (url.includes('graph.instagram.com')) {
          deletedMedia.instagram = url;
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        }
        if (url.includes('graph.facebook.com')) {
          deletedMedia.facebook = url;
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        }
        if (url.includes('api.twitter.com/2/tweets')) {
          deletedMedia.twitter = url;
          return { ok: true, status: 200, json: async () => ({ data: { deleted: true } }) };
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    // Full blood secured
    bloodReq.securedQuantity = bloodReq.requiredQuantity;
    bloodReq.remainingQuantity = 0;
    bloodReq.currentStatus = 'BLOOD_SECURED';
    await bloodReq.save();

    const fulfillResult = await fulfillCampaign(bloodReq._id);
    assert(fulfillResult.success === true, 'fulfillCampaign returns success=true');

    const fulfilledCamp = await SocialCampaign.findById(campaign._id);
    assert(fulfilledCamp.status === 'FULFILLED', 'Campaign status is FULFILLED');

    assert(deletedMedia.instagram !== null, 'Instagram deletion endpoint was invoked');
    assert(deletedMedia.instagram.includes('IG_MEDIA_REAL_111'), 'Instagram targeted correct media ID');

    assert(deletedMedia.facebook !== null, 'Facebook deletion endpoint was invoked');
    assert(deletedMedia.facebook.includes('FB_PHOTO_REAL_222'), 'Facebook targeted correct post ID');

    assert(deletedMedia.twitter !== null, 'Twitter deletion endpoint was invoked');
    assert(deletedMedia.twitter.includes('TW_TWEET_REAL_333'), 'Twitter targeted correct tweet ID');

    for (const post of fulfilledCamp.platformPosts) {
      assert(post.status === 'DELETED', `Platform ${post.platform} transitioned to DELETED`);
      assert(post.deletionStatus === 'SUCCESS', `Platform ${post.platform} recorded deletionStatus SUCCESS`);
    }
    console.log('  ✓ Multi-platform deletion succeeded across Instagram, Facebook, and Twitter/X on fulfillment');

    // =================================================================
    // TEST 8: Multi-Platform Campaign Expiration Cleanup
    // =================================================================
    console.log('\n--- TEST 8: Multi-Platform Campaign Expiration Cleanup ---');
    const expiredReq = await BloodRequest.create({
      patient: patient._id,
      doctor: doctorUser._id,
      hospital: 'TEST_MULTI_PLATFORM_HOSPITAL',
      requiredBloodGroup: 'AB+',
      requiredQuantity: 2,
      remainingQuantity: 2,
      securedQuantity: 0,
      transfusionDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // in the past
      searchStartDate: new Date(),
      searchEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE'
    });

    const expiredCamp = await SocialCampaign.create({
      bloodRequest: expiredReq._id,
      bloodGroup: 'AB+',
      requiredQuantity: 2,
      hospital: 'TEST_MULTI_PLATFORM_HOSPITAL',
      requiredDate: expiredReq.transfusionDate,
      expiryDate: expiredReq.transfusionDate,
      status: 'POST_PUBLISHED',
      postContent: {
        title: 'Emergency AB+',
        body: 'Expired campaign'
      },
      platformPosts: [
        { platform: 'Instagram', postId: 'IG_EXPIRE_999', status: 'POST_PUBLISHED' },
        { platform: 'Facebook', postId: 'FB_EXPIRE_888', status: 'POST_PUBLISHED' },
        { platform: 'Twitter/X', postId: 'TW_EXPIRE_777', status: 'POST_PUBLISHED' }
      ]
    });

    const expireDeletedMedia = [];
    global.fetch = async (url, options = {}) => {
      if (options.method === 'DELETE') {
        expireDeletedMedia.push(url);
        return { ok: true, status: 200, json: async () => ({ success: true, data: { deleted: true } }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await expireCampaign(expiredReq._id);

    const reloadedExpiredCamp = await SocialCampaign.findById(expiredCamp._id);
    assert(reloadedExpiredCamp.status === 'EXPIRED', 'Campaign marked EXPIRED');
    assert(expireDeletedMedia.some(u => u.includes('IG_EXPIRE_999')), 'Instagram deleted on expiration');
    assert(expireDeletedMedia.some(u => u.includes('FB_EXPIRE_888')), 'Facebook deleted on expiration');
    assert(expireDeletedMedia.some(u => u.includes('TW_EXPIRE_777')), 'Twitter deleted on expiration');

    for (const post of reloadedExpiredCamp.platformPosts) {
      assert(post.status === 'DELETED', `Expired campaign platform ${post.platform} post status is DELETED`);
    }
    console.log('  ✓ Multi-platform expiration cleanup verified across all platforms');

    console.log('\n================================================================');
    console.log('🎉 ALL MULTI-PLATFORM SOCIAL PUBLISHING TESTS PASSED!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ MULTI-PLATFORM TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    global.fetch = originalFetch;
    process.env = originalEnv;

    // Clean up test data
    try {
      await BloodRequest.deleteMany({ hospital: 'TEST_MULTI_PLATFORM_HOSPITAL' });
      await SocialCampaign.deleteMany({ hospital: 'TEST_MULTI_PLATFORM_HOSPITAL' });
      await User.deleteMany({ email: { $in: ['test_multi_doc@example.com', 'test_multi_pat@example.com'] } });
      await Patient.deleteMany({ email: 'test_multi_pat@example.com' });
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    } catch (cleanupErr) {
      // Ignore
    }
  }
};

runMultiPlatformTests();
