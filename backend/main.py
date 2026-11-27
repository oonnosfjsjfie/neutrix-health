import os
import re
import json
import uvicorn
from pathlib import Path
from fastapi.responses import RedirectResponse, Response, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.middleware.cors import CORSMiddleware
from services.email_sender import send_doctor_email, send_team_email
from services import admin_tools
from fastapi import Header
from services.ai_engine import (
    process_documents_to_summary,
    answer_question,
    generate_medicine_plan,
    generate_checkups,
    generate_schedule,
    generate_exercises,
    generate_progress_report,
    check_photo,
    extract_visuals,
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
    if path == "/" or path.endswith((".html", ".js", ".css", ".webmanifest", ".json")):
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


# ---------- Pictures inside PDF reports (X-rays, scans, ECG) ----------
@app.post("/api/visuals")
def report_visuals(files: List[UploadFile] = File(...), report_text: str = Form("")):
    docs = [(f.filename, f.file.read()) for f in files]
    try:
        return {"visuals": extract_visuals(docs, report_text), "ok": True}
    except Exception as e:
        print(f"[visuals] error: {e}")
        return {"visuals": [], "ok": False, "message": friendly_error(e)}


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


# ---------- Admin: delete a user completely (data + sign-in account) ----------
class DeleteUserRequest(BaseModel):
    uid: str


@app.post("/api/admin/delete-user")
def admin_delete_user(req: DeleteUserRequest, authorization: str = Header("")):
    token = authorization.split(" ", 1)[1] if authorization.lower().startswith("bearer ") else ""
    try:
        admin = admin_tools.verify_admin(token)
        result = admin_tools.delete_user_completely(req.uid.strip(), admin)
        return {"ok": True, **result}
    except admin_tools.AdminNotConfigured as e:
        return {"ok": False, "message": str(e), "setup": True}
    except (PermissionError, ValueError) as e:
        return {"ok": False, "message": str(e)}
    except Exception as e:
        print(f"[admin] delete failed: {e}")
        return {"ok": False, "message": f"Could not delete this user: {e}"}


# ---------- Admin: email registered people (one email each, nobody sees the other addresses) ----------
class AdminEmailRequest(BaseModel):
    to: List[str]
    subject: str = ""
    body: str


@app.post("/api/admin/send-email")
def admin_send_email(req: AdminEmailRequest, authorization: str = Header("")):
    token = authorization.split(" ", 1)[1] if authorization.lower().startswith("bearer ") else ""
    try:
        admin = admin_tools.verify_admin(token)
    except admin_tools.AdminNotConfigured as e:
        return {"ok": False, "message": str(e)}
    except PermissionError as e:
        return {"ok": False, "message": str(e)}
    recipients = list(dict.fromkeys(a.strip().lower() for a in req.to if a and a.strip()))
    if not recipients:
        return {"ok": False, "message": "Choose at least one person."}
    if len(recipients) > 50:
        return {"ok": False, "message": "Send to 50 people or fewer at a time."}
    if not req.body.strip():
        return {"ok": False, "message": "Write a message first."}
    results = []
    for address in recipients:
        ok, message = send_team_email(address, req.subject, req.body, reply_to=admin.get("email", ""))
        results.append({"to": address, "ok": ok, "message": message})
    sent = sum(1 for r in results if r["ok"])
    print(f"[admin] {admin.get('email')} emailed {sent}/{len(results)} people")
    return {"ok": sent > 0, "sent": sent, "failed": len(results) - sent, "results": results,
            "message": f"Sent to {sent} of {len(results)}."}


# ---------- Calendar file for medicine reminders (iPhone opens it from a real address) ----------
@app.post("/api/calendar-file")
def calendar_file(ics: str = Form(...)):
    # Hands the calendar file made on the page straight back (nothing is saved)
    if not ics.startswith("BEGIN:VCALENDAR") or len(ics) > 100_000:
        return Response("Not a calendar file", status_code=400)
    return Response(ics, media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": 'inline; filename="Neutrix_medicine_reminders.ics"'})


# ---------- Chat ----------
class ChatMessage(BaseModel):
    role: str
    text: str


class AskRequest(BaseModel):
    question: str
    report_text: str = ""
    language: str = "English"
    history: List[ChatMessage] = []
    app_context: str = ""
    page: str = ""


@app.post("/api/ask")
def ask_question(req: AskRequest):
    print(f"[ask] Question: {req.question}")
    history = [m.model_dump() for m in req.history]
    from services import ai_engine
    ai_engine.LAST_CHAT_INFO.clear()
    answer = answer_question(req.question, req.report_text, history, req.language,
                             app_context=req.app_context, page=req.page)
    return {"answer": answer, "info": dict(ai_engine.LAST_CHAT_INFO)}


# ---------- Neutrix Assistant (voice + text helper that can use the website) ----------
class AssistantRequest(BaseModel):
    message: str = ""
    history: list = []
    page: dict = {}
    results: str = ""
    detail: bool = False
    language: str = "English"
    signed_in: bool = False
    device: str = "web"
    name: str = ""


@app.get("/api/assistant/ping")
def assistant_ping():
    # Called when a page opens, so a sleeping free server is awake before the user talks
    return {"ok": True}


class VoiceRequest(BaseModel):
    text: str
    voice: str = ""


@app.post("/api/assistant/voice")
def assistant_voice(req: VoiceRequest):
    # Human-sounding voice for the assistant's replies (WAV). 503 = use the device's own voice.
    from fastapi.responses import Response as _Resp
    from services.voice import speak
    try:
        return _Resp(content=speak(req.text, req.voice), media_type="audio/wav",
                     headers={"Cache-Control": "public, max-age=604800"})
    except Exception as e:
        return _Resp(content=str(e)[:200], status_code=503, media_type="text/plain")


class BodyMapRequest(BaseModel):
    report: str
    language: str = "English"
    sex: str = "neutral"


@app.post("/api/body-map")
def body_map_route(req: BodyMapRequest):
    # 3D body view: which parts of the body the report is about, with simple explanations
    from services.body_map import body_map
    try:
        return body_map(req.report, req.language, req.sex)
    except Exception as e:
        return JSONResponse({"error": str(e)[:300]}, status_code=503)


class PillCheckRequest(BaseModel):
    image: str            # data URL or base64 (jpeg / png / webp)
    medicines: list = []  # "Atorvastatin 40 mg" ...


@app.post("/api/pill-check")
def pill_check_route(req: PillCheckRequest):
    # Medicine photo check: read the printed label and compare it with the patient's medicine list
    import base64
    from services.pill_check import pill_check
    m = re.match(r"^data:(image/(?:jpeg|png|webp));base64,(.*)$", req.image or "", re.S)
    mime, b64 = (m.group(1), m.group(2)) if m else ("image/jpeg", req.image or "")
    try:
        data = base64.b64decode(b64, validate=False)
    except Exception:
        return JSONResponse({"error": "bad image"}, status_code=400)
    if len(data) < 1000 or len(data) > 6_000_000:
        return JSONResponse({"error": "image size"}, status_code=400)
    try:
        return pill_check(data, mime, [str(x) for x in req.medicines][:40])
    except Exception as e:
        return JSONResponse({"error": str(e)[:300]}, status_code=503)


class LabTrendsRequest(BaseModel):
    report: str


@app.post("/api/lab-trends")
def lab_trends_route(req: LabTrendsRequest):
    # My Improvements: every numeric test result in the reports with its date (copied, never calculated)
    from services.lab_trends import lab_trends
    try:
        return lab_trends(req.report)
    except Exception as e:
        return JSONResponse({"error": str(e)[:300]}, status_code=503)


@app.post("/api/assistant/live")
def assistant_live(origin: str = Header(default=""), referer: str = Header(default="")):
    # A short-lived pass for Gemini Live (real-time voice). The API key itself never leaves the server.
    # Only handed to pages of this website / the app (stops other sites using the key).
    src = origin or referer
    if src and not any(h in src for h in ("neutrix-health.onrender.com", "localhost", "127.0.0.1", "capacitor://", "https://localhost")):
        return JSONResponse({"error": "not allowed"}, status_code=403)
    from services.live import start
    try:
        return start()
    except Exception as e:
        return JSONResponse({"error": str(e)[:300]}, status_code=503)


@app.post("/api/assistant/voice/stream")
def assistant_voice_stream(req: VoiceRequest):
    # Same voice, sent piece by piece so it starts talking straight away (raw 16-bit PCM, 24 kHz, mono)
    from fastapi.responses import Response as _Resp, StreamingResponse
    from services.voice import stream
    try:
        pieces = stream(req.text, req.voice)
    except Exception as e:
        return _Resp(content=str(e)[:300], status_code=503, media_type="text/plain")
    return StreamingResponse(pieces, media_type="audio/L16; rate=24000; channels=1",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@app.post("/api/assistant")
def assistant(req: AssistantRequest):
    from services.assistant import assistant_turn
    return assistant_turn(req.model_dump())


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


# ---------- Ask Doctor: send the message to the doctor's email ----------
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


# ---------- Android app (Trusted Web Activity) ----------
# The app shows this website full screen. Android checks this file to confirm the app and the
# website belong together (otherwise it shows an address bar). The fingerprint is public.
APP_LINK_FILE = Path(__file__).resolve().parent.parent / "android" / "app-link.json"

@app.get("/.well-known/assetlinks.json", include_in_schema=False)
def android_asset_links():
    try:
        info = json.loads(APP_LINK_FILE.read_text())
    except Exception:
        info = {}
    package = os.getenv("ANDROID_PACKAGE", info.get("package_name", "com.neutrinos.neutrixhealth"))
    prints = [p.strip() for p in os.getenv("ANDROID_CERT_SHA256", "").split(",") if p.strip()] or info.get("sha256_cert_fingerprints", [])
    body = [{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {"namespace": "android_app", "package_name": package, "sha256_cert_fingerprints": prints}
    }]
    return Response(json.dumps(body), media_type="application/json")


@app.get("/manifest.webmanifest", include_in_schema=False)
def web_manifest():
    return FileResponse(FRONTEND_DIR / "manifest.webmanifest", media_type="application/manifest+json")


if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    # PORT is set automatically by hosting sites like Render; 8000 on your computer.
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1" if "PORT" not in os.environ else "0.0.0.0", port=port, reload=False)
    