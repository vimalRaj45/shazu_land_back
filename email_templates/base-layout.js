/**
 * Base Email Layout Wrapper for Shazu Soft Technologies
 * Bulletproof, 100% mobile-friendly responsive table structure.
 */

function renderEmailCard({
  subtitle = 'Official Communication',
  subtitleColor = '#C47D4C',
  headerBg = '#123B32',
  headerBorderColor = '#2F5B4E',
  contentHtml = '',
  footerNote = ''
}) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Shazu Soft Technologies</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-cell { padding: 20px 16px !important; }
      .header-cell { padding: 20px 16px !important; }
      .token-text { font-size: 20px !important; letter-spacing: 2px !important; }
      .responsive-title { font-size: 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Outer Wrapper Table -->
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px 36px 12px;">
        
        <!-- Center Card Container (Max 580px) -->
        <table role="presentation" class="email-container" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td class="header-cell" align="center" style="background-color: ${headerBg}; padding: 26px 24px; border-bottom: 2px solid ${headerBorderColor};">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <h1 class="responsive-title" style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      SHAZU SOFT TECHNOLOGIES
                    </h1>
                    <div style="display: inline-block; margin-top: 6px; padding: 3px 12px; background-color: rgba(255, 255, 255, 0.1); border-radius: 99px; border: 1px solid rgba(255, 255, 255, 0.15);">
                      <span style="color: ${subtitleColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                        ${subtitle}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td class="content-cell" style="padding: 28px 24px; font-size: 14px; line-height: 1.65; color: #334155;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer Information -->
          <tr>
            <td align="center" style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6;">
              ${footerNote ? `<p style="margin: 0 0 8px 0; color: #475569; font-size: 11.5px;">${footerNote}</p>` : ''}
              <div style="font-weight: 600; color: #334155; margin-bottom: 4px;">
                Shazu Soft Technologies • Salem, Tamil Nadu, India
              </div>
              <div style="color: #94a3b8;">
                Support: <a href="mailto:info@shazusofttechnologies.org" style="color: #123B32; text-decoration: underline; font-weight: 600;">info@shazusofttechnologies.org</a> • Phone: <a href="tel:+919361680077" style="color: #123B32; text-decoration: none; font-weight: 600;">+91 93616 80077</a>
              </div>
              <div style="color: #cbd5e1; margin-top: 8px; font-size: 10px;">
                © 2026 Shazu Soft Technologies. All rights reserved.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

module.exports = { renderEmailCard };
