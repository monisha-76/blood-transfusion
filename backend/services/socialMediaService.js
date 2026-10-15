const SocialCampaign = require('../models/SocialCampaign');
const SocialMediaAccount = require('../models/SocialMediaAccount');
const BloodRequest = require('../models/BloodRequest');
const { PLATFORM_PUBLISHERS } = require('./socialPublishers');
const { deleteInstagramPost } = require('./socialPublishers/instagramPublisher');
const { deleteCloudinaryPoster } = require('./posterGeneratorService');

/**
 * Fetch official configured social media accounts or return default fallback
 */
const getOfficialSocialAccounts = async () => {
  try {
    let accounts = await SocialMediaAccount.findOne({ isDefault: true });
    if (!accounts) {
      accounts = await SocialMediaAccount.create({
        organizationName: 'JeevanSetu Blood Network',
        instagram: { handle: '@jeevansetu_org', url: 'https://instagram.com/jeevansetu_org' },
        facebook: { pageName: 'JeevanSetu Blood Procurement', url: 'https://facebook.com/jeevansetu.blood' },
        twitter: { handle: '@jeevansetu', url: 'https://twitter.com/jeevansetu' },
        whatsapp: { businessNumber: '+91-9876543210', url: 'https://wa.me/919876543210' },
        isDefault: true
      });
    }
    return accounts;
  } catch (err) {
    console.error('Error fetching social media accounts:', err);
    return {
      instagram: { handle: '@jeevansetu_org' },
      facebook: { pageName: 'JeevanSetu Blood Procurement' },
      twitter: { handle: '@jeevansetu' },
      whatsapp: { businessNumber: '+91-9876543210' }
    };
  }
};

/**
 * Generate formatted public emergency blood request post without exposing sensitive patient details
 */
const generateEmergencyPostText = (bloodRequest, officialAccounts, clientUrl) => {
  const bloodGroupTag = bloodRequest.requiredBloodGroup.replace('+', 'Positive').replace('-', 'Negative');
  const donorFormUrl = `${clientUrl}/public-donor-register`;

  const body = `🚨 URGENT BLOOD DONATION REQUEST 🚨

Blood Group Required: ${bloodRequest.requiredBloodGroup}
Units Required: ${bloodRequest.remainingQuantity || bloodRequest.requiredQuantity}

A patient urgently requires ${bloodRequest.requiredBloodGroup} blood for an upcoming transfusion.

📍 Location:
${bloodRequest.hospital}

If you are eligible and willing to donate, please fill out the voluntary donor form below.

👉 Ready to Donate?
Please fill this form:
${donorFormUrl}

Official Accounts:
Instagram: ${officialAccounts.instagram?.handle || '@jeevansetu_org'}
Facebook: ${officialAccounts.facebook?.pageName || 'JeevanSetu'}
X / Twitter: ${officialAccounts.twitter?.handle || '@jeevansetu'}
WhatsApp: ${officialAccounts.whatsapp?.businessNumber || '+91-9876543210'}`;

  const hashtags = [
    '#BloodDonation',
    '#DonateBlood',
    '#SaveLives',
    `#${bloodGroupTag}`,
    '#JeevanSetuEmergency'
  ];

  const defaultBannerUrl = 'https://blood-transfusion-or6q.vercel.app/bloodposter.png';
  const imageUrl = bloodRequest.imageUrl || process.env.INSTAGRAM_IMAGE_URL || defaultBannerUrl;

  return {
    title: `🚨 Urgent ${bloodRequest.requiredBloodGroup} Blood Donation Needed (${bloodRequest.hospital})`,
    body,
    hashtags,
    registrationUrl: donorFormUrl,
    imageUrl
  };
};

/**
 * Creates emergency social campaign tracking record with initial POST_READY state
 */
const createCampaign = async (bloodRequest, contactInfo = {}) => {
  try {
    const expiryDate = new Date(bloodRequest.transfusionDate);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const officialAccounts = await getOfficialSocialAccounts();
    const postContent = generateEmergencyPostText(bloodRequest, officialAccounts, clientUrl);

    // Dynamic poster generation: overwrite imageUrl with Cloudinary URL if available.
    // Falls back silently to the INSTAGRAM_IMAGE_URL / static URL already in postContent.
    try {
      const { generateAndUploadPoster } = require('./posterGeneratorService');
      const dynamicUrl = await generateAndUploadPoster(bloodRequest);
      if (dynamicUrl) {
        postContent.imageUrl = dynamicUrl;
        console.log(`[POSTER] Dynamic poster URL stored: ${dynamicUrl}`);
      }
    } catch (posterErr) {
      console.warn(`[POSTER GENERATION FAILED] Falling back to static image URL. Reason: ${posterErr.message}`);
      // postContent.imageUrl already holds the env/static fallback — no action needed
    }

    const platformPosts = [
      {
        platform: 'Facebook',
        postId: null,
        postUrl: null,
        status: 'POST_READY',
        publishedAt: null,
        errorMessage: null
      },
      {
        platform: 'Instagram',
        postId: null,
        postUrl: null,
        status: 'POST_READY',
        publishedAt: null,
        errorMessage: null
      },
      {
        platform: 'Twitter/X',
        postId: null,
        postUrl: null,
        status: 'POST_READY',
        publishedAt: null,
        errorMessage: null
      },
      {
        platform: 'WhatsApp',
        postId: null,
        postUrl: null,
        status: 'POST_READY',
        publishedAt: null,
        errorMessage: null
      }
    ];

    const campaign = await SocialCampaign.create({
      bloodRequest: bloodRequest._id,
      bloodGroup: bloodRequest.requiredBloodGroup,
      requiredQuantity: bloodRequest.remainingQuantity || bloodRequest.requiredQuantity,
      hospital: bloodRequest.hospital,
      requiredDate: bloodRequest.transfusionDate,
      postContent,
      officialAccounts: {
        instagram: officialAccounts.instagram?.handle,
        facebook: officialAccounts.facebook?.pageName,
        twitter: officialAccounts.twitter?.handle,
        whatsapp: officialAccounts.whatsapp?.businessNumber
      },
      contactDetails: {
        phone: contactInfo.phone || officialAccounts.whatsapp?.businessNumber || '+91-9876543210',
        email: contactInfo.email || 'emergency@jeevansetu.org',
        contactPerson: contactInfo.contactPerson || 'Blood Procurement Coordinator'
      },
      status: 'POST_READY',
      platformPosts,
      expiryDate
    });

    console.log(`[SOCIAL EMERGENCY CAMPAIGN CREATED] Campaign #${campaign._id} for ${bloodRequest.requiredBloodGroup} blood (Status: POST_READY).`);

    return {
      success: true,
      status: 'POST_READY',
      campaign
    };
  } catch (error) {
    console.error('Error creating social campaign:', error);
    throw error;
  }
};

/**
 * Executes automatic social-media publishing across official platform APIs
 * Idempotent: skips platforms already marked POST_PUBLISHED
 * @param {string|ObjectId} campaignId 
 */
const publishCampaign = async (campaignId) => {
  try {
    const campaign = await SocialCampaign.findById(campaignId);
    if (!campaign) throw new Error(`Social Campaign #${campaignId} not found`);

    // Strictly prevent deleted, expired, or fulfilled campaigns from being published
    const terminalStatuses = ['FULFILLED', 'EXPIRED', 'DELETED'];
    if (terminalStatuses.includes(campaign.status)) {
      console.log(`[PUBLISH SKIPPED] Campaign #${campaignId} is in terminal status: ${campaign.status}. Cannot republish.`);
      return { success: false, status: campaign.status, message: `Campaign is already ${campaign.status}.` };
    }

    const officialAccounts = await getOfficialSocialAccounts();
    let anyPublished = false;
    let anyFailed = false;

    for (const postItem of campaign.platformPosts) {
      // Idempotency: Do not republish if already published or in terminal status
      if (['POST_PUBLISHED', 'FULFILLED', 'DELETED', 'EXPIRED'].includes(postItem.status)) {
        console.log(`[IDEMPOTENT SKIP] ${postItem.platform} already in terminal/published status: ${postItem.status} for Campaign #${campaign._id} (Post ID: ${postItem.postId})`);
        if (postItem.status === 'POST_PUBLISHED') anyPublished = true;
        continue;
      }

      const publisher = PLATFORM_PUBLISHERS[postItem.platform];
      if (!publisher) {
        postItem.status = 'POST_FAILED';
        postItem.errorMessage = `No publisher registered for platform: ${postItem.platform}`;
        anyFailed = true;
        continue;
      }

      console.log(`[PUBLISHING TO ${postItem.platform.toUpperCase()}] Campaign #${campaign._id}...`);
      const result = await publisher(campaign.postContent, officialAccounts);

      if (result.success && result.status === 'POST_PUBLISHED') {
        postItem.status = 'POST_PUBLISHED';
        postItem.postId = result.postId;
        postItem.postUrl = result.postUrl;
        if (result.containerId) postItem.containerId = result.containerId;
        postItem.publishedAt = result.publishedAt || new Date();
        postItem.errorMessage = null;
        anyPublished = true;
      } else {
        postItem.status = 'POST_FAILED';
        if (result.containerId) postItem.containerId = result.containerId;
        postItem.errorMessage = result.errorMessage || 'Platform API publishing failed';
        anyFailed = true;
      }
    }

    // Top-level campaign status
    if (anyPublished) {
      campaign.status = 'POST_PUBLISHED';
      campaign.publishedAt = campaign.publishedAt || new Date();
    } else {
      campaign.status = 'POST_FAILED';
    }

    await campaign.save();

    console.log(`[CAMPAIGN PUBLISH SUMMARY] Campaign #${campaign._id} final status: ${campaign.status}`);
    return {
      success: anyPublished,
      status: campaign.status,
      campaign
    };
  } catch (error) {
    console.error(`Error publishing campaign #${campaignId}:`, error);
    throw error;
  }
};

/**
 * Rule 1: When blood is fully secured:
 * - Mark the campaign as FULFILLED.
 * - Delete its published Instagram post using the existing API integration where supported.
 * - Delete its generated Cloudinary poster.
 * - Never mark a request as fulfilled unless the full required quantity is secured.
 * - Prevent deleted campaigns from being republished.
 * - Handle deletion failures safely and record their actual status.
 */
const fulfillCampaign = async (bloodRequestId) => {
  try {
    const bloodReq = await BloodRequest.findById(bloodRequestId);
    if (!bloodReq) {
      console.warn(`[FULFILL WARNING] BloodRequest #${bloodRequestId} not found.`);
      return { success: false, reason: 'BloodRequest not found' };
    }

    // Rule: Never mark a request/campaign as fulfilled unless full required quantity is secured
    if (bloodReq.remainingQuantity > 0 || bloodReq.securedQuantity < bloodReq.requiredQuantity) {
      console.warn(`[FULFILL REJECTED] Cannot fulfill campaign for BloodRequest #${bloodRequestId}: required=${bloodReq.requiredQuantity}, secured=${bloodReq.securedQuantity}, remaining=${bloodReq.remainingQuantity}. Full quantity is not secured.`);
      return {
        success: false,
        reason: 'Required blood quantity is not fully secured'
      };
    }

    const campaigns = await SocialCampaign.find({
      bloodRequest: bloodRequestId,
      status: { $nin: ['FULFILLED', 'DELETED'] }
    });

    for (const campaign of campaigns) {
      campaign.status = 'FULFILLED';
      campaign.fulfilledAt = new Date();

      // 1. Delete published Instagram post if present
      for (const postItem of campaign.platformPosts) {
        if (postItem.platform === 'Instagram' && postItem.postId) {
          console.log(`[FULFILL CAMPAIGN] Deleting Instagram post ${postItem.postId} for Campaign #${campaign._id}...`);
          const igDelResult = await deleteInstagramPost(postItem.postId);
          if (igDelResult.success) {
            postItem.status = 'DELETED';
            postItem.deletedAt = new Date();
            postItem.deletionStatus = 'SUCCESS';
            postItem.deletionError = null;
          } else {
            postItem.deletionStatus = 'FAILED';
            postItem.deletionError = igDelResult.errorMessage;
            console.warn(`[FULFILL CAMPAIGN] Instagram post deletion failed safely: ${igDelResult.errorMessage}`);
          }
        } else if (postItem.status !== 'DELETED') {
          postItem.status = 'FULFILLED';
        }
      }

      // 2. Delete generated Cloudinary poster if present
      if (campaign.postContent?.imageUrl) {
        console.log(`[FULFILL CAMPAIGN] Deleting Cloudinary poster for Campaign #${campaign._id}...`);
        const cldDelResult = await deleteCloudinaryPoster(campaign.postContent.imageUrl);
        if (!cldDelResult.success && !cldDelResult.skipped) {
          console.warn(`[FULFILL CAMPAIGN] Cloudinary poster deletion failed safely: ${cldDelResult.errorMessage}`);
        }
      }

      await campaign.save();
      console.log(`[SOCIAL CAMPAIGN FULFILLED] Marked Campaign #${campaign._id} for BloodRequest #${bloodRequestId} as FULFILLED.`);
    }

    return { success: true };
  } catch (err) {
    console.error('Error fulfilling social campaign:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Rule 2: When the patient's transfusion date expires and blood is still needed (remainingQuantity > 0):
 * - Delete the campaign's Instagram post and generated Cloudinary poster.
 * - Transition campaign status to EXPIRED.
 * - Handle deletion failures safely and record actual status.
 */
const expireCampaign = async (bloodRequestId) => {
  try {
    const campaigns = await SocialCampaign.find({
      bloodRequest: bloodRequestId,
      status: { $nin: ['FULFILLED', 'EXPIRED', 'DELETED'] }
    });

    for (const campaign of campaigns) {
      campaign.status = 'EXPIRED';
      campaign.deletedAt = new Date();
      campaign.deletionReason = 'TRANSFUSION_DATE_EXPIRED';

      // 1. Delete published Instagram post if present
      for (const postItem of campaign.platformPosts) {
        if (postItem.platform === 'Instagram' && postItem.postId) {
          console.log(`[EXPIRE CAMPAIGN] Deleting Instagram post ${postItem.postId} for Campaign #${campaign._id}...`);
          const igDelResult = await deleteInstagramPost(postItem.postId);
          if (igDelResult.success) {
            postItem.status = 'DELETED';
            postItem.deletedAt = new Date();
            postItem.deletionStatus = 'SUCCESS';
            postItem.deletionError = null;
          } else {
            postItem.status = 'EXPIRED';
            postItem.deletionStatus = 'FAILED';
            postItem.deletionError = igDelResult.errorMessage;
            console.warn(`[EXPIRE CAMPAIGN] Instagram post deletion failed safely: ${igDelResult.errorMessage}`);
          }
        } else {
          postItem.status = 'EXPIRED';
        }
      }

      // 2. Delete generated Cloudinary poster if present
      if (campaign.postContent?.imageUrl) {
        console.log(`[EXPIRE CAMPAIGN] Deleting Cloudinary poster for Campaign #${campaign._id}...`);
        const cldDelResult = await deleteCloudinaryPoster(campaign.postContent.imageUrl);
        if (!cldDelResult.success && !cldDelResult.skipped) {
          console.warn(`[EXPIRE CAMPAIGN] Cloudinary poster deletion failed safely: ${cldDelResult.errorMessage}`);
        }
      }

      await campaign.save();
      console.log(`[SOCIAL CAMPAIGN EXPIRED] Marked Campaign #${campaign._id} for BloodRequest #${bloodRequestId} as EXPIRED.`);
    }

    return { success: true };
  } catch (err) {
    console.error('Error expiring social campaign:', err);
    return { success: false, error: err.message };
  }
};

module.exports = {
  createCampaign,
  publishCampaign,
  fulfillCampaign,
  expireCampaign,
  getOfficialSocialAccounts,
  generateEmergencyPostText
};
