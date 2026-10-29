import os
import re
import json
import uvicorn
from pathlib import Path
from fastapi.responses import RedirectResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from services.email_sender import send_doctor_email
from services.ai_engine import (
    process_documents_to_summary,
    answer_question,
    generate_medicine_plan,
    generate_checkups,
    generate_schedule,
    generate_exercises,
    generate_progress_report,
    check_photo,
    friendly_error,
    translate_markdown,
    compare_reports,
)

app = FastAPI(title="Neutrix Core Engine APIs")

# Always check for a newer version of pages, scripts and styles (the browser re-uses its copy
# only if nothing changed, using the ETag), so updates show up without pressing Ctrl + F5.
@app.middleware("http")
async def no_stale_pages(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-cache"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Summary (one or more reports + optional pharmacy bills) ----------
@app.post("/api/summarize")
def summarize_documents(
    files: Optional[List[UploadFile]] = File(None),
    bills: Optional[List[UploadFile]] = File(None),
    language: str = Form("English"),
    previous_text: str = Form(""),
    previous_bill_text: str = Form("")
):
    # previous_text / previous_bill_text are sent when the user adds more files
    # to reports they uploaded earlier, so the summary covers all of them.
    documents = [(f.filename, f.file.read()) for f in (files or [])]
    bill_docs = [(b.filename, b.file.read()) for b in (bills or [])]

    result = process_documents_to_summary(
        documents, bill_docs, language, previous_text, previous_bill_text
    )
    return {
        "filenames": [f.filename for f in (files or [])],
        "bill_filenames": [b.filename for b in (bills or [])],
        "transcription": result["transcription"],
        "bill_text": result["bill_text"],
        "summary": result["summary"],
        "ok": result["ok"],
    }


# ---------- Check a photo of a report before it is used ----------
@app.post("/api/check-photo")
def check_report_photo(file: UploadFile = File(...)):
    data = file.file.read()
    if len(data) > 15 * 1024 * 1024:
        return {"status": "unreadable", "problems": ["too_big"], "doc_type": "", "readable_percent": 0, "ok": True}
    try:
        return check_photo(data, file.filename or "photo.jpg")
    except Exception as e:
        print(f"[photo-check] error: {e}")
        return {"status": "error", "message": friendly_error(e), "ok": False}


# ---------- Chat ----------
class ChatMessage(BaseModel):
    role: str
    text: str


class AskRequest(BaseModel):
    question: str
    report_text: str = ""
    language: str = "English"
    history: List[ChatMessage] = []


@app.post("/api/ask")
def ask_question(req: AskRequest):
    print(f"[ask] Question: {req.question}")
    history = [m.model_dump() for m in req.history]
    answer = answer_question(req.question, req.report_text, history, req.language)
    return {"answer": answer}


# ---------- Medicine plan, check-ups, schedule ----------
class PlanRequest(BaseModel):
    report_text: str
    bill_text: str = ""
    language: str = "English"


@app.post("/api/medicine-plan")
def medicine_plan(req: PlanRequest):
    print("[plan] Generating medicine plan...")
    text, ok = generate_medicine_plan(req.report_text, req.bill_text, req.language)
    return {"plan": text, "ok": ok}


@app.post("/api/checkups")
def checkups(req: PlanRequest):
    print("[checkups] Mapping check-ups...")
    text, ok = generate_checkups(req.report_text, req.language)
    return {"checkups": text, "ok": ok}


@app.post("/api/schedule")
def schedule(req: PlanRequest):
    print("[schedule] Building daily schedule...")
    doses, message, ok = generate_schedule(req.report_text, req.bill_text)
    return {"doses": doses, "message": message, "ok": ok}


class ExerciseRequest(BaseModel):
    report_text: str


@app.post("/api/exercises")
def exercises(req: ExerciseRequest):
    print("[exercises] Looking for exercises in the reports...")
    items, restrictions_en, restrictions_ml, message, ok = generate_exercises(req.report_text)
    return {"exercises": items, "restrictions_en": restrictions_en,
            "restrictions_ml": restrictions_ml, "message": message, "ok": ok}


class ProgressRequest(BaseModel):
    facts: dict


@app.post("/api/progress-report")
def progress_report(req: ProgressRequest):
    print("[progress] Writing the overall progress report...")
    report, ok = generate_progress_report(req.facts)
    return {"report": report, "ok": ok}


# ---------- Compare a new report with earlier ones ----------
@app.post("/api/compare")
def compare(
    files: List[UploadFile] = File(...),
    previous_text: str = Form(""),
    language: str = Form("English")
):
    new_docs = [(f.filename, f.file.read()) for f in files]
    new_text, comparison, ok = compare_reports(previous_text, new_docs, language)
    return {
        "filenames": [f.filename for f in files],
        "new_text": new_text,
        "comparison": comparison,
        "ok": ok,
    }


# ---------- Doctor Brief: send the message to the doctor's email ----------
class EmailRequest(BaseModel):
    to: str
    subject: str = ""
    body: str
    patient_name: str = ""
    reply_to: str = ""


@app.post("/api/send-email")
def send_email(req: EmailRequest):
    ok, message = send_doctor_email(req.to, req.subject, req.body, req.patient_name, req.reply_to)
    return {"ok": ok, "message": message}


# ---------- Translation ----------
class TranslateRequest(BaseModel):
    text: str
    target_language: str


@app.post("/api/translate")
def translate(req: TranslateRequest):
    print(f"[translate] -> {req.target_language} ({len(req.text)} chars)")
    text, ok = translate_markdown(req.text, req.target_language)
    return {"text": text, "ok": ok}


# ---------- The website itself ----------
# The backend also serves the frontend folder, so the whole app works from ONE address
# (http://127.0.0.1:8000 on your computer, or a public link when it is put online).
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/", include_in_schema=False)
def open_website():
    return RedirectResponse(url="/home.html")


# Firebase web settings (accounts + online saving) come from the FIREBASE_CONFIG
# environment variable, so the key is not stored in GitHub.
# Paste Firebase's whole "const firebaseConfig = {...}" snippet (or JSON) into it.
@app.get("/firebase-config.js", include_in_schema=False)
def firebase_config():
    raw = os.getenv("FIREBASE_CONFIG", "")
    pairs = dict(re.findall(r'["\']?(\w+)["\']?\s*:\s*["\']([^"\']*)["\']', raw))
    if not pairs.get("apiKey"):
        static = FRONTEND_DIR / "firebase-config.js"
        if static.is_file():
            return FileResponse(static, media_type="application/javascript")
        return Response("window.NEUTRIX_FIREBASE_CONFIG = {};", media_type="application/javascript")
    body = "window.NEUTRIX_FIREBASE_CONFIG = " + json.dumps(pairs) + ";"
    return Response(body, media_type="application/javascript", headers={"Cache-Control": "no-cache"})


if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    # PORT is set automatically by hosting sites like Render; 8000 on your computer.
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1" if "PORT" not in os.environ else "0.0.0.0", port=port, reload=False)
    