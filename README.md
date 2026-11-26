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
| ✦ Emma (AI assistant) | Button at the top right of every page (Alt+A), or say "Hey Emma". Talk or type; she answers out loud in a natural British voice (Gemini TTS, real-time Gemini Live voice when available), in simple words or in detail when asked, and can use the website for you: opens pages, reads the screen, clicks, types, scrolls (pages and inner boxes) and sends reports. Instant commands for navigation, theme, language, zoom and reading the page. Asks before deleting, sending or signing out. |
| 🫀 3D View | Interactive 3D body (three.js) on the Reports page and its own 3D View page. A scan intro builds the nerves, body and organs, then the AI marks the areas from the report in red (`/api/body-map`); tap one for what happened, the cause, what the report says to do, and Listen. Layers, "Hide problem areas", replay. Real anatomy from BodyParts3D (© DBCLS, CC BY-SA 2.1 JP) in `frontend/assets/body/body.bin`; about 80% medically accurate (organs/skeleton ~90%, nerves and limb vessels ~50–60%, simplified). The body follows the profile gender: female (female chest, drawn uterus/ovaries/tubes), male (scanned, with prostate), other/not set (neutral). Not a medical scan. |
| 🕘 Medical history | Nothing is overwritten when a new report comes in (`frontend/history.js`, saved per issue as `neutrixHistory`). Medicines: what changed after each report, a dated timeline, past medicines (stopped vs course finished), older plans. Check-ups: upcoming / past with "I went" / "Missed", past check-ups from earlier reports kept. Ask Doctor: optional report details in the message, every sent message kept. Earlier progress reports, exercise list changes, lab value trends on My Improvements (`/api/lab-trends`, values copied exactly), and a report picker + compare on the 3D View. |
| 🖼 Show visual representation | On the AI Patient Reports Portal and My Improvements, only when a report has pictures (X-ray, scan, ECG): the picture with numbered labels and a simple AI explanation. |
| Patient Profile | Next → Next → Save: patient info (name, phone, email), medical baseline, optional caregiver. Take or upload a photo. |
| Feedback | ⚑ Report button on every page (except Admin) and a skippable rating pop-up on the website every 8 days. |
| Admin Access | For admin accounts only (see below). |

## Android app
- Download: https://github.com/oonnosfjsjfie/neutrix-health/releases/latest/download/NeutrixHealth.apk (also the 📱 button on the website).
- A real app (Capacitor, folder `app/`): its own app window (no browser bar) showing the same screens as the website, so
  every website update reaches the app at once. Downloads open in the right app, outside links open in an in-app browser,
  the Back button works, and the camera works.
- **Offline mode** (app and website): after the first launch with internet, every page is kept on the device (`sw.js`).
  Without internet everything still opens; ticks, readings and profile changes are saved and sent when the internet
  returns. AI features say they need the internet.
- **Two-way sync**: a change on the phone shows on the website within seconds, and the other way round
  (`neutrix-cloud.js`, Firestore live updates).
- GitHub Actions (`.github/workflows/android.yml`) builds the APK whenever `app/` changes, or by hand
  (Actions → Build Android app → Run workflow), and publishes it under Releases → `android-latest`.
- GitHub secrets: `NEUTRIX_KEYSTORE_BASE64` + `NEUTRIX_KEYSTORE_PASSWORD` (signing key; keep the key file safe) and
  `GOOGLE_SERVICES_JSON_BASE64` (Google sign-in in the app; without it the app uses email sign-in).
- The website is also installable from Chrome (⋮ → Add to Home screen).

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
| `NEUTRIX_ASSISTANT_API_KEY` | Optional: a separate Gemini key just for the Neutrix Assistant (uses `GEMINI_API_KEY` if not set) |
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
