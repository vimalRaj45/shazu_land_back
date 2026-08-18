const { renderEmailCard } = require('./base-layout');

/**
 * Event Registration Received Email Template (100% Mobile-Friendly & Structured)
 */
function getEventRegistrationAckEmail({
  name,
  email,
  event_title,
  tokenNo,
  isPaid,
  initialStatus,
  transaction_id,
  target_audience,
  school_name,
  grade_standard,
  section_roll,
  guardian_name,
  guardian_phone,
  college_name,
  degree,
  department,
  year_of_study,
  register_no,
  company_name,
  designation,
  experience_years
}) {
  const audience = target_audience || 'College';
  let audienceDetailHtml = '';

  if (audience === 'School') {
    audienceDetailHtml = `
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 14px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
        <tr>
          <td style="padding: 14px 16px; font-size: 12.5px; line-height: 1.6; color: #334155;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">🏫 School Student Particulars</div>
            <div><strong>School:</strong> ${school_name || 'N/A'}</div>
            <div><strong>Standard / Class:</strong> ${grade_standard || 'N/A'} (Section/Roll: ${section_roll || 'N/A'})</div>
            <div><strong>Guardian / Teacher:</strong> ${guardian_name || 'N/A'} (${guardian_phone || 'N/A'})</div>
          </td>
        </tr>
      </table>
    `;
  } else if (audience === 'College') {
    audienceDetailHtml = `
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 14px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
        <tr>
          <td style="padding: 14px 16px; font-size: 12.5px; line-height: 1.6; color: #334155;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">🎓 College Student Particulars</div>
            <div><strong>College:</strong> ${college_name || 'N/A'}</div>
            <div><strong>Department & Degree:</strong> ${degree || 'B.E/B.Tech'} - ${department || 'N/A'}</div>
            <div><strong>Year of Study:</strong> ${year_of_study || 'N/A'} • <strong>Roll/Reg No:</strong> ${register_no || 'N/A'}</div>
          </td>
        </tr>
      </table>
    `;
  } else if (audience === 'Professional') {
    audienceDetailHtml = `
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 14px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
        <tr>
          <td style="padding: 14px 16px; font-size: 12.5px; line-height: 1.6; color: #334155;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">💼 Professional Particulars</div>
            <div><strong>Company / Org:</strong> ${company_name || 'N/A'}</div>
            <div><strong>Designation:</strong> ${designation || 'N/A'} • <strong>Experience:</strong> ${experience_years || 'N/A'}</div>
          </td>
        </tr>
      </table>
    `;
  }

  const verificationNoticeHtml = isPaid ? `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #92400e; line-height: 1.6;">
          <div style="font-weight: 700; margin-bottom: 4px;">Payment Verification in Progress (Within 12 Hours):</div>
          We have received your registration details and UTR reference ${transaction_id ? `(<code>${transaction_id}</code>)` : ''}. Our accounts team is validating your payment. <strong>Your official QR entry pass will be dispatched to your inbox immediately after verification</strong> within 12 hours. Please stay tuned to your email!
        </td>
      </tr>
    </table>
  ` : `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #166534; line-height: 1.6;">
          <div style="font-weight: 700; margin-bottom: 4px;">Free Entry Pass Confirmed:</div>
          Your registration is confirmed. Please present your entry QR pass at the event badge desk upon arrival.
        </td>
      </tr>
    </table>
  `;

  const subject = isPaid
    ? `Registration Received [Token: ${tokenNo}] - Payment Verification Pending | SST`
    : `Official Event Pass Confirmed [Token: ${tokenNo}] - SST`;

  const tokenCardHtml = isPaid ? `
    <!-- Token Display Card for Paid Event (QR sent after verification) -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="background-color: #fffbeb; border: 1.5px dashed #f59e0b; border-radius: 14px; padding: 20px 16px; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; color: #92400e; font-weight: 700; letter-spacing: 0.5px;">Registration Reference Token</span>
          
          <div class="token-text" style="font-size: 22px; font-family: Consolas, Monaco, monospace; font-weight: 800; color: #b45309; letter-spacing: 2px; margin: 10px 0 6px 0;">
            ${tokenNo}
          </div>
          <span style="font-size: 12px; color: #b45309; font-weight: 700;">
            Status: ${initialStatus}
          </span>
          ${transaction_id ? `<div style="font-size: 11.5px; color: #78350f; margin-top: 6px;">UTR Ref: <code>${transaction_id}</code></div>` : ''}
          <div style="font-size: 11.5px; color: #92400e; margin-top: 10px; font-weight: 600; background: #fef3c7; padding: 8px 12px; border-radius: 8px; display: inline-block;">
            Your Official Entry QR Pass will be emailed to you once your payment is verified.
          </div>
        </td>
      </tr>
    </table>
  ` : `
    <!-- Free Event QR Code Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 20px 16px; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Your Official Event Entry QR Pass</span>
          
          <div style="margin: 14px 0 10px 0;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tokenNo)}&margin=8" alt="Event QR Pass" width="160" height="160" style="display: block; margin: 0 auto; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; padding: 6px;" />
          </div>

          <div class="token-text" style="font-size: 20px; font-family: Consolas, Monaco, monospace; font-weight: 800; color: #123B32; letter-spacing: 2px; margin: 6px 0;">
            ${tokenNo}
          </div>
          <span style="font-size: 12px; color: #15803d; font-weight: 700;">
            Registration Status: ${initialStatus}
          </span>
          <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Scan this QR code at the entrance desk for rapid check-in</div>
        </td>
      </tr>
    </table>
  `;

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${name}</strong>,</p>
    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">Thank you for registering for <strong>"${event_title}"</strong>.</p>
    
    ${tokenCardHtml}

    ${verificationNoticeHtml}
    ${audienceDetailHtml}

    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 22px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">SST Event Operations Desk</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Official Event Registration',
    subtitleColor: '#C47D4C',
    contentHtml,
    footerNote: 'Please keep this token handy for entrance gate check-in and certificate issuance.'
  });

  return { subject, htmlContent };
}

module.exports = { getEventRegistrationAckEmail };
