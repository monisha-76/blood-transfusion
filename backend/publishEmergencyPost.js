
require('dotenv').config();
const axios = require('axios');

async function publishBloodEmergencyPost() {
  const pageId = process.env.FB_PAGE_ID;
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageAccessToken) {
    console.error('Missing Facebook credentials in .env');
    return;
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v26.0/${pageId}/feed`,
      {
        message: 'TEST: JeevanSetu Blood Emergency Facebook integration test.',
        access_token: pageAccessToken
      }
    );

    console.log('Post published successfully!');
    console.log('Post ID:', response.data.id);
  } catch (error) {
    console.error(
      'Publishing failed:',
      error.response?.data || error.message
    );
  }
}

publishBloodEmergencyPost();
