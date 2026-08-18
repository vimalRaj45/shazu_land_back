const { renderEmailCard } = require('./base-layout');

/**
 * Professional Membership Application Acknowledgment Email Template (Mobile-Optimized)
 */
function getMembershipAckEmail({ name, email, membership_type, association_name, designation, qualification, tokenNo }) {
  const subject = `Membership Application Received [Token: ${tokenNo}] - SST`;

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${name}</strong>,</p>
    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">We are pleased to confirm receipt of your application for <strong>${membership_type}</strong> under the <strong>${association_name}</strong> division.</p>
    
    <!-- Application Reference Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 18px 20px; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Application Reference Token</span>
          <div class="token-text" style="font-size: 22px; font-family: Consolas, Monaco, monospace; font-weight: 800; color: #123B32; margin: 6px 0;">
            ${tokenNo}
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 6px;">
            <strong>Designation:</strong> ${designation || 'N/A'} • <strong>Qualification:</strong> ${qualification || 'N/A'}
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color: #f8fafc; border-left: 4px solid #123B32; padding: 12px 14px; border-radius: 6px; font-size: 12.5px; color: #334155; line-height: 1.5; margin: 16px 0;">
      <strong>Review Process:</strong> Our executive credential committee is reviewing your submission. Your official membership identity and certificate will be dispatched within <strong>2 to 3 business days</strong>.
    </div>

    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 20px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">Membership Executive Board</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Professional Membership Community',
    subtitleColor: '#C47D4C',
    contentHtml,
    footerNote: 'Keep this email safe for future reference of your membership enrollment.'
  });

  return { subject, htmlContent };
}

module.exports = { getMembershipAckEmail };
