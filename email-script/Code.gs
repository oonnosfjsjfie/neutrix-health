// =====================================================
// Neutrix Health – Doctor Brief email sender (Google Apps Script)
//
// Runs inside the TEAM Gmail account and sends the Doctor Brief emails,
// because Render's free plan blocks normal Gmail (SMTP) connections.
//
// Setup (in the team Gmail account):
// 1. Go to https://script.google.com -> New project, delete everything, paste this file.
// 2. Change SECRET_WORD below to your own secret (letters/numbers, no spaces).
// 3. Deploy -> New deployment -> type "Web app"
//      Execute as: Me      Who has access: Anyone
//    -> Deploy -> Authorize access -> pick the team account -> Advanced -> Go to project -> Allow
// 4. Copy the "Web app URL" (ends with /exec).
// 5. In Render (and backend/.env), add:
//      NEUTRIX_MAIL_WEBHOOK = the Web app URL
//      NEUTRIX_MAIL_TOKEN   = the same SECRET_WORD
// =====================================================

const SECRET_WORD = 'CHANGE_ME_TO_YOUR_SECRET';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.token || d.token !== SECRET_WORD) return reply({ ok: false, message: 'Wrong token' });
    if (!d.to || !d.body) return reply({ ok: false, message: 'Missing address or message' });

    const options = { name: d.name || 'Neutrix Health' };
    if (d.replyTo) options.replyTo = d.replyTo;
    MailApp.sendEmail(d.to, d.subject || 'Patient update from Neutrix Health', d.body, options);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, message: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, message: 'Neutrix email service is running.' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
