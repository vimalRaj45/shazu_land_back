const { renderEmailCard } = require('./base-layout');

/**
 * Contact Inquiry Acknowledgment Email Template (Mobile-Optimized)
 */
function getContactInquiryEmail({ name, email, subject, service_category, tokenNo, message }) {
  const emailSubject = `Inquiry Received [Ref: ${tokenNo}] - Shazu Soft Technologies`;

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${name}</strong>,</p>
    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">Thank you for contacting <strong>Shazu Soft Technologies</strong>. We have received your inquiry regarding <strong>"${subject || 'General Inquiry'}"</strong>.</p>
    
    <!-- Reference Token Box -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Inquiry Reference Token</div>
          <div class="token-text" style="font-size: 20px; font-family: Consolas, Monaco, monospace; font-weight: 800; color: #123B32; margin-top: 4px;">
            ${tokenNo}
          </div>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
            <strong style="color: #64748b;">Service Category:</strong> <span style="color: #0f172a; font-weight: 600;">${service_category || 'General'}</span>
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 14px; border-radius: 6px; font-size: 12.5px; color: #166534; line-height: 1.5; margin: 16px 0;">
      <strong>Response Timeline:</strong> Our consulting & engineering team in Salem, Tamil Nadu is reviewing your inquiry and will reach out to you within <strong>24 business hours</strong>.
    </div>

    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 20px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">Client Success & Operations Desk</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Client Inquiries & Support Desk',
    subtitleColor: '#C47D4C',
    contentHtml,
    footerNote: 'Please mention your Reference Token in all future correspondence regarding this inquiry.'
  });

  return { subject: emailSubject, htmlContent };
}

module.exports = { getContactInquiryEmail };
