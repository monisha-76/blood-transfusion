const crypto = require('crypto');

/**
 * X / Twitter API v2 Publisher
 * Supports tweet creation with user-context authentication (OAuth 1.0a or OAuth 2.0 User Access Token),
 * poster image upload via v1.1 upload API (where permitted by API access tier),
 * text truncation at 280 characters with graceful fallback, and tweet deletion on fulfillment/expiration.
 *
 * Endpoints:
 * - Tweet Creation: POST https://api.twitter.com/2/tweets
 * - Media Upload:   POST https://upload.twitter.com/1.1/media/upload.json
 * - Tweet Deletion: DELETE https://api.twitter.com/2/tweets/{id}
 */

/**
 * Percent encode helper per RFC 3986 / RFC 5849
 */
const percentEncode = (str) => {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
};

/**
 * Generate OAuth 1.0a Authorization header for HTTP requests
 */
const generateOAuth1Header = (method, url, oauthParams, consumerSecret, tokenSecret) => {
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
    .join('&');

  const signatureBaseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret || '')}`;

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  const authHeaderEntries = {
    ...oauthParams,
    oauth_signature: signature
  };

  const headerParts = Object.keys(authHeaderEntries)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(authHeaderEntries[key])}"`);

  return `OAuth ${headerParts.join(', ')}`;
};

/**
 * Sanitizes tokens and sensitive query parameters from error messages and logs
 */
const sanitizeTwitterError = (errString, sensitiveTokens = []) => {
  if (!errString) return 'Unknown X/Twitter API error';
  let sanitized = String(errString);
  for (const token of sensitiveTokens) {
    if (token && typeof token === 'string' && token.length > 5) {
      sanitized = sanitized.split(token).join('[REDACTED]');
    }
  }
  sanitized = sanitized.replace(/oauth_signature="[^"]+"/gi, 'oauth_signature="[REDACTED]"');
  sanitized = sanitized.replace(/Bearer [a-zA-Z0-9_\-\.%]+/gi, 'Bearer [REDACTED]');
  return sanitized;
};

/**
 * Attempts to upload a poster image to Twitter Media Upload API (v1.1)
 * Returns media_id_string on success, or throws an error if unpermitted or failed.
 */
const uploadTwitterMedia = async (imageUrl, credentials) => {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret, userAccessToken } = credentials;

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download poster image: HTTP ${imgRes.status}`);
  }
  const arrayBuffer = await imgRes.arrayBuffer();

  const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
  let authHeader = null;

  if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0'
    };
    authHeader = generateOAuth1Header('POST', uploadUrl, oauthParams, consumerSecret, accessTokenSecret);
  } else if (userAccessToken) {
    authHeader = `Bearer ${userAccessToken}`;
  } else {
    throw new Error('No user-context credentials available for media upload');
  }

  const formData = new FormData();
  const blob = new Blob([arrayBuffer], { type: 'image/png' });
  formData.append('media', blob, 'emergency_poster.png');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader
    },
    body: formData
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || uploadData.errors || !uploadData.media_id_string) {
    const err = uploadData.errors?.[0]?.message || uploadData.error || `HTTP ${uploadRes.status}`;
    throw new Error(err);
  }

  return uploadData.media_id_string;
};

/**
 * Publishes campaign details to X / Twitter using Twitter API v2
 * Supports attached media when configured access level permits media upload
 *
 * @param {Object} postContent
 * @param {Object} officialAccounts
 * @returns {Promise<Object>}
 */
const publishToTwitter = async (postContent = {}, officialAccounts = {}) => {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY || process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || process.env.TWITTER_ACCESS_SECRET;
  const userAccessToken = process.env.TWITTER_USER_ACCESS_TOKEN;

  const credentials = {
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
    userAccessToken
  };

  let authHeader = null;
  const tweetUrl = 'https://api.twitter.com/2/tweets';

  if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0'
    };
    authHeader = generateOAuth1Header('POST', tweetUrl, oauthParams, consumerSecret, accessTokenSecret);
  } else if (userAccessToken) {
    authHeader = `Bearer ${userAccessToken}`;
  } else {
    const missing = [];
    if (!consumerKey) missing.push('TWITTER_CONSUMER_KEY / TWITTER_API_KEY');
    if (!consumerSecret) missing.push('TWITTER_CONSUMER_SECRET / TWITTER_API_SECRET');
    if (!accessToken) missing.push('TWITTER_ACCESS_TOKEN');
    if (!accessTokenSecret) missing.push('TWITTER_ACCESS_TOKEN_SECRET');

    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Twitter/X',
      errorMessage: `Missing required X/Twitter API v2 User-Context credentials: ${missing.join(', ')}. App-only bearer tokens cannot create tweets.`
    };
  }

  try {
    // Construct tweet text within Twitter 280 character limit
    const text = `${postContent.title || ''}\n\n${postContent.body || ''}\n\n${(postContent.hashtags || []).join(' ')}`;
    let tweetText = text.trim();
    if (tweetText.length > 280) {
      const summary = `🚨 URGENT: ${postContent.title || ''}\n👉 Willing to donate? Register: ${postContent.registrationUrl || ''}\n${(postContent.hashtags || []).slice(0, 3).join(' ')}`;
      tweetText = summary.substring(0, 280);
    }

    // Try uploading poster image if available and access level permits
    let mediaId = null;
    if (postContent.imageUrl) {
      try {
        mediaId = await uploadTwitterMedia(postContent.imageUrl, credentials);
        console.log(`[TWITTER/X MEDIA UPLOADED] Media ID: ${mediaId}`);
      } catch (mediaErr) {
        console.warn(`[TWITTER/X MEDIA UPLOAD SKIPPED] ${mediaErr.message}. Falling back to text-only tweet.`);
      }
    }

    const tweetPayload = { text: tweetText };
    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    const response = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetPayload)
    });

    const data = await response.json();

    if (!response.ok || data.errors || !data.data?.id) {
      const errMsg = data.errors?.[0]?.message || data.detail || `Twitter API error HTTP ${response.status}`;
      const sanitized = sanitizeTwitterError(errMsg, [consumerSecret, accessTokenSecret, accessToken, userAccessToken]);
      console.error('[TWITTER PUBLISH FAILED]', sanitized);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Twitter/X',
        errorMessage: sanitized
      };
    }

    const tweetId = data.data.id;
    const postUrl = `https://twitter.com/jeevansetu/status/${tweetId}`;

    console.log(`[TWITTER/X PUBLISHED] Successfully posted tweet. Tweet ID: ${tweetId}`);

    return {
      success: true,
      status: 'POST_PUBLISHED',
      platform: 'Twitter/X',
      postId: tweetId,
      postUrl,
      publishedAt: new Date()
    };
  } catch (error) {
    const sanitized = sanitizeTwitterError(error.message, [consumerSecret, accessTokenSecret, accessToken, userAccessToken]);
    console.error('[TWITTER NETWORK ERROR]', sanitized);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Twitter/X',
      errorMessage: `Network error communicating with X/Twitter API v2: ${sanitized}`
    };
  }
};

/**
 * Deletes a published tweet from X / Twitter using Twitter API v2
 * Endpoint: DELETE https://api.twitter.com/2/tweets/{id}
 *
 * @param {string} tweetId
 * @returns {Promise<{success: boolean, tweetId: string, errorMessage?: string}>}
 */
const deleteTwitterPost = async (tweetId) => {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY || process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || process.env.TWITTER_ACCESS_SECRET;
  const userAccessToken = process.env.TWITTER_USER_ACCESS_TOKEN;

  let authHeader = null;
  const url = `https://api.twitter.com/2/tweets/${encodeURIComponent(tweetId)}`;

  if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0'
    };
    authHeader = generateOAuth1Header('DELETE', url, oauthParams, consumerSecret, accessTokenSecret);
  } else if (userAccessToken) {
    authHeader = `Bearer ${userAccessToken}`;
  } else {
    return {
      success: false,
      tweetId,
      errorMessage: 'Missing required X/Twitter User-Context credentials for tweet deletion.'
    };
  }

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || data.errors || data.data?.deleted !== true) {
      const rawError = data.errors?.[0]?.message || data.detail || `Twitter API deletion returned HTTP ${response.status}`;
      const sanitized = sanitizeTwitterError(rawError, [consumerSecret, accessTokenSecret, accessToken, userAccessToken]);
      console.warn(`[TWITTER/X TWEET DELETION FAILED] Tweet ID ${tweetId}: ${sanitized}`);
      return {
        success: false,
        tweetId,
        errorMessage: sanitized
      };
    }

    console.log(`[TWITTER/X TWEET DELETED] Successfully deleted Tweet ID ${tweetId}`);
    return {
      success: true,
      tweetId
    };
  } catch (err) {
    const sanitized = sanitizeTwitterError(err.message, [consumerSecret, accessTokenSecret, accessToken, userAccessToken]);
    console.error(`[TWITTER/X DELETION NETWORK ERROR] Tweet ID ${tweetId}:`, sanitized);
    return {
      success: false,
      tweetId,
      errorMessage: `Network error during tweet deletion: ${sanitized}`
    };
  }
};

module.exports = {
  publishToTwitter,
  deleteTwitterPost,
  uploadTwitterMedia
};
