/**
 * Instagram Graph API Publisher (Official Content Publishing API)
 * Supports Instagram Professional/Business Accounts connected via Instagram Graph API
 *
 * Real Endpoint Flow:
 * 1. Create Media Container: POST https://graph.instagram.com/v24.0/{ig-user-id}/media
 * 2. Publish Media Container: POST https://graph.instagram.com/v24.0/{ig-user-id}/media_publish
 */

const sanitizeError = (errString, token) => {
  if (!errString) return 'Unknown Instagram API error';
  let sanitized = String(errString);
  if (token && typeof token === 'string' && token.length > 5) {
    sanitized = sanitized.split(token).join('[REDACTED_TOKEN]');
  }
  sanitized = sanitized.replace(/access_token=[a-zA-Z0-9_\-]+/gi, 'access_token=[REDACTED]');
  return sanitized;
};

const publishToInstagram = async (postContent = {}, officialAccounts = {}) => {
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  
  // Public HTTPS image URL priority:
  // 1. Campaign-specific public image URL (postContent.imageUrl)
  // 2. INSTAGRAM_IMAGE_URL environment variable
  // 3. Configured emergency banner URL deployed on public CDN/Vercel
  const defaultBannerUrl = 'https://blood-transfusion-or6q.vercel.app/bloodposter.png';
  const imageUrl = (postContent && postContent.imageUrl)
    ? postContent.imageUrl
    : (process.env.INSTAGRAM_IMAGE_URL || defaultBannerUrl);

  // Validate required credentials & publicly accessible HTTPS image URL
  const missingKeys = [];
  if (!igAccountId) missingKeys.push('INSTAGRAM_ACCOUNT_ID');
  if (!accessToken) missingKeys.push('INSTAGRAM_ACCESS_TOKEN (or FACEBOOK_PAGE_ACCESS_TOKEN)');
  if (!imageUrl) missingKeys.push('INSTAGRAM_IMAGE_URL (Must be a publicly accessible HTTPS image URL)');

  if (missingKeys.length > 0) {
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Instagram',
      errorMessage: `Missing required environment configuration: ${missingKeys.join(', ')}. Official Instagram Graph API credentials required.`
    };
  }

  // Strictly enforce public HTTPS URL (Instagram rejects localhost / HTTP)
  if (!imageUrl.startsWith('https://') || imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Instagram',
      errorMessage: 'Instagram Graph API requires a publicly accessible HTTPS image URL. Localhost / HTTP URLs are rejected by Instagram.'
    };
  }

  const apiBase = process.env.INSTAGRAM_API_BASE || 'https://graph.instagram.com';
  const graphVersion = process.env.INSTAGRAM_GRAPH_VERSION || 'v24.0';

  try {
    // Construct privacy-safe caption from title, body, and hashtags
    let caption = '';
    if (postContent.title && postContent.body) {
      caption = `${postContent.title}\n\n${postContent.body}`;
    } else {
      caption = postContent.body || postContent.title || '🚨 URGENT BLOOD REQUIREMENT 🚨';
    }

    if (postContent.hashtags && Array.isArray(postContent.hashtags) && postContent.hashtags.length > 0) {
      caption += `\n\n${postContent.hashtags.join(' ')}`;
    }

    // STEP 1: Create Media Container
    const containerUrl = `${apiBase}/${graphVersion}/${encodeURIComponent(igAccountId)}/media`;
    const containerRes = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken
      })
    });

    const containerData = await containerRes.json().catch(() => ({}));

    if (!containerRes.ok || containerData.error || !containerData.id) {
      const rawError = containerData.error?.message || `Instagram Container creation failed with HTTP ${containerRes.status}`;
      const safeError = sanitizeError(rawError, accessToken);
      console.error('[INSTAGRAM CONTAINER FAILED]', safeError);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Instagram',
        errorMessage: safeError
      };
    }

    const creationId = containerData.id;
    console.log(`[INSTAGRAM CONTAINER CREATED] Container ID: ${creationId}`);

    // Wait for Instagram CDN processing to reach FINISHED status before publishing
    const statusUrl = `${apiBase}/${graphVersion}/${encodeURIComponent(creationId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const checkRes = await fetch(statusUrl);
        if (checkRes && checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.status_code === 'FINISHED') {
            break;
          } else if (checkData.status_code === 'ERROR' || checkData.status_code === 'EXPIRED') {
            const safeError = sanitizeError(`Instagram Media container status error: ${checkData.status_code}`, accessToken);
            return {
              success: false,
              status: 'POST_FAILED',
              platform: 'Instagram',
              containerId: creationId,
              errorMessage: safeError
            };
          }
        } else {
          // If status endpoint is not found or unsupported, break to proceed directly to publish
          break;
        }
      } catch (e) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // STEP 2: Publish Media Container
    const publishUrl = `${apiBase}/${graphVersion}/${encodeURIComponent(igAccountId)}/media_publish`;
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken
      })
    });

    const publishData = await publishRes.json().catch(() => ({}));

    if (!publishRes.ok || publishData.error || !publishData.id) {
      const rawError = publishData.error?.message || `Instagram Media publish failed with HTTP ${publishRes.status}`;
      const safeError = sanitizeError(rawError, accessToken);
      console.error('[INSTAGRAM PUBLISH FAILED]', safeError);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'Instagram',
        containerId: creationId,
        errorMessage: safeError
      };
    }

    const igMediaId = publishData.id;
    const postUrl = `https://www.instagram.com/p/${igMediaId}`;

    console.log(`[INSTAGRAM PUBLISHED] Successfully published to IG Account ${igAccountId}. Media ID: ${igMediaId}`);

    return {
      success: true,
      status: 'POST_PUBLISHED',
      platform: 'Instagram',
      containerId: creationId,
      postId: igMediaId,
      postUrl,
      publishedAt: new Date()
    };
  } catch (error) {
    const safeError = sanitizeError(error.message, accessToken);
    console.error('[INSTAGRAM NETWORK ERROR]', safeError);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'Instagram',
      errorMessage: `Network error communicating with Instagram Graph API: ${safeError}`
    };
  }
};

module.exports = {
  publishToInstagram,
  sanitizeError
};
