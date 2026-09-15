const SocialCampaign = require('../models/SocialCampaign');
const SocialMediaAccount = require('../models/SocialMediaAccount');

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

  return {
    title: `🚨 Urgent ${bloodRequest.requiredBloodGroup} Blood Donation Needed (${bloodRequest.hospital})`,
    body,
    hashtags,
    registrationUrl: donorFormUrl
  };
};

/**
 * Creates emergency social campaign tracking record
 */
const createCampaign = async (bloodRequest, contactInfo = {}) => {
  try {
    const expiryDate = new Date(bloodRequest.transfusionDate);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const officialAccounts = await getOfficialSocialAccounts();
    const postContent = generateEmergencyPostText(bloodRequest, officialAccounts, clientUrl);

    const timestamp = Date.now();
    const platformPosts = [
      {
        platform: 'Twitter/X',
        postId: `POST_TW_${timestamp}`,
        postUrl: `${officialAccounts.twitter?.url || 'https://twitter.com/jeevansetu'}/status/${timestamp}`,
        status: 'POST_READY',
        publishedAt: null
      },
      {
        platform: 'Facebook',
        postId: `POST_FB_${timestamp}`,
        postUrl: `${officialAccounts.facebook?.url || 'https://facebook.com/jeevansetu.blood'}/posts/${timestamp}`,
        status: 'POST_READY',
        publishedAt: null
      },
      {
        platform: 'Instagram',
        postId: `POST_IG_${timestamp}`,
        postUrl: `${officialAccounts.instagram?.url || 'https://instagram.com/jeevansetu_org'}/p/${timestamp}/`,
        status: 'POST_READY',
        publishedAt: null
      },
      {
        platform: 'WhatsApp',
        postId: `POST_WA_${timestamp}`,
        postUrl: officialAccounts.whatsapp?.url || 'https://wa.me/919876543210',
        status: 'POST_READY',
        publishedAt: null
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
      message: 'Emergency social media post generated and marked POST_READY. Production API dispatch ready for external credentials.',
      campaign
    };
  } catch (error) {
    console.error('Error creating social campaign:', error);
    throw error;
  }
};

/**
 * Mark campaign as FULFILLED when blood is secured
 */
const fulfillCampaign = async (bloodRequestId) => {
  try {
    const updated = await SocialCampaign.updateMany(
      { bloodRequest: bloodRequestId, status: { $ne: 'FULFILLED' } },
      { $set: { status: 'FULFILLED', fulfilledAt: new Date() } }
    );
    if (updated.modifiedCount > 0) {
      console.log(`[SOCIAL CAMPAIGN FULFILLED] Marked campaigns for Request #${bloodRequestId} as FULFILLED.`);
    }
  } catch (err) {
    console.error('Error fulfilling social campaign:', err);
  }
};

module.exports = {
  createCampaign,
  fulfillCampaign,
  getOfficialSocialAccounts,
  generateEmergencyPostText
};
