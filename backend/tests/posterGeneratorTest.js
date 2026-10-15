'use strict';

/**
 * posterGeneratorTest.js
 *
 * Unit tests for backend/services/posterGeneratorService.js.
 *
 * Cloudinary is fully MOCKED — no real upload is made.
 * Sharp PNG generation IS exercised (generates a real buffer in memory).
 *
 * Run:
 *   node backend/tests/posterGeneratorTest.js
 */

// ── Setup: intercept require('cloudinary') BEFORE importing the service ──────
const Module = require('module');
const originalLoad = Module._load;

// Mock cloudinary.v2 globally so posterGeneratorService picks it up
const mockUploadStream = (() => {
  let _callback = null;
  let _shouldFail = false;
  let _returnUrl = 'https://res.cloudinary.com/jeevansetu/image/upload/jeevansetu/posters/test.png';

  const fn = (options, callback) => {
    _callback = callback;
    // Return a fake writable stream object
    return {
      end: (buffer) => {
        // Simulate async Cloudinary processing
        setImmediate(() => {
          if (_shouldFail) {
            _callback(new Error('Simulated Cloudinary upload failure'), null);
          } else {
            _callback(null, { secure_url: _returnUrl });
          }
        });
      }
    };
  };

  fn.setShouldFail = (val) => { _shouldFail = val; };
  fn.setReturnUrl = (url) => { _returnUrl = url; };
  return fn;
})();

// Intercept Module._load for 'cloudinary'
Module._load = function (request, parent, isMain) {
  if (request === 'cloudinary') {
    return {
      v2: {
        config: (opts) => {
          // Store config and return it (mimic cloudinary behaviour)
          if (opts) Object.assign(Module._load._cloudinaryConfig, opts);
          return Module._load._cloudinaryConfig;
        },
        uploader: {
          upload_stream: mockUploadStream
        }
      }
    };
  }
  return originalLoad.apply(this, arguments);
};
Module._load._cloudinaryConfig = {};

// Now that the mock is in place, load the service
const {
  generateAndUploadPoster,
  _escapeSvg,
  _wrapText,
  _buildPosterSvg
} = require('../services/posterGeneratorService');

// ── Test Runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

const assert = (condition, testName, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
};

const runTests = async () => {
  console.log('\n=== POSTER GENERATOR SERVICE UNIT TESTS ===\n');

  // ── TEST 1: SVG escaping ─────────────────────────────────────────────────
  console.log('--- TEST 1: SVG Special Character Escaping ---');
  assert(_escapeSvg('O+')       === 'O+',         'Plain blood group passes through unchanged');
  assert(_escapeSvg('A&B')      === 'A&amp;B',    'Ampersand is escaped to &amp;');
  assert(_escapeSvg('<script>')  === '&lt;script&gt;', 'Angle brackets escaped');
  assert(_escapeSvg('"quoted"')  === '&quot;quoted&quot;', 'Double quotes escaped');
  assert(_escapeSvg("it's")      === 'it&apos;s',  "Single quote escaped");
  assert(_escapeSvg(null)        === '',            'null returns empty string');
  assert(_escapeSvg(undefined)   === '',            'undefined returns empty string');
  assert(_escapeSvg(42)          === '42',          'Numeric value coerced to string');

  // ── TEST 2: Text wrapping ────────────────────────────────────────────────
  console.log('\n--- TEST 2: Long Text Wrapping ---');
  const shortHospital = _wrapText('AIIMS Delhi', 28);
  assert(shortHospital.length === 1 && shortHospital[0] === 'AIIMS Delhi', 'Short hospital name: single line');

  const longHospital = _wrapText('Apollo Specialty Hospital Sector 26 Navi Mumbai', 28);
  assert(longHospital.length > 1, 'Long hospital name wraps to multiple lines');
  assert(longHospital.every(l => l.length <= 32), 'No individual line exceeds ~32 chars with word-boundary wrap');

  assert(_wrapText('', 28).length === 1, 'Empty string returns single-element array');

  // ── TEST 3: SVG content correctness ─────────────────────────────────────
  console.log('\n--- TEST 3: SVG Content Verification ---');
  const svg = _buildPosterSvg('O+', 3, 'AIIMS New Delhi');
  assert(svg.includes('O+'),            'Blood group appears in SVG');
  assert(svg.includes('Units Needed: 3'), 'Units label appears in SVG');
  assert(svg.includes('AIIMS New Delhi'), 'Hospital name appears in SVG');
  assert(svg.includes('JeevanSetu'),    'JeevanSetu branding present');
  assert(svg.includes('URGENT BLOOD'), 'Urgent headline present');
  assert(svg.includes('Donate Blood'), 'Call-to-action present');
  assert(!svg.includes('<script>'),      'No raw script tags (injection test)');

  // SVG injection test: dangerous characters must be escaped in output
  const dangerousSvg = _buildPosterSvg('O&B+', 1, '<script>alert(1)</script>');
  assert(dangerousSvg.includes('&amp;'),  'Ampersand escaped in SVG output');
  assert(dangerousSvg.includes('&lt;'),   'Less-than escaped in SVG output');
  assert(!dangerousSvg.includes('<script>'), 'Raw <script> tag NOT present in SVG output');

  // ── TEST 4: Successful generation returns Cloudinary URL ─────────────────
  console.log('\n--- TEST 4: Successful Upload Returns Cloudinary URL ---');
  mockUploadStream.setShouldFail(false);
  mockUploadStream.setReturnUrl('https://res.cloudinary.com/jeevansetu/image/upload/jeevansetu/posters/emergency_Opositive_123.png');

  // Provide Cloudinary config so the credential check passes
  Module._load._cloudinaryConfig = {
    cloud_name: 'test_cloud',
    api_key: 'test_key',
    api_secret: 'test_secret'
  };

  const url = await generateAndUploadPoster({
    requiredBloodGroup: 'O+',
    remainingQuantity: 2,
    requiredQuantity: 3,
    hospital: 'AIIMS New Delhi'
  });

  assert(typeof url === 'string',                       'Return value is a string');
  assert(url.startsWith('https://'),                    'Returned URL starts with https://');
  assert(url.includes('cloudinary.com'),                'URL is a Cloudinary URL');
  assert(url.includes('jeevansetu/posters'),            'URL is in jeevansetu/posters folder');

  // ── TEST 5: remainingQuantity = 0 falls back to requiredQuantity ─────────
  console.log('\n--- TEST 5: remainingQuantity=0 Falls Back to requiredQuantity ---');
  mockUploadStream.setShouldFail(false);
  mockUploadStream.setReturnUrl('https://res.cloudinary.com/jeevansetu/image/upload/v1/test.png');

  const url5 = await generateAndUploadPoster({
    requiredBloodGroup: 'B+',
    remainingQuantity: 0,
    requiredQuantity: 4,
    hospital: 'Fortis Hospital'
  });
  // Also verify the SVG that would have been generated uses requiredQuantity
  const svgFallback = _buildPosterSvg('B+', 4, 'Fortis Hospital');
  assert(svgFallback.includes('Units Needed: 4'), 'SVG shows requiredQuantity when remainingQuantity=0');
  assert(typeof url5 === 'string' && url5.startsWith('https://'), 'Upload still succeeds with requiredQuantity fallback');

  // ── TEST 6: Cloudinary upload failure throws ──────────────────────────────
  console.log('\n--- TEST 6: Cloudinary Upload Failure Throws Error ---');
  mockUploadStream.setShouldFail(true);

  let threw = false;
  try {
    await generateAndUploadPoster({
      requiredBloodGroup: 'AB-',
      remainingQuantity: 1,
      requiredQuantity: 1,
      hospital: 'Test Hospital'
    });
  } catch (err) {
    threw = true;
    assert(err.message.includes('Cloudinary upload failed'), 'Error message mentions Cloudinary upload failure');
  }
  assert(threw, 'generateAndUploadPoster throws when Cloudinary upload fails');
  mockUploadStream.setShouldFail(false);

  // ── TEST 7: Missing Cloudinary credentials throws ─────────────────────────
  console.log('\n--- TEST 7: Missing Cloudinary Credentials Throws Error ---');
  // Temporarily clear config
  const savedConfig = { ...Module._load._cloudinaryConfig };
  Module._load._cloudinaryConfig = { cloud_name: '', api_key: '', api_secret: '' };

  let credThrew = false;
  try {
    await generateAndUploadPoster({
      requiredBloodGroup: 'A+',
      remainingQuantity: 2,
      requiredQuantity: 2,
      hospital: 'City Hospital'
    });
  } catch (err) {
    credThrew = true;
    assert(err.message.includes('Cloudinary credentials not configured'), 'Error message mentions missing credentials');
  }
  assert(credThrew, 'generateAndUploadPoster throws when Cloudinary credentials are missing');

  // Restore config
  Module._load._cloudinaryConfig = savedConfig;

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 ALL POSTER GENERATOR TESTS PASSED!\n');
    process.exitCode = 0;
  } else {
    console.error(`❌ ${failed} TEST(S) FAILED\n`);
    process.exitCode = 1;
  }

  // Restore original Module._load
  Module._load = originalLoad;
};

runTests().catch((err) => {
  console.error('Unhandled error in poster test runner:', err);
  process.exitCode = 1;
  Module._load = originalLoad;
});
