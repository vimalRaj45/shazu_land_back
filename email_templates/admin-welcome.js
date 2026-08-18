const { renderEmailCard } = require('./base-layout');

/**
 * Admin Team Onboarding / Welcome Email Template (Mobile-Optimized)
 */
function getAdminWelcomeEmail({ name, email, role }) {
  const subject = 'Welcome to SST Management Team - Admin Access Provisioned';
  const roleDisplay = (role || 'editor').replace('_', ' ');

  const contentHtml = `
    <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Hello <strong>${name}</strong>,</p>
    <p style="color: #475569; font-size: 13.5px; line-height: 1.6;">You have been granted administrator access to the <strong>Shazu Soft Technologies Management Control Center</strong> with the role of <strong style="color: #123B32; text-transform: uppercase;">${roleDisplay}</strong>.</p>
    
    <!-- Role Credentials Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
          <div><strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Assigned Role:</strong> <span style="font-weight: 700; color: #123B32; font-size: 14px; text-transform: capitalize; margin-left: 4px;">${roleDisplay}</span></div>
          <div style="margin-top: 8px;"><strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Login Security:</strong> <span style="color: #334155; font-size: 13px;">Email OTP Verification or Google Workspace SSO</span></div>
        </td>
      </tr>
    </table>

    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 14px; border-radius: 6px; font-size: 12.5px; color: #166534; line-height: 1.5; margin: 16px 0;">
      <strong>How to Sign In:</strong> Navigate to the Admin sign-in portal, enter your registered email address, and verify using the instant 6-digit OTP dispatched to your inbox.
    </div>
    
    <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">
      Warm regards,<br>
      <strong style="color: #334155;">Security & Access Administration</strong><br>
      Shazu Soft Technologies
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Admin Portal Access Granted',
    subtitleColor: '#C47D4C',
    contentHtml,
    footerNote: 'Keep your administrator credentials confidential.'
  });

  return { subject, htmlContent };
}

module.exports = { getAdminWelcomeEmail };
