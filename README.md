# Neutrix Health

AI post-discharge patient portal by **Team Neutrinos** (Ajay, Lingesh, Bobby, Adam).

Upload a discharge summary, lab reports and pharmacy bills and Neutrix turns them into a simple summary,
a medicine plan with a daily tick-off schedule, check-up dates, report comparisons, a recovery tracker,
a doctor brief that can be emailed, and a chat assistant — in English and Malayalam.

## Run it on your computer
1. Create `backend/.env` (copy `backend/.env.example`) and fill in your own values.
2. `pip install -r backend/requirements.txt`
3. `cd backend` then `python main.py`
4. Open http://127.0.0.1:8000

## Deploy on Render
- Build command: `pip install -r backend/requirements.txt`
- Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables: `GEMINI_API_KEY`, `FIREBASE_CONFIG` (accounts, see below), `NEUTRIX_MAIL_WEBHOOK`, `NEUTRIX_MAIL_TOKEN` (Doctor Brief email via Google Apps Script, see `email-script/Code.gs`)

Neutrix organizes and explains medical information. It does not diagnose, prescribe, or replace a doctor.

## Accounts (Firebase)
Sign In / Sign Up (email or Google) and saving each user's data online use Firebase (free Spark plan).
- Firebase project: `neutrix-health` — Authentication (Email/Password + Google) and Firestore (Mumbai).
- Firestore security rules: `firestore.rules` (each user can only read/write `users/{their uid}`).
- The web config is served by the backend from the `FIREBASE_CONFIG` environment variable.
- Add every website address you use to Firebase → Authentication → Settings → Authorized domains.
