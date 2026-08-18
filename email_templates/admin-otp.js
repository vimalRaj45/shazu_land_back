const { renderEmailCard } = require('./base-layout');

/**
 * Admin Sign-In OTP Email Template (Mobile-Optimized & Pixel-Perfect)
 */
function getAdminOtpEmail({ name, email, otpCode }) {
  const subject = `Your Admin Verification Code: ${otpCode} - SST`;

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Hello <strong>${name || 'Administrator'}</strong>,</p>
    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">Use the 6-digit one-time password (OTP) below to authenticate into the <strong>Shazu Soft Technologies Management Control Center</strong>.</p>
    
    <!-- OTP Display Box -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 22px 16px;">
          <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">One-Time Security Code</span>
          <div class="token-text" style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #123B32; font-family: Consolas, Monaco, 'Courier New', monospace; margin: 10px 0;">
            ${otpCode}
          </div>
          <div style="font-size: 11.5px; color: #64748b; font-weight: 500;">
            ⏱️ Valid for <strong>10 minutes</strong> • Do not disclose this code
          </div>
        </td>
      </tr>
    </table>

    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.5; margin-bottom: 8px;">
      <strong>Security Notice:</strong> If you did not initiate this sign-in attempt, please alert your Super Admin immediately.
    </div>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Admin Portal Security Verification',
    subtitleColor: '#C47D4C',
    headerBg: '#123B32',
    contentHtml,
    footerNote: 'This is an automated security verification dispatch.'
  });

  return { subject, htmlContent };
}

module.exports = { getAdminOtpEmail };
