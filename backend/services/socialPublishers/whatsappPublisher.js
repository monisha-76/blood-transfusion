/**
 * WhatsApp Business / Cloud API Publisher
 * Endpoint: POST https://graph.facebook.com/v19.0/{phone-number-id}/messages
 * Authentication: System User Access Token (WHATSAPP_ACCESS_TOKEN)
 *
 * WhatsApp is handled via official Cloud API business messaging
 * to broadcast emergency transfusion alerts to coordinators and registered emergency donor contacts.
 */

const publishToWhatsApp = async (postContent, officialAccounts = {}) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipientNumber = process.env.WHATSAPP_RECIPIENT_NUMBER;

  const missingKeys = [];
  if (!phoneNumberId) missingKeys.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!accessToken) missingKeys.push('WHATSAPP_ACCESS_TOKEN');
  if (!recipientNumber) missingKeys.push('WHATSAPP_RECIPIENT_NUMBER');

  if (missingKeys.length > 0) {
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'WhatsApp',
      errorMessage: `Missing required environment configuration: ${missingKeys.join(', ')}. Official WhatsApp Cloud API credentials required.`
    };
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}/messages`;
    
    // Construct message body
    const bodyText = `${postContent.title}\n\n${postContent.body}\n\n👉 Volunteer to donate: ${postContent.registrationUrl}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientNumber,
        type: 'text',
        text: {
          preview_url: true,
          body: bodyText
        }
      })
    });

    const data = await response.json();

    if (!response.ok || data.error || !data.messages?.[0]?.id) {
      const errMsg = data.error?.message || `WhatsApp Cloud API error HTTP ${response.status}`;
      console.error('[WHATSAPP PUBLISH FAILED]', errMsg);
      return {
        success: false,
        status: 'POST_FAILED',
        platform: 'WhatsApp',
        errorMessage: errMsg
      };
    }

    const messageId = data.messages[0].id;
    const postUrl = officialAccounts.whatsapp?.url || `https://wa.me/${recipientNumber.replace(/\D/g, '')}`;

    console.log(`[WHATSAPP PUBLISHED] Successfully dispatched message. Message ID: ${messageId}`);

    return {
      success: true,
      status: 'POST_PUBLISHED',
      platform: 'WhatsApp',
      postId: messageId,
      postUrl,
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('[WHATSAPP NETWORK ERROR]', error);
    return {
      success: false,
      status: 'POST_FAILED',
      platform: 'WhatsApp',
      errorMessage: `Network error communicating with WhatsApp Cloud API: ${error.message}`
    };
  }
};

module.exports = {
  publishToWhatsApp
};
