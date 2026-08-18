const { renderEmailCard } = require('./base-layout');

/**
 * Event Payment Verified & Official Entry Pass Approved Email Template (Mobile-Optimized)
 */
function getEventPassVerifiedEmail({ name, email, event_title, tokenNo, fee }) {
  const subject = `🎟️ APPROVED! Event Entry Pass: ${tokenNo} - ${event_title}`;

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${name}</strong>,</p>
    <p style="color: #334155; font-size: 13.5px; line-height: 1.6;">Great news! Your registration and payment for <strong>"${event_title}"</strong> have been officially <strong>VERIFIED & APPROVED</strong> by SST Administration.</p>
    
    <!-- Verified Official Ticket Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 22px 0;">
      <tr>
        <td align="center" style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 14px; padding: 22px 16px; text-align: center;">
          <div style="display: inline-block; background-color: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            ✅ OFFICIAL PASS ISSUED
          </div>
          <div style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: 700; margin-top: 4px;">YOUR EVENT ENTRY TOKEN NUMBER</div>
          <div class="token-text" style="font-size: 26px; font-family: Consolas, Monaco, monospace; font-weight: 800; color: #15803d; letter-spacing: 3px; margin: 8px 0;">
            ${tokenNo}
          </div>
          <span style="font-size: 12px; color: #166534; font-weight: 600;">Presenter / Attendee Pass for Venue Gate Verification</span>
        </td>
      </tr>
    </table>

    <!-- Event Summary Row -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 18px;">
      <tr>
        <td style="padding: 12px 16px; font-size: 12.5px; color: #475569;">
          <div><strong style="color: #1e293b;">Event:</strong> ${event_title}</div>
          ${fee ? `<div style="margin-top: 4px;"><strong style="color: #1e293b;">Fee Status:</strong> Paid (${fee}) • Verified</div>` : ''}
        </td>
      </tr>
    </table>

    <p style="font-size: 13px; color: #475569; line-height: 1.6;">Please show this email or present your Token Number (<strong>${tokenNo}</strong>) at the venue entrance badge counter to collect your entry pass and welcome kit.</p>
    
    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">SST Event Operations Desk</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Event Pass Confirmed',
    subtitleColor: '#16a34a',
    headerBg: '#123B32',
    contentHtml,
    footerNote: 'This is your official event admission ticket.'
  });

  return { subject, htmlContent };
}

module.exports = { getEventPassVerifiedEmail };
