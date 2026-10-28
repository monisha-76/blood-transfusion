const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const https = require('https');

dotenv.config({ path: path.join(__dirname, '../.env') });

const BloodRequest = require('../models/BloodRequest');
const SocialCampaign = require('../models/SocialCampaign');
const { processDay3SocialMediaEmergency } = require('../services/bloodSearchService');

const fetchInstagramPermalink = async (mediaId, token) => {
  if (!mediaId || !token) return null;
  return new Promise((resolve) => {
    const url = `https://graph.instagram.com/v24.0/${mediaId}?fields=permalink,timestamp&access_token=${token}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.permalink || null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
};

const runTest = async () => {
  console.log('================================================================');
  console.log('   DAY-3 AUTOMATIC BLOOD EMERGENCY PUBLISHING E2E TEST          ');
  console.log('   Platforms: Facebook Page (Blood Emergency) + Instagram       ');
  console.log('================================================================\n');

  const targetRequestId = '6ae07533968c168aef4c85c2';
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI missing from environment.');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.\n');

  try {
    // 1. Verify Target Test Request
    console.log(`[STAGE 1: VERIFY TARGET TEST REQUEST #${targetRequestId}]`);
    const testReq = await BloodRequest.findById(targetRequestId);
    if (!testReq) {
      throw new Error(`Dedicated test request #${targetRequestId} not found in database!`);
    }

    console.log(`- Hospital: ${testReq.hospital}`);
    console.log(`- Blood Group: ${testReq.requiredBloodGroup}`);
    console.log(`- Remaining Units: ${testReq.remainingQuantity} / ${testReq.requiredQuantity}`);
    console.log(`- Current Status: ${testReq.currentStatus}`);
    console.log(`- Created At: ${testReq.createdAt.toISOString()}`);
    console.log(`- Existing Social Campaign: ${testReq.socialCampaignId || 'None'}`);

    if (testReq.socialCampaignId) {
      throw new Error(`Test request #${targetRequestId} already has a social campaign assigned (${testReq.socialCampaignId})!`);
    }

    // 2. Execute existing Day-3 workflow
    console.log('\n[STAGE 2: EXECUTING PRODUCTION processDay3SocialMediaEmergency()]');
    console.log('Triggering automated Day-3 emergency detection, campaign creation, and publishing...\n');
    
    await processDay3SocialMediaEmergency();

    // 3. Verify Day-3 Detection & Campaign Linking
    console.log('\n[STAGE 3: VERIFYING MONGODB STATUS & CAMPAIGN LINKAGE]');
    const reloadedReq = await BloodRequest.findById(targetRequestId);
    if (!reloadedReq.socialCampaignId) {
      throw new Error(`BloodRequest #${targetRequestId} was not assigned a socialCampaignId by processDay3SocialMediaEmergency!`);
    }

    console.log(`✓ Day-3 Detection Succeeded!`);
    console.log(`- Updated Status: ${reloadedReq.currentStatus}`);
    console.log(`- Linked SocialCampaign ID: ${reloadedReq.socialCampaignId}`);

    // 4. Inspect SocialCampaign & Individual Platform Results
    console.log('\n[STAGE 4: INSPECTING PUBLISHED CAMPAIGN & PLATFORM STATUSES]');
    const campaign = await SocialCampaign.findById(reloadedReq.socialCampaignId);
    if (!campaign) {
      throw new Error(`Created SocialCampaign #${reloadedReq.socialCampaignId} not found in MongoDB!`);
    }

    console.log(`- Campaign Top-Level Status: ${campaign.status}`);
    console.log(`- Poster Image URL: ${campaign.postContent?.imageUrl}`);
    console.log(`- Caption Preview: ${campaign.postContent?.body?.substring(0, 100)}...`);

    const fbPost = campaign.platformPosts.find(p => p.platform === 'Facebook');
    const igPost = campaign.platformPosts.find(p => p.platform === 'Instagram');

    console.log('\n--- FACEBOOK PUBLISHING RESULT ---');
    if (fbPost) {
      console.log(`- Status: ${fbPost.status}`);
      console.log(`- Post ID: ${fbPost.postId || 'None'}`);
      console.log(`- Post URL: ${fbPost.postUrl || 'None'}`);
      if (fbPost.errorMessage) console.log(`- Error: ${fbPost.errorMessage}`);
    } else {
      console.log('- Facebook platform entry NOT FOUND in campaign platformPosts!');
    }

    console.log('\n--- INSTAGRAM PUBLISHING RESULT ---');
    let igPermalink = null;
    if (igPost) {
      console.log(`- Status: ${igPost.status}`);
      console.log(`- Container ID: ${igPost.containerId || 'None'}`);
      console.log(`- Media ID: ${igPost.postId || 'None'}`);
      console.log(`- Post URL: ${igPost.postUrl || 'None'}`);
      if (igPost.errorMessage) console.log(`- Error: ${igPost.errorMessage}`);

      if (igPost.postId) {
        igPermalink = await fetchInstagramPermalink(igPost.postId, process.env.INSTAGRAM_ACCESS_TOKEN);
        if (igPermalink) {
          console.log(`- Live Instagram Permalink: ${igPermalink}`);
        }
      }
    } else {
      console.log('- Instagram platform entry NOT FOUND in campaign platformPosts!');
    }

    console.log('\n================================================================');
    console.log('                    FINAL TEST SUMMARY                          ');
    console.log('================================================================');
    console.log(`Day-3 Detection:             ${reloadedReq.currentStatus === 'PUBLIC_RECRUITMENT' ? 'PASS' : 'FAIL'}`);
    console.log(`Automatic Campaign Creation:  ${campaign ? 'PASS' : 'FAIL'}`);
    console.log(`Facebook Live Publishing:    ${fbPost?.status === 'POST_PUBLISHED' && fbPost?.postId ? 'PASS' : 'FAIL'}`);
    console.log(`Instagram Live Publishing:   ${igPost?.status === 'POST_PUBLISHED' && igPost?.postId ? 'PASS' : 'FAIL'}`);
    console.log(`MongoDB Status Persistence:  PASS`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runTest();
