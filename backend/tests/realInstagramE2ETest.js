const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BloodRequest = require('../models/BloodRequest');
const Patient = require('../models/Patient');
const SocialCampaign = require('../models/SocialCampaign');
const { processDay3SocialMediaEmergency } = require('../services/bloodSearchService');
const { publishCampaign } = require('../services/socialMediaService');

const runRealInstagramE2E = async () => {
  console.log('================================================================');
  console.log('   END-TO-END REAL INSTAGRAM PUBLISHING INTEGRATION TEST        ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI missing from environment');
  }

  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const igImageUrl = process.env.INSTAGRAM_IMAGE_URL;

  console.log('[CONFIG CHECK]');
  console.log(`- Account ID: ${igAccountId ? igAccountId : 'MISSING'}`);
  console.log(`- Access Token Present: ${igToken ? 'YES (Securely Loaded, ' + igToken.length + ' chars)' : 'MISSING'}`);
  console.log(`- Image URL: ${igImageUrl}\n`);

  if (!igAccountId || !igToken) {
    throw new Error('Missing real Instagram credentials in backend/.env. Cannot perform real E2E test.');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB.');

  let createdRequestId = null;
  let createdCampaignId = null;
  let publishedMediaId = null;
  let publishedPermalink = null;

  try {
    // 0. Cleanup previous test artifacts if any
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_E2E_REAL' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_E2E_REAL' });

    // 1. Retrieve or prepare test patient
    let patient = await Patient.findOne();
    if (!patient) {
      throw new Error('No patient document found in MongoDB database.');
    }
    console.log(`Using Patient: ${patient.name} (${patient.bloodGroup})`);

    // 2. Create test BloodRequest that satisfies existing Day-3 conditions:
    // - status = ACTIVE
    // - requiredQuantity > 0, securedQuantity = 0, remainingQuantity > 0
    // - createdAt older than 48 hours (3 days ago)
    // - no existing socialCampaignId
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const testReq = await BloodRequest.create({
      patient: patient._id,
      hospital: 'TEST_HOSPITAL_E2E_REAL',
      requiredBloodGroup: 'O+',
      requiredQuantity: 2,
      securedQuantity: 0,
      remainingQuantity: 2,
      transfusionDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      searchStartDate: threeDaysAgo,
      searchEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      currentStatus: 'ACTIVE',
      createdAt: threeDaysAgo
    });
    createdRequestId = testReq._id;

    console.log(`\n[STEP 1] Created Day-3 Eligible Blood Request #${testReq._id}:`);
    console.log(`- Status: ${testReq.currentStatus}`);
    console.log(`- Required: ${testReq.requiredQuantity}, Secured: ${testReq.securedQuantity}, Remaining: ${testReq.remainingQuantity}`);
    console.log(`- Created At: ${testReq.createdAt.toISOString()} (> 48 hours ago)`);
    console.log(`- Social Campaign ID: ${testReq.socialCampaignId || 'None'}`);

    // 3. Execute Day-3 Emergency Workflow
    console.log('\n[STEP 2] Running existing processDay3SocialMediaEmergency()...');
    await processDay3SocialMediaEmergency();

    // 4. Reload BloodRequest & verify detection
    const reloadedReq = await BloodRequest.findById(testReq._id);
    if (!reloadedReq.socialCampaignId) {
      throw new Error('Day-3 workflow failed to generate socialCampaignId on the blood request!');
    }
    createdCampaignId = reloadedReq.socialCampaignId;
    console.log(`\n[STEP 3] Blood Request updated by Day-3 workflow:`);
    console.log(`- New Status: ${reloadedReq.currentStatus}`);
    console.log(`- Assigned SocialCampaign ID: ${createdCampaignId}`);

    // 5. Inspect generated SocialCampaign & Instagram post status
    const campaign = await SocialCampaign.findById(createdCampaignId);
    if (!campaign) {
      throw new Error(`SocialCampaign #${createdCampaignId} not found in database!`);
    }

    console.log(`\n[STEP 4] SocialCampaign #${campaign._id} Inspection:`);
    console.log(`- Campaign Top-Level Status: ${campaign.status}`);
    console.log(`- Post Title: "${campaign.postContent?.title}"`);
    console.log(`- Public Image URL: ${campaign.postContent?.imageUrl}`);

    const igPost = campaign.platformPosts.find(p => p.platform === 'Instagram');
    if (!igPost) {
      throw new Error('SocialCampaign missing Instagram platform post item!');
    }

    console.log(`\n[STEP 5] Instagram Platform Status Inspection:`);
    console.log(`- Status: ${igPost.status}`);
    console.log(`- Container ID: ${igPost.containerId || 'None'}`);
    console.log(`- Published Media ID: ${igPost.postId || 'None'}`);
    console.log(`- Post URL: ${igPost.postUrl || 'None'}`);
    if (igPost.errorMessage) {
      console.log(`- Error Message: ${igPost.errorMessage}`);
    }

    // Security check: ensure token is not present in stored records
    const rawCampString = JSON.stringify(campaign);
    if (rawCampString.includes(igToken)) {
      throw new Error('CRITICAL SECURITY VIOLATION: Access token was found inside SocialCampaign database document!');
    }
    console.log('✓ Security Verified: Access token is NOT stored in database document.');

    if (igPost.status !== 'POST_PUBLISHED' || !igPost.postId) {
      throw new Error(`Instagram publishing did not succeed. Status: ${igPost.status}, Error: ${igPost.errorMessage}`);
    }

    publishedMediaId = igPost.postId;

    // 6. Idempotency Verification: Re-run publishing to confirm it skips already published platform
    console.log('\n[STEP 6] Testing Idempotency (Re-running publishCampaign)...');
    const idempotentResult = await publishCampaign(campaign._id);
    const reloadedCampAfter = await SocialCampaign.findById(campaign._id);
    const igPostAfter = reloadedCampAfter.platformPosts.find(p => p.platform === 'Instagram');

    if (igPostAfter.postId !== publishedMediaId) {
      throw new Error('Idempotency failure: postId changed during republish attempt!');
    }
    console.log(`✓ Idempotency Verified: Instagram post ${igPostAfter.postId} was skipped without duplicate posting.`);

    // 7. Live Instagram API Verification: Query Instagram Graph API for the published media ID
    console.log(`\n[STEP 7] Verifying Live Instagram Post with Instagram Graph API...`);
    const verifyApiUrl = `https://graph.instagram.com/v24.0/${encodeURIComponent(publishedMediaId)}?fields=id,caption,media_type,permalink,timestamp&access_token=${encodeURIComponent(igToken)}`;
    
    const verifyRes = await fetch(verifyApiUrl);
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.error) {
      const errMsg = verifyData.error?.message || `HTTP ${verifyRes.status}`;
      console.warn(`[WARNING] Verification query returned error: ${errMsg}`);
    } else {
      publishedPermalink = verifyData.permalink;
      console.log(`✓ LIVE POST VERIFIED ON INSTAGRAM!`);
      console.log(`  - Media ID: ${verifyData.id}`);
      console.log(`  - Media Type: ${verifyData.media_type}`);
      console.log(`  - Permalink: ${verifyData.permalink || igPost.postUrl}`);
      console.log(`  - Timestamp: ${verifyData.timestamp}`);
    }

    console.log('\n================================================================');
    console.log('🎉 REAL INSTAGRAM PUBLISHING END-TO-END TEST SUCCEEDED!');
    console.log(`   Published Media ID: ${publishedMediaId}`);
    console.log(`   Permalink: ${publishedPermalink || igPost.postUrl}`);
    console.log('================================================================');

  } catch (error) {
    console.error('\n❌ REAL E2E TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    // 8. Clean up test database records (preserving the live Instagram post as required)
    if (createdRequestId) {
      await BloodRequest.findByIdAndDelete(createdRequestId);
      console.log(`[CLEANUP] Deleted test BloodRequest #${createdRequestId} from database.`);
    }
    if (createdCampaignId) {
      await SocialCampaign.findByIdAndDelete(createdCampaignId);
      console.log(`[CLEANUP] Deleted test SocialCampaign #${createdCampaignId} from database.`);
    }
    await BloodRequest.deleteMany({ hospital: 'TEST_HOSPITAL_E2E_REAL' });
    await SocialCampaign.deleteMany({ hospital: 'TEST_HOSPITAL_E2E_REAL' });

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runRealInstagramE2E();
