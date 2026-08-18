const { renderEmailCard } = require('./base-layout');

/**
 * Admin Direct Communication / Reply Email Template (Mobile-Optimized)
 */
function getAdminDirectEmail({ toName, subject, message }) {
  const contentHtml = `
    ${toName ? `<p style="margin-top: 0; font-size: 15px; color: #0f172a;">Dear <strong>${toName}</strong>,</p>` : ''}
    
    <div style="font-size: 13.5px; color: #334155; line-height: 1.7; white-space: pre-line; margin: 16px 0;">${message}</div>
    
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;">
    
    <p style="font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.5;">
      <strong>Shazu Soft Technologies Management</strong><br>
      Executive & Operations Desk<br>
      Salem, Tamil Nadu, India
    </p>
  `;

  const htmlContent = renderEmailCard({
    subtitle: 'Official Communication',
    subtitleColor: '#C47D4C',
    contentHtml,
    footerNote: 'This is an official communication dispatched from the SST Management Center.'
  });

  return { subject, htmlContent };
}

module.exports = { getAdminDirectEmail };
