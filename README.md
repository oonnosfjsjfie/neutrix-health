# Neutrix Health

AI post-discharge patient portal by **Team Neutrinos** (Ajay, Lingesh, Bobby, Adam).
Live: https://neutrix-health.onrender.com

Upload discharge papers (PDFs or phone photos) and Neutrix turns them into a recovery dashboard,
in English and Malayalam. Neutrix organizes and explains medical information. It does not diagnose,
prescribe, or replace a doctor.

## Features
| Tool | What it does |
|---|---|
| AI Discharge Summary | PDFs or photos of each page (camera or gallery). The AI checks every photo is clear and asks for a retake/replace if not. Scanned PDFs are read too. |
| AI Patient Reports Portal | The summary in plain words, with every earlier version. |
| Medicine Plan & Schedule | Medicine plan, daily tick-off schedule (versions when medicines change), intake history PDF, and **Add to my calendar** (Google Calendar / iPhone .ics, daily reminders with a link back to tick the dose). |
| Upcoming Check-ups | Follow-up visits and tests with dates. |
| My Improvements | Compare a newer report with the earlier ones. |
| Exercise (AI coach) | Appears only when the reports advise exercises. MediaPipe pose tracking in the browser (dots and lines on the joints), rep counting, form tips, voice, history and PDF. Video never leaves the device. |
| Recovery Tracker | Daily readings and symptoms, red-flag warning for danger signs, reading history. |
| Ask Doctor | Write an update and email it to the doctor. |
| Overall Progress Report | One AI report for the doctor from everything recorded (adherence, readings, symptoms, exercise, report changes), as a PDF. |
| Ask Neutrix | Chat that knows the website and your data; draws charts of your readings and shows the pictures from your reports. |
| 🖼 Show visual representation | On the AI Patient Reports Portal and My Improvements, only when a report has pictures (X-ray, scan, ECG): the picture with numbered labels and a simple AI explanation. |
| Patient Profile | Next → Next → Save: patient info (name, phone, email), medical baseline, optional caregiver. Take or upload a photo. |
| Feedback | ⚑ Report button on every page (except Admin) and a skippable rating pop-up on the website every 8 days. |
| Admin Access | For admin accounts only (see below). |

## Android app
- Download: https://github.com/oonnosfjsjfie/neutrix-health/releases/latest/download/NeutrixHealth.apk (also the 📱 button on the website).
- It is a Trusted Web Activity: the app opens the live website full screen using Chrome on the phone, so every website
  change shows up in the app straight away. A new APK is only needed if the app itself changes (name, icon, start page).
- Code in `android/`. GitHub Actions (`.github/workflows/android.yml`) builds the APK whenever `android/` changes, or by hand
  (Actions → Build Android app → Run workflow), and publishes it under Releases → `android-latest`.
- Signing: repo secrets `NEUTRIX_KEYSTORE_BASE64` and `NEUTRIX_KEYSTORE_PASSWORD`. Keep the key file safe; it is needed for
  every future update (and for Google Play). Without the secrets the build uses a temporary key and shows an address bar.
- `/.well-known/assetlinks.json` (served by the backend from `android/app-link.json`) tells Android the app and the website belong together.
- The website is also installable from Chrome (⋮ → Add to Home screen) thanks to `manifest.webmanifest` and `sw.js`.

## Run it on your computer
1. Create `backend/.env` (copy `backend/.env.example`) and fill in your own values.
2. `pip install -r backend/requirements.txt`
3. `cd backend` then `python main.py`
4. Open http://127.0.0.1:8000

## Deploy on Render
- Build command: `pip install -r backend/requirements.txt`
- Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Pushing to `main` deploys automatically (about 2 minutes). Pages are served with `Cache-Control: no-cache`, so updates show without a hard refresh.
- The free plan sleeps after inactivity: open the site a minute before a demo.

### Environment variables (Render + `backend/.env`; never in GitHub)
| Name | Used for |
|---|---|
| `GEMINI_API_KEY` | All AI features |
| `FIREBASE_CONFIG` | Accounts (the web config snippet; also gives the server the project id) |
| `NEUTRIX_MAIL_WEBHOOK`, `NEUTRIX_MAIL_TOKEN` | Sending email (Ask Doctor, Admin emails) via Google Apps Script (`email-script/Code.gs`) |
| `FIREBASE_SERVICE_ACCOUNT` | Only for **Delete user** in the Admin page (Firebase → Project settings → Service accounts → Generate new private key; paste the JSON). Keep it secret. |

## Accounts and data (Firebase)
- Firebase project `neutrix-health`: Authentication (Email/Password + Google) and Firestore (Mumbai).
- Each person's data lives in `users/{uid}`; only that person can read or write it.
- `contacts/{uid}` holds only email, phone and gender, for the team to contact people.
- `feedback` holds ratings and problem reports (anyone can send; only admins can read).
- Security rules: `firestore.rules` (publish them in Firebase → Firestore → Rules after changing).
- Add every website address you use to Firebase → Authentication → Settings → Authorized domains.

## Admins
Admin emails (must sign in with Google or have a verified email) are listed in three places, keep them the same:
`firestore.rules`, `frontend/neutrix-cloud.js` (`ADMIN_EMAILS`) and `backend/services/admin_tools.py` (`ADMIN_EMAILS`).

The Admin page (profile picture menu → 🛡 Admin Access) shows:
- **People**: email, phone and gender only (no profiles or medical records; Firebase blocks them), CSV export, delete user.
- **Ratings & reports**: average rating, all ratings and problem reports, reply by email, delete.
- **Send email**: email chosen registered people (one email each), from the Neutrix mail service, replies go to the admin.

## Privacy summary
- Medical records are readable only by the person who owns them, on any device they sign in with.
- Reports are sent to Google Gemini to be read and explained.
- The team can see only email, phone, gender and feedback. Nothing is sold.
- Exercise camera video is processed in the browser and never uploaded.
