const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');

/**
 * Creates an in-app notification and dispatches an email if recipient email is available.
 */
const createNotification = async ({ recipientId, type, title, message, relatedEntity }) => {
  try {
    // 1. Create DB notification
    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      relatedEntity
    });

    // 2. Fetch recipient details for email
    const recipient = await User.findById(recipientId);
    if (recipient && recipient.email) {
      await sendEmail({
        to: recipient.email,
        subject: `[JeevanSetu Alert] ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #991B1B;">JeevanSetu Blood Management</h2>
            <p>Dear ${recipient.name},</p>
            <p><strong>${title}</strong></p>
            <p>${message}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">This is an automated notification from JeevanSetu Platform.</p>
          </div>
        `
      });
    }

    return notification;
  } catch (error) {
    console.error('Error in createNotification:', error);
    // Don't crash calling flow
    return null;
  }
};

/**
 * Notify all users with a specific role
 */
const notifyRole = async (role, { type, title, message, relatedEntity }) => {
  try {
    const users = await User.find({ role, isActive: true });
    const notifications = [];
    for (const user of users) {
      const notif = await createNotification({
        recipientId: user._id,
        type,
        title,
        message,
        relatedEntity
      });
      notifications.push(notif);
    }
    return notifications;
  } catch (error) {
    console.error(`Error notifying role ${role}:`, error);
    return [];
  }
};

module.exports = {
  createNotification,
  notifyRole
};
