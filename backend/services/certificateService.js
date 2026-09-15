/**
 * ==============================================================================
 * 🎓 CERTIFICATE SERVICE — CertiVerify External REST API Integration
 * ==============================================================================
 * Issues digital verifiable certificates with QR verification, PDF downloads,
 * and automated email delivery via the CertiVerify engine.
 */

const API_KEY = process.env.CERTIFICATE_API_KEY || 'cv_live_87193fd43c328c5938e34464f7d66fee4ad60e878c3b6316';
const BASE_URL = (process.env.CERTIFICATE_API_BASE_URL || 'https://shazusoft-cert-backend.onrender.com').replace(/\/$/, '');
const FALLBACK_URL = (process.env.CERTIFICATE_API_FALLBACK_URL || 'https://certificates.shazusofttechnologies.org/api/v1/external/certificates/issue');

/**
 * Issues a certificate via the CertiVerify REST API
 * @param {Object} params
 * @param {string} [params.templateName] - Name of the template in CertiVerify (e.g., 'MEMBERSHIP', 'EVENT')
 * @param {string} [params.templateId] - Optional template UUID
 * @param {string} [params.associationName] - Organization/Association Name
 * @param {string} params.recipientName - Student/Member full name
 * @param {string} params.recipientEmail - Student/Member email address
 * @param {string} params.courseTitle - Course, Workshop, or Event title
 * @param {Object} [params.fieldData={}] - Optional dynamic field key-values (e.g., { issue_date: '...', grade: '...' })
 * @param {boolean} [params.sendEmail=true] - Whether to automatically dispatch branded email
 * @returns {Promise<{ certificateId: string, uniqueCode: string, downloadUrl: string, verificationUrl: string, previewImageUrl: string, emailStatus: string, raw: Object }>}
 */
async function issueCertificate({
  templateName,
  templateId,
  associationName = 'Shazu Soft Technologies',
  recipientName,
  recipientEmail,
  courseTitle,
  fieldData = {},
  sendEmail = true
}) {
  const cleanName = (recipientName || '').trim();
  const cleanEmail = (recipientEmail || '').trim().toLowerCase();
  const cleanTitle = (courseTitle || 'Certificate of Completion').trim();
  const cleanAssoc = (associationName || 'Shazu Soft Technologies').trim();

  if (!cleanName || !cleanEmail) {
    throw new Error('Recipient name and email address are required to issue a certificate');
  }

  const payload = {
    recipient_name: cleanName,
    recipient_email: cleanEmail,
    course_title: cleanTitle,
    association_name: cleanAssoc,
    send_email: sendEmail !== false,
    field_data: fieldData || {}
  };

  if (templateName) payload.template_name = templateName;
  if (templateId) payload.template_id = templateId;

  const endpoints = [
    `${BASE_URL}/api/v1/external/certificates/issue`,
    process.env.CERTIFICATE_API_URL,
    FALLBACK_URL
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  let lastError = null;
  let lastStatus = 500;
  let responseData = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && (data.success || data.data)) {
        responseData = data;
        break;
      }

      lastStatus = response.status;
      lastError = data.error || data.message || `HTTP ${response.status}`;
      // Continue to next fallback if 404 or 405 (e.g. Cloudflare Pages edge route)
      if (response.status === 404 || response.status === 405) {
        continue;
      }
      break;
    } catch (err) {
      lastError = err.message;
    }
  }

  if (!responseData) {
    throw new Error(lastError || `Failed to issue certificate (HTTP ${lastStatus})`);
  }

  const d = responseData.data || responseData.certificate || responseData;
  const uniqueCode = d.unique_code || d.certificate_id || d.id || '';
  const certificateId = d.certificate_id || d.id || uniqueCode;
  const verificationUrl = d.verification_url || (uniqueCode ? `${BASE_URL}/verify/${uniqueCode}` : '');
  const downloadUrl = d.download_url || (uniqueCode ? `${BASE_URL}/api/public/certificates/${uniqueCode}/download` : '');
  const previewImageUrl = d.preview_image_url || (uniqueCode ? `${BASE_URL}/api/public/certificates/${uniqueCode}/preview` : '');
  const emailStatus = d.email_delivery?.status || (sendEmail ? 'queued' : 'skipped');

  return {
    certificateId,
    uniqueCode,
    downloadUrl,
    verificationUrl,
    previewImageUrl,
    emailStatus,
    raw: responseData
  };
}

/**
 * Retrieves all available certificate templates
 * @returns {Promise<Array>}
 */
async function getTemplates() {
  const url = `${BASE_URL}/api/v1/external/templates`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Failed to fetch templates (HTTP ${response.status})`);
  }
  return data.templates || data.data || [];
}

module.exports = {
  issueCertificate,
  getTemplateRequiredFields,
  getTemplates
};

