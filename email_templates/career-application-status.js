const { renderEmailCard } = require('./base-layout');

/**
 * Career / Job Application Status Update Email Template (Mobile-Optimized)
 */
function getCareerApplicationStatusEmail({ applicant_name, email, job_title, status }) {
  const isShortlisted = status === 'Shortlisted' || status === 'Approved';
  const isRejected = status === 'Rejected';

  let subject = `Application Update: ${job_title} - Shazu Soft Technologies`;
  let stageTitle = `Application Stage: ${status}`;
  let stageDescription = `Your application for <strong>"${job_title}"</strong> has been updated to stage: <strong>${status}</strong>.`;

  let borderColor = '#123B32';
  let bgColor = '#f8fafc';
  let titleColor = '#123B32';

  if (isShortlisted) {
    subject = `🎉 Shortlisted for Interview: ${job_title} - Shazu Soft Technologies`;
    stageTitle = `Shortlisted for Technical Interview Round`;
    stageDescription = `We are pleased to inform you that your application for <strong>"${job_title}"</strong> has been reviewed and shortlisted for the technical interview stage! Our talent acquisition team will contact you with scheduling details.`;
    borderColor = '#16a34a';
    bgColor = '#f0fdf4';
    titleColor = '#15803d';
  } else if (isRejected) {
    subject = `Update regarding your application for ${job_title} - Shazu Soft Technologies`;
    stageTitle = `Application Closed`;
    stageDescription = `Thank you for your interest and time in applying for <strong>"${job_title}"</strong>. After careful evaluation, we have chosen to move forward with other candidates whose profiles more closely align with our immediate requirements. We will retain your profile in our talent network for suitable upcoming positions.`;
    borderColor = '#dc2626';
    bgColor = '#fef2f2';
    titleColor = '#b91c1c';
  }

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${applicant_name}</strong>,</p>
    
    <!-- Status Highlight Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 18px 0;">
      <tr>
        <td style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Hiring Status Update</div>
          <div style="font-size: 15px; font-weight: 700; color: ${titleColor}; margin-top: 2px;">${stageTitle}</div>
        </td>
      </tr>
    </table>

    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">${stageDescription}</p>
    
    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">Talent Acquisition Team</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: isShortlisted ? 'Interview Invitation' : 'Application Status Update',
    subtitleColor: isShortlisted ? '#16a34a' : '#C47D4C',
    contentHtml,
    footerNote: 'Shazu Soft Technologies is an equal opportunity employer.'
  });

  return { subject, htmlContent };
}

module.exports = { getCareerApplicationStatusEmail };
