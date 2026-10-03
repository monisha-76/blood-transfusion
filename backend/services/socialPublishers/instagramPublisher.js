/**
 * Instagram Graph API Publisher (Official Content Publishing API)
 * Requires Instagram Professional (Business/Creator) Account linked to Facebook Page
 *
 * Workflow:
 * 1. Create Media Container: POST https://graph.facebook.com/v19.0/{ig-user-id}/media
 * 2. Publish Media Container: POST https://graph.facebook.com/v19.0/{ig-user-id}/media_publish
 */

const publishToInstagram = async (postContent, officialAccounts = {}) => {
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const imageUrl = process.env.INSTAGRAM_IMAGE_URL;

  // Validate required credentials & publicly accessible HTTPS image URL
  const missingKeys = [];
  if (!igAccountId) missingKeys.push('INSTAGRAM_ACCOUNT_ID');
  if (!accessToken) missingKeys.push('INSTAGRAM_ACCESS_TOKEN (or FACEBOOK_PAGE_ACCESS_TOKEN)');
  if (!imageUrl) {
    missingKeys.push('INSTAGRAM_IMAGE_URL (Must be a publicly accessible HTTPS image URL)');
  } else if (!imageUrl.startsWith('https://')) {
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Instagram',
      errorMessage: 'Instagram Graph API requires a publicly accessible HTTPS image URL. Localhost / HTTP URLs are rejected by Instagram.'
    };
  }

  if (missingKeys.length > 0) {
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Instagram',
      errorMessage: `Missing required environment configuration: ${missingKeys.join(', ')}. Official Instagram Graph API credentials required.`
    };
  }

  try {
    // Caption constructed with title, body, and hashtags
    const caption = `${postContent.title}\n\n${postContent.body}\n\n${(postContent.hashtags || []).join(' ')}`;

    // STEP 1: Create Media Container
    const containerUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(igAccountId)}/media`;
    const containerRes = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken
      })
    });

    const containerData = await containerRes.json();

    if (!containerRes.ok || containerData.error || !containerData.id) {
      const errMsg = containerData.error?.message || `Instagram Container creation failed with HTTP ${containerRes.status}`;
      console.error('[INSTAGRAM CONTAINER FAILED]', errMsg);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Instagram',
        errorMessage: errMsg
      };
    }

    const creationId = containerData.id;

    // STEP 2: Publish Media Container
    const publishUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(igAccountId)}/media_publish`;
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken
      })
    });

    const publishData = await publishRes.json();

    if (!publishRes.ok || publishData.error || !publishData.id) {
      const errMsg = publishData.error?.message || `Instagram Media publish failed with HTTP ${publishRes.status}`;
      console.error('[INSTAGRAM PUBLISH FAILED]', errMsg);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Instagram',
        errorMessage: errMsg
      };
    }

    const igMediaId = publishData.id;
    const postUrl = `https://instagram.com/p/${igMediaId}`;

    console.log(`[INSTAGRAM PUBLISHED] Successfully published to IG Account ${igAccountId}. Media ID: ${igMediaId}`);

    return {
      success: true,
      status: 'POST_PUBLISHED',
      platform: 'Instagram',
      postId: igMediaId,
      postUrl,
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('[INSTAGRAM NETWORK ERROR]', error);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Instagram',
      errorMessage: `Network error communicating with Instagram Graph API: ${error.message}`
    };
  }
};

module.exports = {
  publishToInstagram
};
