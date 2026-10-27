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
- Environment variables: `GEMINI_API_KEY`, `NEUTRIX_EMAIL`, `NEUTRIX_EMAIL_PASSWORD`

Neutrix organizes and explains medical information. It does not diagnose, prescribe, or replace a doctor.
