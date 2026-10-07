const SocialCampaign = require('../models/SocialCampaign');
const SocialMediaAccount = require('../models/SocialMediaAccount');
const { PLATFORM_PUBLISHERS } = require('./socialPublishers');

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

    if (campaign.status === 'FULFILLED') {
      console.log(`[PUBLISH SKIPPED] Campaign #${campaignId} is already FULFILLED.`);
      return { success: false, status: 'FULFILLED', message: 'Campaign is already fulfilled.' };
    }

    const officialAccounts = await getOfficialSocialAccounts();
    let anyPublished = false;
    let anyFailed = false;

    for (const postItem of campaign.platformPosts) {
      // Idempotency: Do not republish if already published
      if (postItem.status === 'POST_PUBLISHED') {
        console.log(`[IDEMPOTENT SKIP] ${postItem.platform} already published for Campaign #${campaign._id} (Post ID: ${postItem.postId})`);
        anyPublished = true;
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
 * Mark campaign as FULFILLED when blood is secured and stop further publishing/retries
 */
const fulfillCampaign = async (bloodRequestId) => {
  try {
    const campaigns = await SocialCampaign.find({
      bloodRequest: bloodRequestId,
      status: { $ne: 'FULFILLED' }
    });

    for (const campaign of campaigns) {
      campaign.status = 'FULFILLED';
      campaign.fulfilledAt = new Date();

      // Update all platform posts to FULFILLED
      for (const postItem of campaign.platformPosts) {
        postItem.status = 'FULFILLED';
      }

      await campaign.save();
      console.log(`[SOCIAL CAMPAIGN FULFILLED] Marked Campaign #${campaign._id} for BloodRequest #${bloodRequestId} as FULFILLED.`);
    }
  } catch (err) {
    console.error('Error fulfilling social campaign:', err);
  }
};

module.exports = {
  createCampaign,
  publishCampaign,
  fulfillCampaign,
  getOfficialSocialAccounts,
  generateEmergencyPostText
};
