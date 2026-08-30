/**
 * Shazu Soft Technologies - Hostinger Mail API SDK Sender Test
 * Uses official 'hostinger-mail-api-sdk' library.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Configuration, AccountApi, SendApi } = require('hostinger-mail-api-sdk');

const HOSTINGER_API_KEY = process.env.HOSTINGER_API_KEY;
const targetEmail = process.argv[2] || 'vimalraj5207@gmail.com';
const customSubject = process.argv[3] || '📧 [TEST] Official Pass / Application Confirmation - SST';

console.log('\n======================================================');
console.log(' SHAZU SOFT TECHNOLOGIES - HOSTINGER MAIL API SDK TEST');
console.log('======================================================\n');
console.log(`Recipient     : ${targetEmail}`);
console.log(`Subject       : ${customSubject}`);
console.log(`API Key       : ${HOSTINGER_API_KEY ? HOSTINGER_API_KEY.substring(0, 8) + '...' + HOSTINGER_API_KEY.substring(HOSTINGER_API_KEY.length - 4) : '\x1b[31mMISSING\x1b[0m'}`);
console.log('------------------------------------------------------\n');

if (!HOSTINGER_API_KEY) {
  console.error('\x1b[31m[ERROR] HOSTINGER_API_KEY is not defined in environment or .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Hostinger Mail SDK Configuration
const config = new Configuration({
  accessToken: HOSTINGER_API_KEY,
  apiKey: HOSTINGER_API_KEY
});

const accountApi = new AccountApi(config);
const sendApi = new SendApi(config);

const htmlTemplate = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1e293b;">
  <div style="background-color: #123B32; padding: 24px 32px; text-align: center;">
    <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">SHAZU SOFT TECHNOLOGIES</h2>
    <p style="color: #C47D4C; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase;">Official Transactional Mail System</p>
  </div>
  <div style="padding: 32px;">
    <h3 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: 600;">Hostinger Mail API Verification</h3>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Dear <strong>Vimal Raj</strong>,<br><br>
      This email confirms that the Hostinger Transactional Mail API integration is live and successfully delivering messages.
    </p>

    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; width: 130px;">Timestamp:</td>
          <td style="padding: 6px 0; font-family: monospace;">${new Date().toISOString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold;">Recipient:</td>
          <td style="padding: 6px 0;">${targetEmail}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold;">Status:</td>
          <td style="padding: 6px 0; color: #16a34a; font-weight: bold;">✓ Hostinger Mail API Live</td>
        </tr>
      </table>
    </div>
  </div>
  <div style="background-color: #f8fafc; padding: 14px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
    © ${new Date().getFullYear()} Shazu Soft Technologies. All rights reserved.
  </div>
</div>
`;

async function main() {
  let mailboxResourceId = 'AC27733647b7b2b04cefeca882d854';
  let senderEmail = 'hr@shazusofttechnologies.org';

  try {
    const accResponse = await accountApi.getCurrentAccount();
    const accData = accResponse.data ? accResponse.data.data || accResponse.data : accResponse;
    if (accData && accData.mailboxes && accData.mailboxes.length > 0) {
      mailboxResourceId = accData.mailboxes[0].resourceId || mailboxResourceId;
      senderEmail = accData.mailboxes[0].address || senderEmail;
    }
  } catch (_) {}

  console.log(`Sending email using Mailbox Resource: ${mailboxResourceId} (${senderEmail})...`);

  try {
    const sendRequest = {
      to: [targetEmail],
      subject: customSubject,
      html: htmlTemplate,
      text: 'Hostinger Mail API Verification Message'
    };

    const sendResponse = await sendApi.sendEmail(mailboxResourceId, sendRequest);
    console.log('\n\x1b[32m[SUCCESS] EMAIL SENT SUCCESSFULLY TO ' + targetEmail + '!\x1b[0m');
    if (sendResponse && sendResponse.status) {
      console.log(`HTTP Response Status: ${sendResponse.status}`);
    }
  } catch (err) {
    console.error('\n\x1b[31m[ERROR] SendApi.sendEmail failed:\x1b[0m');
    if (err.response) {
      console.error(`  Status Code : ${err.response.status}`);
      console.error(`  Error Output:`, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(`  Details     : ${err.message}`);
    }
  }
}

main();
