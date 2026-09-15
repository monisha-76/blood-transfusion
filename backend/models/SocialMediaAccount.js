const mongoose = require('mongoose');

const socialMediaAccountSchema = new mongoose.Schema({
  organizationName: {
    type: String,
    default: 'JeevanSetu Blood Network'
  },
  instagram: {
    handle: { type: String, default: '@jeevansetu_org' },
    url: { type: String, default: 'https://instagram.com/jeevansetu_org' }
  },
  facebook: {
    pageName: { type: String, default: 'JeevanSetu Blood Procurement' },
    url: { type: String, default: 'https://facebook.com/jeevansetu.blood' }
  },
  twitter: {
    handle: { type: String, default: '@jeevansetu' },
    url: { type: String, default: 'https://twitter.com/jeevansetu' }
  },
  whatsapp: {
    businessNumber: { type: String, default: '+91-9876543210' },
    url: { type: String, default: 'https://wa.me/919876543210' }
  },
  isDefault: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SocialMediaAccount', socialMediaAccountSchema);
