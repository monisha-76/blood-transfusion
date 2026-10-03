const crypto = require('crypto');

/**
 * X / Twitter API v2 Publisher
 * Endpoint: POST https://api.twitter.com/2/tweets
 * Requires User-Context Authentication via OAuth 1.0a HMAC-SHA1 or OAuth 2.0 User Access Token.
 * Note: App-only Bearer tokens cannot be used to create tweets.
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
 * Generate OAuth 1.0a Authorization header for POST /2/tweets
 */
const generateOAuth1Header = (method, url, oauthParams, consumerSecret, tokenSecret) => {
  // Sort parameters alphabetically by encoded key
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

const publishToTwitter = async (postContent, officialAccounts = {}) => {
  // Check for User-Context Credentials
  // Option 1: OAuth 1.0a User Context (API Key, API Secret, Access Token, Access Token Secret)
  const consumerKey = process.env.TWITTER_CONSUMER_KEY || process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || process.env.TWITTER_ACCESS_SECRET;

  // Option 2: OAuth 2.0 User-Context Access Token (with tweet.write scope)
  const userAccessToken = process.env.TWITTER_USER_ACCESS_TOKEN;

  let authHeader = null;

  if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
    const method = 'POST';
    const url = 'https://api.twitter.com/2/tweets';
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0'
    };

    authHeader = generateOAuth1Header(method, url, oauthParams, consumerSecret, accessTokenSecret);
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
    // Construct tweet text within Twitter character limits
    const text = `${postContent.title}\n\n${postContent.body}\n\n${(postContent.hashtags || []).join(' ')}`;
    // If text exceeds 280 chars, truncate body gracefully
    let tweetText = text;
    if (tweetText.length > 280) {
      const summary = `🚨 URGENT: ${postContent.title}\n👉 Willing to donate? Register: ${postContent.registrationUrl}\n${(postContent.hashtags || []).slice(0, 3).join(' ')}`;
      tweetText = summary.substring(0, 280);
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: tweetText })
    });

    const data = await response.json();

    if (!response.ok || data.errors || !data.data?.id) {
      const errMsg = data.errors?.[0]?.message || data.detail || `Twitter API error HTTP ${response.status}`;
      console.error('[TWITTER PUBLISH FAILED]', errMsg);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Twitter/X',
        errorMessage: errMsg
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
    console.error('[TWITTER NETWORK ERROR]', error);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Twitter/X',
      errorMessage: `Network error communicating with X/Twitter API v2: ${error.message}`
    };
  }
};

module.exports = {
  publishToTwitter
};
