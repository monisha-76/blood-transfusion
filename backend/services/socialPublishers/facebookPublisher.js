/**
 * Facebook Page Publisher using official Meta Graph API v24.0
 * Supports photo publishing with Cloudinary dynamic poster and caption,
 * fallback feed text publishing, and post deletion on fulfillment/expiration.
 *
 * Endpoints:
 * - Photo Post: POST https://graph.facebook.com/v24.0/{page-id}/photos
 * - Feed Post:  POST https://graph.facebook.com/v24.0/{page-id}/feed
 * - Delete:     DELETE https://graph.facebook.com/v24.0/{post-id}
 */

/**
 * Sanitizes tokens and sensitive query parameters from error messages and logs
 */
const sanitizeError = (errString, token) => {
  if (!errString) return 'Unknown Facebook API error';
  let sanitized = String(errString);
  if (token && typeof token === 'string' && token.length > 5) {
    sanitized = sanitized.split(token).join('[REDACTED_TOKEN]');
  }
  sanitized = sanitized.replace(/access_token=[a-zA-Z0-9_\-]+/gi, 'access_token=[REDACTED]');
  return sanitized;
};

/**
 * Publishes campaign details to Facebook Page using Meta Graph API
 * If an image URL (e.g. Cloudinary poster) is available, publishes via /{page-id}/photos
 * Otherwise falls back to text/link post via /{page-id}/feed
 *
 * @param {Object} postContent
 * @param {Object} officialAccounts
 * @returns {Promise<Object>}
 */
const publishToFacebook = async (postContent = {}, officialAccounts = {}) => {
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
    // Construct rich message/caption
    const messageParts = [];
    if (postContent.title) messageParts.push(postContent.title);
    if (postContent.body) messageParts.push(postContent.body);
    if (postContent.registrationUrl) messageParts.push(`👉 Willing to donate? Register here: ${postContent.registrationUrl}`);
    if (postContent.hashtags && postContent.hashtags.length > 0) {
      messageParts.push(postContent.hashtags.join(' '));
    }
    const caption = messageParts.join('\n\n');

    let endpoint;
    let requestBody;

    // Use /photos endpoint if dynamic poster image is present, otherwise use /feed
    if (postContent.imageUrl) {
      endpoint = `https://graph.facebook.com/v24.0/${encodeURIComponent(pageId)}/photos`;
      requestBody = {
        url: postContent.imageUrl,
        caption,
        access_token: pageAccessToken
      };
    } else {
      endpoint = `https://graph.facebook.com/v24.0/${encodeURIComponent(pageId)}/feed`;
      requestBody = {
        message: caption,
        link: postContent.registrationUrl,
        access_token: pageAccessToken
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const rawError = data.error?.message || `Facebook API error HTTP ${response.status}`;
      const sanitized = sanitizeError(rawError, pageAccessToken);
      console.error('[FACEBOOK PUBLISH FAILED]', sanitized);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Facebook',
        errorMessage: sanitized
      };
    }

    // /{page-id}/photos returns { id: "photo_id", post_id: "pageId_postId" }
    // /{page-id}/feed returns { id: "pageId_postId" }
    const postId = data.post_id || data.id;
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
    const sanitized = sanitizeError(error.message, pageAccessToken);
    console.error('[FACEBOOK NETWORK ERROR]', sanitized);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Facebook',
      errorMessage: `Network error communicating with Facebook Graph API: ${sanitized}`
    };
  }
};

/**
 * Deletes a published post or photo from Facebook Page using Meta Graph API
 * Endpoint: DELETE https://graph.facebook.com/v24.0/{post-id}
 *
 * @param {string} postId
 * @returns {Promise<{success: boolean, postId: string, errorMessage?: string}>}
 */
const deleteFacebookPost = async (postId) => {
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) {
    return {
      success: false,
      postId,
      errorMessage: 'Missing required environment configuration: FACEBOOK_PAGE_ACCESS_TOKEN. Cannot delete Facebook post.'
    };
  }

  try {
    const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(pageAccessToken)}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (!response.ok || data.error || data.success === false) {
      const rawError = data.error?.message || `Facebook API deletion returned HTTP ${response.status}`;
      const sanitized = sanitizeError(rawError, pageAccessToken);
      console.warn(`[FACEBOOK POST DELETION FAILED] Post ID ${postId}: ${sanitized}`);
      return {
        success: false,
        postId,
        errorMessage: sanitized
      };
    }

    console.log(`[FACEBOOK POST DELETED] Successfully deleted Post ID ${postId}`);
    return {
      success: true,
      postId
    };
  } catch (err) {
    const sanitized = sanitizeError(err.message, pageAccessToken);
    console.error(`[FACEBOOK DELETION NETWORK ERROR] Post ID ${postId}:`, sanitized);
    return {
      success: false,
      postId,
      errorMessage: `Network error during Facebook post deletion: ${sanitized}`
    };
  }
};

module.exports = {
  publishToFacebook,
  deleteFacebookPost
};
