const BloodRequest = require('../models/BloodRequest');
const BloodInventory = require('../models/BloodInventory');
const Donor = require('../models/Donor');
const DonorMatch = require('../models/DonorMatch');
const Patient = require('../models/Patient');
const { findMatchingDonors, BLOOD_COMPATIBILITY_MATRIX } = require('./bloodMatchingService');
const { createCampaign, fulfillCampaign } = require('./socialMediaService');
const { createNotification, notifyRole } = require('./notificationService');
const { sendEmail } = require('../utils/email');
const { generateToken } = require('../utils/jwt');

/**
 * Initiates blood search pipeline for a blood request
 * @param {string|ObjectId} bloodRequestId 
 */
const initiateBloodSearch = async (bloodRequestId) => {
  try {
    const request = await BloodRequest.findById(bloodRequestId)
      .populate('patient')
      .populate('doctor');

    if (!request) throw new Error('Blood request not found');

    // Ensure status is ACTIVE and remainingQuantity is computed
    if (request.currentStatus !== 'BLOOD_SECURED' && request.currentStatus !== 'COMPLETED' && request.currentStatus !== 'CANCELLED') {
      request.currentStatus = 'ACTIVE';
    }
    request.remainingQuantity = Math.max(0, request.requiredQuantity - (request.securedQuantity || 0));
    await request.save();

    console.log(`[BLOOD SEARCH INITIATED] Request #${request._id} for Blood Group ${request.requiredBloodGroup} (Needed: ${request.requiredQuantity}, Remaining: ${request.remainingQuantity})`);

    // --- LEVEL 1: Check Hospital Blood Bank Inventory ---
    const level1Result = await checkBloodBankInventory(request);
    if (level1Result.fulfilled) {
      return level1Result;
    }

    // --- LEVEL 2: Search Registered Donor Database ---
    const level2Result = await searchRegisteredDonors(request);
    if (level2Result.foundDonors) {
      return level2Result;
    }

    return { fulfilled: false, remainingQuantity: request.remainingQuantity, request };
  } catch (error) {
    console.error('Error initiating blood search:', error);
    throw error;
  }
};

/**
 * LEVEL 1: Blood Bank Inventory Check
 */
const checkBloodBankInventory = async (request) => {
  // Find matching non-expired blood inventory with available units
  const inventoryItems = await BloodInventory.find({
    bloodGroup: request.requiredBloodGroup,
    status: 'AVAILABLE',
    expiryDate: { $gte: request.transfusionDate }
  }).sort({ expiryDate: 1 });

  let unitsNeeded = request.remainingQuantity > 0 ? request.remainingQuantity : request.requiredQuantity;
  let unitsAllocated = 0;

  for (const item of inventoryItems) {
    const availableInBatch = Math.max(0, item.quantity - (item.reservedQuantity || 0));
    if (availableInBatch <= 0) continue;

    const toReserve = Math.min(availableInBatch, unitsNeeded);
    item.reservedQuantity = (item.reservedQuantity || 0) + toReserve;
    if (item.reservedQuantity >= item.quantity) {
      item.status = 'RESERVED';
    }
    await item.save();

    unitsAllocated += toReserve;
    unitsNeeded -= toReserve;
    request.reservedInventoryId = item._id;

    if (unitsNeeded <= 0) break;
  }

  if (unitsAllocated > 0) {
    request.securedQuantity = (request.securedQuantity || 0) + unitsAllocated;
    request.remainingQuantity = Math.max(0, request.requiredQuantity - request.securedQuantity);
    request.source = 'BLOOD_BANK';

    if (request.remainingQuantity === 0) {
      request.currentStatus = 'BLOOD_SECURED';
      if (request.socialCampaignId) {
        await fulfillCampaign(request._id);
      }
    } else {
      request.currentStatus = 'ACTIVE';
    }

    await request.save();

    // Notifications
    if (request.patient && request.patient.userId) {
      await createNotification({
        recipientId: request.patient.userId,
        type: 'BLOOD_AVAILABLE',
        title: request.remainingQuantity === 0 ? 'Blood Units Fully Secured in Inventory' : 'Partial Blood Units Secured',
        message: `Blood bank has secured ${unitsAllocated} unit(s) of ${request.requiredBloodGroup} for your transfusion on ${new Date(request.transfusionDate).toLocaleDateString()}. Remaining units needed: ${request.remainingQuantity}.`,
        relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
      });
    }

    if (request.doctor) {
      await createNotification({
        recipientId: request.doctor._id || request.doctor,
        type: 'BLOOD_AVAILABLE',
        title: `Blood Stock Secured (${unitsAllocated} Units)`,
        message: `${unitsAllocated} unit(s) secured from blood bank for patient ${request.patient?.name} (${request.requiredBloodGroup}). Remaining: ${request.remainingQuantity}.`,
        relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
      });
    }

    await notifyRole('HOSPITAL_MANAGEMENT', {
      type: 'BLOOD_AVAILABLE',
      title: 'Blood Inventory Reserved',
      message: `${unitsAllocated} unit(s) of ${request.requiredBloodGroup} reserved for Patient ${request.patient?.name}. Remaining needed: ${request.remainingQuantity}.`,
      relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
    });

    console.log(`[LEVEL 1 SUCCESS] Secured ${unitsAllocated} unit(s) of ${request.requiredBloodGroup}. Remaining: ${request.remainingQuantity}`);
    return {
      fulfilled: request.remainingQuantity === 0,
      securedUnits: unitsAllocated,
      remainingUnits: request.remainingQuantity,
      source: 'BLOOD_BANK',
      request
    };
  }

  return { fulfilled: false, remainingUnits: request.remainingQuantity };
};

/**
 * Sends a single formatted donor emergency email notification with JWT deep link
 */
const sendDonorEmergencyEmail = async (donor, request) => {
  const donorEmail = donor.email || (donor.userId && typeof donor.userId === 'object' ? donor.userId.email : null);
  if (!donorEmail) return false;

  const token = generateToken({
    bloodRequestId: request._id,
    donorId: donor._id,
    email: donorEmail
  });
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const donorLink = `${clientUrl}/donor/respond?token=${token}`;

  const transfusionDateStr = new Date(request.transfusionDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const patientName = request.patient?.name || 'A Thalassemia Patient';
  const patientPhone = request.patient?.phone || 'Contact Hospital';
  const patientAddress = request.patient?.address || 'City Central Hospital';

  const unitsNeeded = request.remainingQuantity > 0 ? request.remainingQuantity : request.requiredQuantity;

  await sendEmail({
    to: donorEmail,
    subject: `🩸 Emergency Blood Donation Request – ${request.requiredBloodGroup}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden;border:1px solid #1e293b;">
        <div style="background:linear-gradient(135deg,#dc2626,#7c3aed);padding:24px 32px;">
          <h1 style="margin:0;font-size:22px;color:#fff;">🩸 JeevanSetu — Urgent Donation Request</h1>
          <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">Voluntary Donor Network Alert</p>
        </div>
        <div style="padding:32px;">
          <p style="font-size:15px;">Dear <strong>${donor.name}</strong>,</p>
          <p style="font-size:14px;color:#94a3b8;">A patient currently requires <strong>${request.requiredBloodGroup}</strong> blood for a scheduled transfusion. You have registered as a willing donor.</p>
          
          <div style="background:#1e293b;border-radius:10px;padding:20px;margin:20px 0;border-left:4px solid #dc2626;">
            <h2 style="margin:0 0 16px;font-size:16px;color:#f87171;">📋 Request Details</h2>
            <table style="width:100%;font-size:13px;border-collapse:collapse;">
              <tr><td style="color:#94a3b8;padding:6px 0;width:40%;">Blood Group Required</td><td style="color:#f87171;font-weight:bold;font-size:16px;">${request.requiredBloodGroup}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0;">Units Required</td><td style="color:#e2e8f0;font-weight:600;">${unitsNeeded} Unit(s)</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0;">Location / Hospital</td><td style="color:#e2e8f0;">${request.hospital}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0;">Transfusion Date</td><td style="color:#fbbf24;font-weight:bold;">${transfusionDateStr}</td></tr>
            </table>
          </div>

          <p style="font-size:14px;color:#94a3b8;">If you are willing to donate for this requirement, please confirm your willingness below:</p>
          
          <div style="margin:20px 0;display:flex;gap:12px;">
            <a href="${donorLink}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;">
              ✅ I'm Willing to Donate
            </a>
          </div>

          <p style="font-size:12px;color:#64748b;margin-top:24px;">If you are unable to donate at this time, please log in and decline so the system can promptly notify another willing donor.</p>
          <p style="font-size:12px;color:#64748b;">— JeevanSetu Blood Procurement System</p>
        </div>
      </div>
    `
  });

  return true;
};

/**
 * LEVEL 2: Registered Donor Search & Notification with strict duplicate prevention via DonorMatch
 */
const searchRegisteredDonors = async (request) => {
  // Find all existing donor match records for this blood request
  const existingMatches = await DonorMatch.find({ bloodRequestId: request._id });
  const alreadyMatchedDonorIds = existingMatches.map(m => m.donorId.toString());

  // Find willing, available matching donors
  const matchingDonors = await Donor.find({
    bloodGroup: { $in: BLOOD_COMPATIBILITY_MATRIX[request.requiredBloodGroup] || [request.requiredBloodGroup] },
    willingToDonate: { $ne: false },
    availabilityStatus: 'AVAILABLE',
    _id: { $nin: alreadyMatchedDonorIds }
  });

  let notifiedCount = 0;

  for (const donor of matchingDonors) {
    try {
      // Upsert DonorMatch record to prevent race-condition duplicates
      const matchRecord = await DonorMatch.findOneAndUpdate(
        { donorId: donor._id, bloodRequestId: request._id },
        {
          $setOnInsert: {
            donorId: donor._id,
            bloodRequestId: request._id,
            matchStatus: 'NOTIFIED',
            notificationStatus: 'PENDING',
            donorResponse: 'PENDING',
            donationStatus: 'PENDING'
          }
        },
        { upsert: true, new: true }
      );

      // Only dispatch email if not previously sent
      if (matchRecord.notificationStatus !== 'EMAIL_SENT') {
        const sent = await sendDonorEmergencyEmail(donor, request);
        if (sent) {
          matchRecord.notificationStatus = 'EMAIL_SENT';
          matchRecord.notifiedAt = new Date();
          await matchRecord.save();
          notifiedCount++;

          // In-app notification
          if (donor.userId) {
            await createNotification({
              recipientId: donor.userId._id || donor.userId,
              type: 'DONOR_REQUEST',
              title: `Urgent ${request.requiredBloodGroup} Blood Needed`,
              message: `A patient requires ${request.requiredBloodGroup} blood at ${request.hospital}. Please check your email or dashboard to respond.`,
              relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
            });
          }

          // Also keep request.donorResponses in sync for backward compatibility
          const hasResp = request.donorResponses?.some(dr => dr.donorId?.toString() === donor._id.toString());
          if (!hasResp) {
            request.donorResponses.push({
              donorId: donor._id,
              status: 'PENDING',
              notifiedAt: new Date()
            });
          }

          console.log(`[DONOR NOTIFIED] Emailed Donor ${donor.name} (${donor.email}) for BloodRequest #${request._id}`);
        }
      }
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key error safely handled
        console.log(`[DUPLICATE MATCH IGNORED] Donor ${donor._id} already matched to Request #${request._id}`);
      } else {
        console.error(`Error notifying donor ${donor._id}:`, err);
      }
    }
  }

  if (notifiedCount > 0) {
    await request.save();
    console.log(`[LEVEL 2 NOTIFIED] ${notifiedCount} new donor(s) notified for BloodRequest #${request._id}`);
    return { foundDonors: true, count: notifiedCount, request };
  }

  return { foundDonors: false, count: 0, request };
};

/**
 * Event-Driven: Immediately check and match a newly registered/updated donor against all ACTIVE blood requests
 * @param {Object} donor - Donor document
 */
const checkAndMatchNewDonor = async (donor) => {
  try {
    if (!donor || donor.willingToDonate === false || donor.availabilityStatus === 'UNAVAILABLE') {
      return { matchedRequests: 0 };
    }

    // Find active blood requests where remainingQuantity > 0 and donor's blood is compatible
    const activeRequests = await BloodRequest.find({
      currentStatus: { $in: ['ACTIVE', 'PENDING', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'UNAVAILABLE_ESCALATED'] },
      remainingQuantity: { $gt: 0 }
    }).populate('patient').populate('doctor');

    let matchedCount = 0;

    for (const request of activeRequests) {
      const compatibleGroups = BLOOD_COMPATIBILITY_MATRIX[request.requiredBloodGroup] || [request.requiredBloodGroup];
      if (!compatibleGroups.includes(donor.bloodGroup)) {
        continue;
      }

      // Check if DonorMatch already exists
      const existingMatch = await DonorMatch.findOne({
        donorId: donor._id,
        bloodRequestId: request._id
      });

      if (!existingMatch || existingMatch.notificationStatus !== 'EMAIL_SENT') {
        const matchRecord = await DonorMatch.findOneAndUpdate(
          { donorId: donor._id, bloodRequestId: request._id },
          {
            $setOnInsert: {
              donorId: donor._id,
              bloodRequestId: request._id,
              matchStatus: 'NOTIFIED',
              notificationStatus: 'PENDING',
              donorResponse: 'PENDING',
              donationStatus: 'PENDING'
            }
          },
          { upsert: true, new: true }
        );

        if (matchRecord.notificationStatus !== 'EMAIL_SENT') {
          const sent = await sendDonorEmergencyEmail(donor, request);
          if (sent) {
            matchRecord.notificationStatus = 'EMAIL_SENT';
            matchRecord.notifiedAt = new Date();
            await matchRecord.save();
            matchedCount++;

            // In-app notification
            if (donor.userId) {
              await createNotification({
                recipientId: donor.userId._id || donor.userId,
                type: 'DONOR_REQUEST',
                title: `Urgent ${request.requiredBloodGroup} Blood Needed`,
                message: `A patient requires ${request.requiredBloodGroup} blood at ${request.hospital}. Please check your email or dashboard to respond.`,
                relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
              });
            }

            const hasResp = request.donorResponses?.some(dr => dr.donorId?.toString() === donor._id.toString());
            if (!hasResp) {
              request.donorResponses.push({
                donorId: donor._id,
                status: 'PENDING',
                notifiedAt: new Date()
              });
              await request.save();
            }

            console.log(`[EVENT MATCH] New Donor ${donor.name} (${donor.bloodGroup}) matched & emailed for Request #${request._id}`);
          }
        }
      }
    }

    return { matchedRequests: matchedCount };
  } catch (error) {
    console.error('Error matching new donor against active blood requests:', error);
    return { matchedRequests: 0, error: error.message };
  }
};

/**
 * Continuous Background Monitor: Periodic check of all ACTIVE blood requests
 */
const monitorActiveBloodRequests = async () => {
  try {
    const activeRequests = await BloodRequest.find({
      currentStatus: { $in: ['ACTIVE', 'PENDING', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'UNAVAILABLE_ESCALATED'] },
      remainingQuantity: { $gt: 0 }
    }).populate('patient').populate('doctor');

    if (activeRequests.length === 0) return;

    console.log(`[MONITOR] Scanning ${activeRequests.length} active blood request(s)...`);

    for (const request of activeRequests) {
      // 1. Check Blood Bank Inventory for newly stocked units
      await checkBloodBankInventory(request);

      // 2. If still remaining units needed, check registered donors
      if (request.remainingQuantity > 0) {
        await searchRegisteredDonors(request);
      }

      // 3. If fully secured, mark BLOOD_SECURED and fulfill campaign
      if (request.remainingQuantity === 0) {
        request.currentStatus = 'BLOOD_SECURED';
        await request.save();
        if (request.socialCampaignId) {
          await fulfillCampaign(request._id);
        }
      }
    }
  } catch (error) {
    console.error('Error running monitorActiveBloodRequests:', error);
  }
};

/**
 * Day 3 Emergency Social Media Trigger:
 * Creates emergency social campaign if blood request is still ACTIVE, remainingQuantity > 0,
 * and at least 2 days have passed since creation.
 */
const processDay3SocialMediaEmergency = async () => {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const eligibleRequests = await BloodRequest.find({
      currentStatus: { $in: ['ACTIVE', 'PENDING', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'UNAVAILABLE_ESCALATED'] },
      remainingQuantity: { $gt: 0 },
      createdAt: { $lte: twoDaysAgo },
      socialCampaignId: { $exists: false }
    }).populate('patient').populate('doctor');

    for (const request of eligibleRequests) {
      console.log(`[DAY 3 EMERGENCY TRIGGERED] Creating emergency social media post for Request #${request._id} (${request.requiredBloodGroup}, Remaining: ${request.remainingQuantity})`);
      
      const campaignResult = await createCampaign(request);
      if (campaignResult.success && campaignResult.campaign) {
        request.socialCampaignId = campaignResult.campaign._id;
        request.currentStatus = 'PUBLIC_RECRUITMENT';
        await request.save();

        // AUTOMATIC SOCIAL MEDIA PUBLISHING INTEGRATION
        const { publishCampaign } = require('./socialMediaService');
        const publishResult = await publishCampaign(campaignResult.campaign._id);

        await notifyRole('HOSPITAL_MANAGEMENT', {
          type: 'SOCIAL_CAMPAIGN',
          title: 'Day 3 Social Media Emergency Campaign Launched',
          message: `Blood remains unfulfilled after 2 days. Emergency campaign generated (Status: ${publishResult.status}) for ${request.requiredBloodGroup} (${request.remainingQuantity} units remaining for ${request.patient?.name}).`,
          relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
        });
      }
    }
  } catch (error) {
    console.error('Error processing Day 3 social media emergency:', error);
  }
};

/**
 * Handles Donor Accept or Reject response
 * Note: A donor accepting marks willingness (ACCEPTED); it does NOT increment securedQuantity
 * until the donation/blood is actually verified and secured.
 */
const processDonorResponse = async (bloodRequestId, donorId, statusAction) => {
  const request = await BloodRequest.findById(bloodRequestId)
    .populate('patient')
    .populate('doctor');

  if (!request) throw new Error('Blood request not found');

  // Update DonorMatch tracking record
  await DonorMatch.findOneAndUpdate(
    { donorId, bloodRequestId },
    {
      $set: {
        donorResponse: statusAction,
        matchStatus: 'RESPONDED',
        respondedAt: new Date()
      }
    },
    { upsert: true }
  );

  let responseIndex = request.donorResponses.findIndex(
    dr => dr.donorId && dr.donorId.toString() === donorId.toString()
  );

  if (responseIndex === -1) {
    request.donorResponses.push({
      donorId,
      status: statusAction,
      notifiedAt: new Date(),
      respondedAt: new Date()
    });
  } else {
    request.donorResponses[responseIndex].status = statusAction;
    request.donorResponses[responseIndex].respondedAt = new Date();
  }

  const donor = await Donor.findById(donorId);

  if (statusAction === 'ACCEPTED') {
    request.matchedDonorId = donorId;
    request.source = 'REGISTERED_DONOR';
    await request.save();

    // Notify Doctor & Hospital Management of donor willingness
    if (request.doctor) {
      await createNotification({
        recipientId: request.doctor._id || request.doctor,
        type: 'DONOR_ACCEPTED',
        title: 'Donor Confirmed Willingness to Donate',
        message: `Donor ${donor?.name} (${donor?.bloodGroup}) confirmed willingness to donate for Patient ${request.patient?.name}. Ready for hospital appointment & procedure.`,
        relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
      });
    }

    await notifyRole('HOSPITAL_MANAGEMENT', {
      type: 'DONOR_ACCEPTED',
      title: 'Donor Willing to Donate',
      message: `Donor ${donor?.name} agreed to donate for Patient ${request.patient?.name} (${request.requiredBloodGroup}).`,
      relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
    });

    if (request.patient && request.patient.userId) {
      await createNotification({
        recipientId: request.patient.userId,
        type: 'BLOOD_AVAILABLE',
        title: 'A Voluntary Donor is Ready!',
        message: `A willing donor (${donor?.name}) has agreed to donate ${request.requiredBloodGroup} blood for your scheduled transfusion.`,
        relatedEntity: { entityType: 'BloodRequest', entityId: request._id }
      });
    }
  } else {
    // REJECTED: Continue searching other donors
    await request.save();
    await searchRegisteredDonors(request);
  }

  return request;
};

/**
 * Confirms blood is secured (from hospital verification, blood bank, or completed donation)
 * Updates securedQuantity and transitions to BLOOD_SECURED when remainingQuantity reaches 0.
 */
const confirmBloodSecured = async (bloodRequestId, unitsSecured = 1, source = 'REGISTERED_DONOR') => {
  const request = await BloodRequest.findById(bloodRequestId).populate('patient').populate('doctor');
  if (!request) throw new Error('Blood request not found');

  request.securedQuantity = (request.securedQuantity || 0) + unitsSecured;
  request.remainingQuantity = Math.max(0, request.requiredQuantity - request.securedQuantity);
  request.source = source;

  if (request.remainingQuantity === 0) {
    request.currentStatus = 'BLOOD_SECURED';
    if (request.socialCampaignId) {
      await fulfillCampaign(request._id);
    }
  } else {
    request.currentStatus = 'ACTIVE';
  }

  await request.save();

  // If a donor match is tied to this, update donationStatus to CONFIRMED
  if (request.matchedDonorId) {
    await DonorMatch.findOneAndUpdate(
      { donorId: request.matchedDonorId, bloodRequestId: request._id },
      { $set: { donationStatus: 'CONFIRMED', confirmedAt: new Date() } }
    );
  }

  return request;
};

/**
 * Level 4: Check 7-day search period escalation (T-3 days)
 */
const process7DayEscalation = async () => {
  try {
    const unfulfilledRequests = await BloodRequest.find({
      currentStatus: { $in: ['PENDING', 'ACTIVE', 'INVENTORY_CHECK', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT'] },
      remainingQuantity: { $gt: 0 }
    }).populate('patient');

    const now = new Date();

    for (const req of unfulfilledRequests) {
      const searchDays = Math.ceil((now - new Date(req.searchStartDate)) / (1000 * 60 * 60 * 24));
      
      if (searchDays >= 7) {
        req.currentStatus = 'UNAVAILABLE_ESCALATED';
        req.escalatedAt = now;
        await req.save();

        await notifyRole('HOSPITAL_MANAGEMENT', {
          type: 'HOSPITAL_ESCALATION',
          title: 'URGENT: Blood Procurement Search Escalation (Day 7)',
          message: `Required blood (${req.requiredBloodGroup}, ${req.remainingQuantity} units remaining) is currently UNAVAILABLE after the 7-day search period for Patient ${req.patient?.name}. Transfusion scheduled on ${new Date(req.transfusionDate).toLocaleDateString()}.`,
          relatedEntity: { entityType: 'BloodRequest', entityId: req._id }
        });

        console.log(`[ESCALATION TRIGGERED] Request #${req._id} escalated to Hospital Management.`);
      }
    }
  } catch (error) {
    console.error('Error processing 7-day escalation:', error);
  }
};

/**
 * Scans for late blood availability on escalated requests
 */
const checkLateBloodAvailability = async () => {
  try {
    const escalatedRequests = await BloodRequest.find({
      currentStatus: 'UNAVAILABLE_ESCALATED',
      remainingQuantity: { $gt: 0 }
    }).populate('patient').populate('doctor');

    for (const req of escalatedRequests) {
      const result = await checkBloodBankInventory(req);
      if (result.fulfilled) {
        req.lateAvailableAt = new Date();
        await req.save();
      }
    }
  } catch (error) {
    console.error('Error checking late blood availability:', error);
  }
};

module.exports = {
  initiateBloodSearch,
  checkBloodBankInventory,
  searchRegisteredDonors,
  checkAndMatchNewDonor,
  monitorActiveBloodRequests,
  processDay3SocialMediaEmergency,
  processDonorResponse,
  confirmBloodSecured,
  process7DayEscalation,
  checkLateBloodAvailability
};
