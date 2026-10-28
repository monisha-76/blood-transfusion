const { publishToFacebook, deleteFacebookPost } = require('./facebookPublisher');
const { publishToInstagram, deleteInstagramPost } = require('./instagramPublisher');
const { publishToTwitter, deleteTwitterPost } = require('./twitterPublisher');
const { publishToWhatsApp } = require('./whatsappPublisher');

const PLATFORM_PUBLISHERS = {
  'Facebook': publishToFacebook,
  'Instagram': publishToInstagram,
  'Twitter/X': publishToTwitter,
  'WhatsApp': publishToWhatsApp
};

const PLATFORM_DELETERS = {
  'Facebook': deleteFacebookPost,
  'Instagram': deleteInstagramPost,
  'Twitter/X': deleteTwitterPost
};

module.exports = {
  PLATFORM_PUBLISHERS,
  PLATFORM_DELETERS,
  publishToFacebook,
  deleteFacebookPost,
  publishToInstagram,
  deleteInstagramPost,
  publishToTwitter,
  deleteTwitterPost,
  publishToWhatsApp
};
