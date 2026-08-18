/**
 * Centralized Email Templates Index for Shazu Soft Technologies
 * All email layouts and templates organized modularly in one place.
 */

const { getAdminOtpEmail } = require('./admin-otp');
const { getContactInquiryEmail } = require('./contact-inquiry');
const { getMembershipAckEmail } = require('./membership-ack');
const { getCareerApplicationReceivedEmail } = require('./career-application-received');
const { getCareerApplicationStatusEmail } = require('./career-application-status');
const { getEventRegistrationAckEmail } = require('./event-registration-ack');
const { getEventPassVerifiedEmail } = require('./event-pass-verified');
const { getAdminWelcomeEmail } = require('./admin-welcome');
const { getAdminDirectEmail } = require('./admin-direct-email');

module.exports = {
  getAdminOtpEmail,
  getContactInquiryEmail,
  getMembershipAckEmail,
  getCareerApplicationReceivedEmail,
  getCareerApplicationStatusEmail,
  getEventRegistrationAckEmail,
  getEventPassVerifiedEmail,
  getAdminWelcomeEmail,
  getAdminDirectEmail
};
