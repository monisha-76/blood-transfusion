const { publishToFacebook } = require('./facebookPublisher');
const { publishToInstagram } = require('./instagramPublisher');
const { publishToTwitter } = require('./twitterPublisher');
const { publishToWhatsApp } = require('./whatsappPublisher');

const PLATFORM_PUBLISHERS = {
  'Facebook': publishToFacebook,
  'Instagram': publishToInstagram,
  'Twitter/X': publishToTwitter,
  'WhatsApp': publishToWhatsApp
};

module.exports = {
  PLATFORM_PUBLISHERS,
  publishToFacebook,
  publishToInstagram,
  publishToTwitter,
  publishToWhatsApp
};
