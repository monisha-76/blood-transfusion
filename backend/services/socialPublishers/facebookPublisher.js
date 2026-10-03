/**
 * Facebook Page Publisher using official Meta Graph API
 * Endpoint: POST https://graph.facebook.com/v19.0/{page-id}/feed
 * Authentication: Page Access Token (FACEBOOK_PAGE_ACCESS_TOKEN)
 */

const publishToFacebook = async (postContent, officialAccounts = {}) => {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  // Validate required configuration
  const missingKeys = [];
  if (!pageId) missingKeys.push('FACEBOOK_PAGE_ID');
  if (!pageAccessToken) missingKeys.push('FACEBOOK_PAGE_ACCESS_TOKEN');

  if (missingKeys.length > 0) {
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Facebook',
      errorMessage: `Missing required environment configuration: ${missingKeys.join(', ')}. Official Meta Graph API credentials required.`
    };
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`;
    
    // Construct message body with title, body, and registration link
    const message = `${postContent.title}\n\n${postContent.body}\n\n${(postContent.hashtags || []).join(' ')}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        link: postContent.registrationUrl,
        access_token: pageAccessToken
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || `Facebook API error HTTP ${response.status}`;
      console.error('[FACEBOOK PUBLISH FAILED]', errMsg);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Facebook',
        errorMessage: errMsg
      };
    }

    const postId = data.id;
    const postUrl = `https://facebook.com/${postId}`;

    console.log(`[FACEBOOK PUBLISHED] Successfully posted to Page ${pageId}. Post ID: ${postId}`);

    return {
      success: true,
      status: 'POST_PUBLISHED',
      platform: 'Facebook',
      postId,
      postUrl,
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('[FACEBOOK NETWORK ERROR]', error);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Facebook',
      errorMessage: `Network error communicating with Facebook Graph API: ${error.message}`
    };
  }
};

module.exports = {
  publishToFacebook
};
