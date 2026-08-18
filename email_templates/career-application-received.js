const { renderEmailCard } = require('./base-layout');

/**
 * Career / Job Application Received Email Template (Mobile-Optimized)
 */
function getCareerApplicationReceivedEmail({ applicant_name, email, job_title }) {
  const subject = `Application Received: ${job_title || 'Engineering Role'} - Shazu Soft Technologies`;

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${applicant_name}</strong>,</p>
    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">Thank you for your interest in joining <strong>Shazu Soft Technologies</strong>. We have successfully received your application for the <strong>"${job_title || 'Engineering'}"</strong> position.</p>
    
    <!-- Stage Badge Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td style="background-color: #f8fafc; border-left: 4px solid #123B32; border-radius: 8px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Current Application Stage</div>
          <div style="font-size: 15px; font-weight: 700; color: #123B32; margin-top: 2px;">Application Received (Under Initial Review)</div>
        </td>
      </tr>
    </table>

    <p style="color: #475569; font-size: 13px; line-height: 1.6;">Our hiring committee is reviewing your experience, skills, and portfolio against our current opening requirements. If your profile matches, our recruitment team will reach out directly to schedule an introductory discussion.</p>
    
    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">Talent Acquisition & People Operations</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Talent Acquisition & Careers',
    subtitleColor: '#C47D4C',
    contentHtml,
    footerNote: 'You will receive updates regarding your interview progress at this email address.'
  });

  return { subject, htmlContent };
}

module.exports = { getCareerApplicationReceivedEmail };
