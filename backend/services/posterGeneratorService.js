'use strict';

/**
 * posterGeneratorService.js
 *
 * Generates a dynamic blood-request emergency poster using Sharp (SVG overlay)
 * and uploads it to Cloudinary under the jeevansetu/posters folder.
 *
 * Returns the secure HTTPS URL from Cloudinary so Instagram can fetch it.
 *
 * Falls back gracefully — callers MUST wrap in try/catch and fall back to
 * INSTAGRAM_IMAGE_URL or the static Vercel URL on failure.
 */

const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables.
// Do NOT call configure() every request in production — module-level is fine.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─── SVG Helpers ────────────────────────────────────────────────────────────

/**
 * Escape a string for safe inclusion in SVG text content.
 * Prevents XSS and SVG injection via dynamic BloodRequest data.
 */
const escapeSvg = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Wrap long text to a maximum character width, returning an array of lines.
 * Used so hospital names that are too long do not overflow the poster SVG.
 */
const wrapText = (text, maxChars) => {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

// ─── SVG Template ────────────────────────────────────────────────────────────

/**
 * Build an SVG string for a 1080×1080 Instagram-square poster.
 *
 * @param {string} bloodGroup  e.g. "O+"
 * @param {number} units       remainingQuantity (or requiredQuantity fallback)
 * @param {string} hospital    Location / hospital name
 * @returns {string} SVG markup
 */
const buildPosterSvg = (bloodGroup, units, hospital) => {
  const isTest = /TEST|DEMO/i.test(hospital);
  const safeBloodGroup = escapeSvg(bloodGroup);
  const safeUnits     = escapeSvg(String(units));
  const safeHospital  = escapeSvg(hospital);

  // Wrap hospital name at 28 chars per line to avoid overflow
  const hospitalLines = wrapText(hospital, 28).map(escapeSvg);

  // Dynamic Y position for hospital lines
  const hospitalBaseY = 800;
  const hospitalLineHeight = 38;

  const hospitalSvgLines = hospitalLines
    .map((line, i) =>
      `<text x="540" y="${hospitalBaseY + i * hospitalLineHeight}" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="#FFFFFF" text-anchor="middle">${line}</text>`
    )
    .join('\n    ');

  const headlineText = isTest
    ? '⚠️ DEMONSTRATION TEST — NOT A REAL BLOOD EMERGENCY'
    : '🚨 URGENT BLOOD REQUIREMENT';
  const testBannerSvg = isTest
    ? `  <!-- TEST BANNER -->
  <rect x="60" y="68" width="960" height="42" rx="8" ry="8" fill="#FFD700" opacity="0.95"/>
  <text x="540" y="97" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#7A0000" text-anchor="middle" letter-spacing="2">DEMONSTRATION TEST — NOT A REAL BLOOD EMERGENCY</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <!-- Background gradient: deep red → darker red -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#C0111A"/>
      <stop offset="100%" stop-color="#7A0000"/>
    </linearGradient>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.04"/>
    </linearGradient>
  </defs>

  <!-- Full background -->
  <rect width="1080" height="1080" fill="url(#bg)"/>

  <!-- Decorative top bar -->
  <rect x="0" y="0" width="1080" height="8" fill="#FFD700"/>

  <!-- Decorative bottom bar -->
  <rect x="0" y="1072" width="1080" height="8" fill="#FFD700"/>

  <!-- Central card -->
  <rect x="60" y="60" width="960" height="960" rx="24" ry="24" fill="url(#cardBg)" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="1.5"/>
${testBannerSvg}

  <!-- Blood drop icon (simple SVG shape) -->
  <path d="M540 150 C540 150, 480 230, 480 285 C480 318, 507 345, 540 345 C573 345, 600 318, 600 285 C600 230, 540 150, 540 150 Z"
        fill="#FFFFFF" opacity="0.95"/>

  <!-- Branding: JeevanSetu -->
  <text x="540" y="420" font-family="Arial, sans-serif" font-size="42" font-weight="800"
        fill="#FFFFFF" text-anchor="middle" letter-spacing="3">JeevanSetu</text>

  <!-- Tagline -->
  <text x="540" y="468" font-family="Arial, sans-serif" font-size="22" font-weight="400"
        fill="#FFFFFF" text-anchor="middle" opacity="0.85">Blood Transfusion Network</text>

  <!-- Divider -->
  <line x1="140" y1="495" x2="940" y2="495" stroke="#FFD700" stroke-width="2" opacity="0.7"/>

  <!-- URGENT HEADLINE -->
  <text x="540" y="550" font-family="Arial, sans-serif" font-size="${isTest ? '28' : '36'}" font-weight="900"
        fill="#FFD700" text-anchor="middle" letter-spacing="2">${headlineText}</text>

  <!-- Blood Group (large) -->
  <text x="540" y="645" font-family="Arial, sans-serif" font-size="120" font-weight="900"
        fill="#FFFFFF" text-anchor="middle" letter-spacing="4">${safeBloodGroup}</text>

  <!-- Units needed label -->
  <text x="540" y="695" font-family="Arial, sans-serif" font-size="30" font-weight="600"
        fill="#FFD700" text-anchor="middle">Units Needed: ${safeUnits}</text>

  <!-- Divider 2 -->
  <line x1="140" y1="725" x2="940" y2="725" stroke="#FFFFFF" stroke-width="1" opacity="0.3"/>

  <!-- Location label -->
  <text x="540" y="760" font-family="Arial, sans-serif" font-size="26" font-weight="400"
        fill="#FFFFFF" text-anchor="middle" opacity="0.75">📍 Location</text>

  <!-- Hospital name (wrapped) -->
  ${hospitalSvgLines}

  <!-- Divider 3 -->
  <line x1="140" y1="${hospitalBaseY + hospitalLines.length * hospitalLineHeight + 15}" x2="940" y2="${hospitalBaseY + hospitalLines.length * hospitalLineHeight + 15}" stroke="#FFD700" stroke-width="1.5" opacity="0.5"/>

  <!-- Call to action -->
  <text x="540" y="${hospitalBaseY + hospitalLines.length * hospitalLineHeight + 65}" font-family="Arial, sans-serif" font-size="28" font-weight="700"
        fill="#FFD700" text-anchor="middle">💉 Donate Blood. Save a Life.</text>

  <!-- Sub CTA -->
  <text x="540" y="${hospitalBaseY + hospitalLines.length * hospitalLineHeight + 105}" font-family="Arial, sans-serif" font-size="22" font-weight="400"
        fill="#FFFFFF" text-anchor="middle" opacity="0.85">Register at JeevanSetu Blood Network</text>

  <!-- Bottom branding bar -->
  <rect x="60" y="990" width="960" height="30" rx="6" ry="6" fill="#FFFFFF" opacity="0.08"/>
  <text x="540" y="1011" font-family="Arial, sans-serif" font-size="18" font-weight="400"
        fill="#FFFFFF" text-anchor="middle" opacity="0.7">jeevansetu.org | emergency@jeevansetu.org</text>
</svg>`;
};

// ─── Core Service Function ───────────────────────────────────────────────────

/**
 * Generate a dynamic blood-request emergency poster PNG and upload it to Cloudinary.
 *
 * @param {object} bloodRequest  Mongoose BloodRequest document (or plain object)
 *   Required fields:
 *     bloodRequest.requiredBloodGroup  {string}  e.g. "O+"
 *     bloodRequest.remainingQuantity   {number}
 *     bloodRequest.requiredQuantity    {number}  fallback if remainingQuantity is 0
 *     bloodRequest.hospital            {string}  location label
 *
 * @returns {Promise<string>} Cloudinary secure_url (HTTPS)
 * @throws  {Error} on generation or upload failure — caller must catch and fall back
 */
const generateAndUploadPoster = async (bloodRequest) => {
  // Validate Cloudinary configuration
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      '[POSTER] Cloudinary credentials not configured. ' +
      'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.'
    );
  }

  const bloodGroup = bloodRequest.requiredBloodGroup || 'Unknown';
  // Use remainingQuantity if > 0, otherwise fall back to requiredQuantity
  const units = bloodRequest.remainingQuantity > 0
    ? bloodRequest.remainingQuantity
    : (bloodRequest.requiredQuantity || 1);
  const hospital = bloodRequest.hospital || 'Location Not Specified';

  // 1. Build the SVG overlay
  const svgString = buildPosterSvg(bloodGroup, units, hospital);
  const svgBuffer = Buffer.from(svgString);

  // 2. Generate 1080×1080 PNG using Sharp with the SVG composited onto a transparent base.
  //    Sharp composites SVG directly when given a Buffer with the correct MIME.
  const pngBuffer = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 192, g: 17, b: 26, alpha: 1 } // Fallback solid red (SVG gradient covers this)
    }
  })
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png({ compressionLevel: 6 })
    .toBuffer();

  // 3. Upload to Cloudinary via upload_stream (Buffer → stream)
  const cloudinaryUrl = await new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: 'jeevansetu/posters',
      resource_type: 'image',
      format: 'png',
      // Use a deterministic public_id based on blood group so Cloudinary
      // can overwrite/update the same resource on re-runs for the same blood group.
      // Include a short timestamp suffix to keep each campaign's poster unique.
      public_id: `emergency_${bloodGroup.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`
    };

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(new Error(`[POSTER] Cloudinary upload failed: ${error.message || JSON.stringify(error)}`));
      } else {
        resolve(result.secure_url);
      }
    });

    // Write PNG buffer to the Cloudinary upload stream
    uploadStream.end(pngBuffer);
  });

  console.log(`[POSTER GENERATED] Cloudinary URL: ${cloudinaryUrl}`);
  return cloudinaryUrl;
};

/**
 * Deletes a generated emergency poster from Cloudinary.
 * Safely ignores non-Cloudinary fallback URLs (e.g. Vercel static assets).
 * Handles errors gracefully and never throws.
 *
 * @param {string} imageUrlOrPublicId
 * @returns {Promise<{ success: boolean, result?: string, errorMessage?: string }>}
 */
const deleteCloudinaryPoster = async (imageUrlOrPublicId) => {
  if (!imageUrlOrPublicId) {
    return { success: false, errorMessage: 'No image URL or public_id provided' };
  }

  // If this is a static fallback URL, do not attempt to delete it
  if (!imageUrlOrPublicId.includes('cloudinary.com') && !imageUrlOrPublicId.startsWith('jeevansetu/posters')) {
    console.log(`[CLOUDINARY] Skipping deletion: asset is not a dynamic Cloudinary poster (${imageUrlOrPublicId})`);
    return { success: true, skipped: true };
  }

  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret) {
    console.warn('[CLOUDINARY] Credentials not configured. Skipping Cloudinary poster deletion.');
    return { success: false, errorMessage: 'Cloudinary credentials not configured' };
  }

  try {
    let publicId = imageUrlOrPublicId;
    if (imageUrlOrPublicId.includes('cloudinary.com')) {
      const match = imageUrlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
      if (match && match[1]) {
        publicId = match[1];
      }
    }

    const res = await cloudinary.uploader.destroy(publicId);
    console.log(`[CLOUDINARY POSTER DELETED] Public ID: ${publicId}, Result: ${res.result}`);
    return {
      success: res.result === 'ok' || res.result === 'not found',
      result: res.result,
      publicId
    };
  } catch (err) {
    console.error(`[CLOUDINARY POSTER DELETION FAILED] Error:`, err.message);
    return {
      success: false,
      errorMessage: err.message
    };
  }
};

module.exports = {
  generateAndUploadPoster,
  deleteCloudinaryPoster,
  // Exported for unit testing only
  _escapeSvg: escapeSvg,
  _wrapText: wrapText,
  _buildPosterSvg: buildPosterSvg
};
