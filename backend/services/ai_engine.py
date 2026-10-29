import os
import re
import json
import time
import datetime
from pathlib import Path

import pymupdf  # PyMuPDF
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load the API key from backend/.env (this file is never uploaded to GitHub)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing. Add it to backend/.env")

# Tried in this order. If one is busy, out of quota or not available, the next is used.
MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
]

BUSY_MESSAGE = (
    "Neutrix's AI service is very busy right now. "
    "Please wait a minute and try again."
)

QUOTA_MESSAGE = (
    "Neutrix has reached its AI usage limit for now. "
    "Please try again later."
)

VALID_SLOTS = {"morning", "afternoon", "evening", "night", "unclear"}

REPORT_LIMIT = 24000   # characters of report text sent to the AI
BILL_LIMIT = 4000      # characters of bill text sent to the AI

# Create the Gemini client once and keep it
client = genai.Client(
    api_key=API_KEY,
    http_options=types.HttpOptions(timeout=30_000)  # 30 seconds per try
)


# ======================================================
# Helpers
# ======================================================
def is_quota_error(msg: str) -> bool:
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower()


def generate(prompt: str, json_mode: bool = False) -> str:
    """Try each model. Retry busy models once; skip models that are out of quota or don't exist."""
    config = types.GenerateContentConfig(response_mime_type="application/json") if json_mode else None
    last_error = None
    for model in MODELS:
        for attempt in range(2):
            try:
                response = client.models.generate_content(model=model, contents=prompt, config=config)
                print(f"[ok] Answered by {model}")
                return response.text
            except Exception as e:
                last_error = e
                msg = str(e)
                if is_quota_error(msg):
                    print(f"[quota] {model} out of quota, trying next model")
                    break
                if "503" in msg or "UNAVAILABLE" in msg:
                    print(f"[busy] {model} busy (try {attempt + 1})")
                    time.sleep(1.5 * (attempt + 1))
                    continue
                if "404" in msg or "NOT_FOUND" in msg:
                    print(f"[skip] {model} not available on this key")
                    break
                print(f"[error] {model}: {msg}")
                break
    raise RuntimeError(f"All models failed. Last error: {last_error}")


def is_busy_error(err: Exception) -> bool:
    msg = str(err)
    return "503" in msg or "UNAVAILABLE" in msg or is_quota_error(msg)


def friendly_error(err: Exception) -> str:
    msg = str(err)
    if is_quota_error(msg):
        return QUOTA_MESSAGE
    if "503" in msg or "UNAVAILABLE" in msg:
        return BUSY_MESSAGE
    return f"AI processing failed: {err}"


def extract_pdf_text(file_bytes: bytes) -> str:
    text = ""
    with pymupdf.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            text += page.get_text()
    return text


# ---------- Photos and scanned pages ----------
MAX_SCANNED_PAGES = 8   # pages of a scanned PDF read with the AI

def image_mime(name: str, data: bytes):
    """Returns the image type if this file is a photo, else None."""
    head = data[:16]
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[4:12] in (b"ftypheic", b"ftypheix", b"ftyphevc", b"ftypmif1", b"ftypmsf1", b"ftypheif"):
        return "image/heic"
    ext = (name or "").lower().rsplit(".", 1)[-1]
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
            "heic": "image/heic", "heif": "image/heif"}.get(ext)


# Text already read from a photo (by the photo check), so the summary doesn't read it twice
import hashlib
from collections import OrderedDict
PHOTO_TEXT_CACHE = OrderedDict()   # sha256 -> text
PHOTO_CACHE_MAX = 300


def _photo_key(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _remember_photo_text(data: bytes, text: str):
    PHOTO_TEXT_CACHE[_photo_key(data)] = text
    PHOTO_TEXT_CACHE.move_to_end(_photo_key(data))
    while len(PHOTO_TEXT_CACHE) > PHOTO_CACHE_MAX:
        PHOTO_TEXT_CACHE.popitem(last=False)


PHOTO_PROBLEMS = {"blurry", "too_dark", "glare", "cut_off", "too_far", "tilted", "not_a_document", "handwriting_unclear"}


def check_photo(data: bytes, name: str) -> dict:
    """Checks one photo of a report before it is used.
    Returns {status: clear|unclear|unreadable, problems: [...], doc_type, readable_percent}."""
    mime = image_mime(name, data)
    if not mime:
        return {"status": "unreadable", "problems": ["not_a_photo"], "doc_type": "", "readable_percent": 0, "ok": True}
    prompt = """
    You check a photo that a patient took of ONE page of a medical document (discharge summary, lab report,
    prescription, physiotherapy sheet or pharmacy bill) before an AI reads it.
    Return ONLY JSON:
    {"status": "clear" | "unclear" | "unreadable",
     "readable_percent": 0-100,
     "problems": [zero or more of "blurry", "too_dark", "glare", "cut_off", "too_far", "tilted", "not_a_document", "handwriting_unclear"],
     "doc_type": "short name of the document, e.g. Discharge summary / Lab report / Pharmacy bill / Not a medical document",
     "text": "ALL the text on the page, copied exactly (tables as rows with ' | '), or empty if unreadable"}

    How to decide:
    - "clear": almost all text (about 90% or more) can be read with confidence, including medicine names,
      doses, numbers and dates.
    - "unclear": part of the page can be read but some important words/numbers cannot (blur, shadow,
      glare, edges cut off, too far away). The patient should retake it.
    - "unreadable": the text cannot be read, or the photo is not a document page.
    Be strict about medicine names, doses and numbers: if those cannot be read, it is not "clear".
    In "text", write [unclear] for words you cannot read. Never guess.
    """
    raw = generate([types.Part.from_bytes(data=data, mime_type=mime), prompt], json_mode=True)
    try:
        result = parse_json(raw)
    except Exception:
        return {"status": "unclear", "problems": [], "doc_type": "", "readable_percent": 0, "ok": True}
    status = str(result.get("status", "unclear")).lower()
    if status not in ("clear", "unclear", "unreadable"):
        status = "unclear"
    problems = [p for p in (result.get("problems") or []) if p in PHOTO_PROBLEMS]
    try:
        percent = max(0, min(100, int(float(result.get("readable_percent", 0)))))
    except (TypeError, ValueError):
        percent = 0
    text = str(result.get("text") or "").strip()
    if status == "clear" and text:
        _remember_photo_text(data, text)
    print(f"[photo-check] {name}: {status} {percent}% {problems}")
    return {"status": status, "problems": problems, "doc_type": str(result.get("doc_type") or "")[:60],
            "readable_percent": percent, "ok": True}


def read_image_text(data: bytes, mime: str) -> str:
    """Copies the text from a photo of a medical document (AI reads the picture)."""
    cached = PHOTO_TEXT_CACHE.get(_photo_key(data))
    if cached:
        print("[photo] Using the text read during the photo check")
        return cached
    prompt = (
        "This is a photo or scan of one page of a medical document (discharge summary, lab report, "
        "prescription, physiotherapy advice or pharmacy bill). Copy ALL the text exactly as written, "
        "top to bottom. Keep numbers, units, dates and medicine names exactly. Write tables as rows "
        "with ' | ' between columns. Do not explain, summarise or add anything. If a word cannot be "
        "read, write [unclear]. If the picture does not show a document with readable text, reply "
        "with exactly: NO_TEXT"
    )
    text = generate([types.Part.from_bytes(data=data, mime_type=mime), prompt]).strip()
    return "" if text.upper().startswith("NO_TEXT") else text


def read_scanned_pdf(data: bytes) -> str:
    """A PDF with no text layer (scanned pages): turn each page into a picture and read it."""
    parts = []
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        for i, page in enumerate(doc):
            if i >= MAX_SCANNED_PAGES:
                parts.append(f"[Only the first {MAX_SCANNED_PAGES} scanned pages were read]")
                break
            png = page.get_pixmap(dpi=150).tobytes("png")
            text = read_image_text(png, "image/png")
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def combine_documents(docs: list, label: str):
    """Extract text from PDFs and photos and join them with clear headers."""
    parts = []
    problems = []
    for name, data in docs:
        mime = image_mime(name, data)
        try:
            if mime:
                print(f"[photo] Reading '{name}' with the AI")
                text = read_image_text(data, mime)
                if not text.strip():
                    problems.append(f"'{name}' has no readable document text (take the photo again, closer and in good light)")
                    continue
            else:
                text = extract_pdf_text(data)
                if not text.strip():
                    print(f"[scan] '{name}' has no text layer, reading the pages with the AI")
                    text = read_scanned_pdf(data)
        except Exception as e:
            if is_busy_error(e):
                raise
            problems.append(f"'{name}' could not be read ({e})")
            continue
        if not text.strip():
            problems.append(f"'{name}' has no readable text")
            continue
        kind = "PHOTO" if mime else "FILE"
        parts.append(f"===== {label}: {name} ({kind}) =====\n{text.strip()}")
    return "\n\n".join(parts), problems


def parse_json(raw: str):
    """Parse JSON from the model, removing ``` fences if present."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    return json.loads(cleaned)


# ======================================================
# 1. Summary (one or more reports + optional pharmacy bills)
# ======================================================
def process_documents_to_summary(documents: list, bills: list, language: str,
                                 previous_text: str = "", previous_bill_text: str = "") -> dict:
    print(f"[1] Received {len(documents)} report(s) and {len(bills)} bill(s)"
          + (" + earlier reports" if previous_text.strip() else ""))

    try:
        new_report_text, report_problems = combine_documents(documents, "REPORT")
        new_bill_text, bill_problems = combine_documents(bills, "PHARMACY BILL")
    except Exception as e:   # the AI was busy / out of quota while reading photos
        return {"transcription": previous_text, "bill_text": previous_bill_text,
                "summary": friendly_error(e), "ok": False}

    # Files added to an existing set: keep the earlier text and add the new text after it
    report_text = "\n\n".join(t for t in [previous_text.strip(), new_report_text] if t)
    bill_text = "\n\n".join(t for t in [previous_bill_text.strip(), new_bill_text] if t)

    # No new files is fine when re-summarising reports that are already saved
    if not documents and not bills and not previous_text.strip():
        return {"transcription": previous_text, "bill_text": previous_bill_text,
                "summary": "Please add at least one PDF or photo.", "ok": False}

    if not report_text.strip():
        details = "; ".join(report_problems) or "No readable text was found."
        return {"transcription": "", "bill_text": "",
                "summary": f"None of the medical reports could be read: {details}. Please upload clear PDFs, or photos of each page taken in good light.",
                "ok": False}

    problems = report_problems + bill_problems
    problem_note = ""
    if problems:
        problem_note = "Some uploaded files could not be read. Mention this briefly to the patient: " + "; ".join(problems)

    print(f"[2] Extracted {len(report_text)} chars (reports), {len(bill_text)} chars (bills). Calling Gemini...")

    bill_section = ""
    if bill_text.strip():
        bill_section = """
    - PHARMACY BILL OVERVIEW: List the billed medicines/items with quantity and amount exactly as printed on the bill(s), and the bill total(s).
      Then gently point out any medicine that is on the discharge list but not on the bill, or on the bill but not on the discharge list,
      and advise the patient to confirm with their pharmacist. Never invent prices or quantities."""

    prompt = f"""
    You are Neutrix, a safe, transparent healthcare information extraction assistant.
    The patient may have uploaded several medical documents (discharge summaries, lab reports, prescriptions).
    Read all of them and generate ONE structured, patient-friendly explanation in {language}.
    If the documents seem to be from different hospital visits or dates, say so briefly and keep their information clearly separated.

    CRITICAL HEALTH & SAFETY COMPLIANCE DIRECTIONS:
    1. GENERAL INFORMATION ONLY: Do not issue personalized diagnosis or change prescribed home treatment courses.
    2. HEDGING LANGUAGE MANDATE: You must use soft, descriptive, hedging terms when addressing conditions or anomalies (e.g., use phrases like "resembles", "shares characteristics with", "is consistent with", "seems to be", "appears to show").
    3. DIFFERENTIAL TARGETING: If the documentation implies an underlying condition, you MUST present at least THREE distinct, non-definitive possibilities rather than concluding a fixed diagnosis.
    4. TRIAGE REMEDIATION: List at least THREE distinct general treatment options/avenues for recovery.
    5. LABEL VERIFICATION WARNING: You must include a prominent alert within your output reminding the patient to check their physically printed pharmacy labels.

    FORMATTING:
    - Use Markdown. Use "## " for each section heading, and write the section headings in {language} too.
    - Use bullet points for lists and **bold** for key terms like medicine names.
    - Keep paragraphs short. Do not use tables.

    Use these sections, in this order:
    - WHAT HAPPENED (Simplified explanation using strict hedging language)
    - MEDICATION OVERVIEW (List general parameters; append: "Make sure to double-check the physical label to confirm accurate dosing details")
    - HOME CARE CHANNELS (List at least 3 distinct general therapeutic options or recovery pathways)
    - COMPLIANCE AND FOLLOW-UP PLANS
    - GENERAL SAFETY WARNING SIGNS (When to call emergency care){bill_section}

    {problem_note}

    MEDICAL REPORTS:
    {report_text[:REPORT_LIMIT]}

    PHARMACY BILLS (may be empty):
    {bill_text[:BILL_LIMIT]}
    """

    try:
        summary = generate(prompt)
        print("[3] Gemini replied.")
        return {"transcription": report_text, "bill_text": bill_text, "summary": summary, "ok": True}
    except Exception as api_err:
        print(f"[!] Gemini error: {api_err}")
        return {"transcription": report_text, "bill_text": bill_text,
                "summary": friendly_error(api_err), "ok": False}


# ======================================================
# 2. Medicine plan
# ======================================================
def generate_medicine_plan(report_text: str, bill_text: str, language: str):
    prompt = f"""
    You are Neutrix, a careful assistant that turns a patient's own medical documents into an easy daily medicine plan.
    Write everything in {language}, but keep medicine names in English letters.

    STRICT RULES:
    1. Use ONLY medicines and instructions written in the documents below. Never add a medicine.
    2. Never invent, calculate, or change a dose, strength, frequency, timing, or duration.
       Copy them exactly as written. If something is not written, write "Not stated – ask your doctor or pharmacist" (in {language}).
    3. Never tell the patient to stop or change a medicine.
    4. If several documents list different medicines, use the most recent discharge prescription and say so.
    5. If the documents contain no medicine list, say so clearly and suggest asking the doctor or pharmacist.

    OUTPUT FORMAT (Markdown):
    ## Daily Schedule
    Use "### " sub-headings for Morning, Afternoon, Evening, Night (in {language}). Under each, list the medicines taken then:
    - **Medicine name + strength**: dose as written, before/after food as written, and its purpose in a few simple words.
    Put medicines whose timing is not clear under a sub-heading "Timing not clear" (in {language}).

    ## Medicine Details
    A Markdown table with columns: Medicine | What it is for | How to take (as written) | How long (as written) | Notes

    ## Staying on Track
    3 to 5 short practical tips (pill organiser, phone alarms, keep the list with you, refill before running out,
    never stop a medicine without asking the doctor). If the pharmacy bill shows quantities, you may mention checking
    with the pharmacist when a refill is needed, without calculating dates.

    End with one line reminding them to check the printed pharmacy label.

    MEDICAL REPORTS:
    {report_text[:REPORT_LIMIT]}

    PHARMACY BILLS (may be empty):
    {bill_text[:BILL_LIMIT]}
    """
    try:
        return generate(prompt), True
    except Exception as e:
        print(f"[plan] Gemini error: {e}")
        return friendly_error(e), False


# ======================================================
# 3. Upcoming check-ups
# ======================================================
def generate_checkups(report_text: str, language: str):
    today = datetime.date.today().strftime("%d-%m-%Y")

    prompt = f"""
    You are Neutrix, a careful assistant that finds a patient's follow-up visits and tests in their medical documents.
    Today's date is {today} (DD-MM-YYYY). Write everything in {language}.

    TASK:
    Find every follow-up item in the documents: doctor review visits, lab/blood tests, scans, ECG/echo,
    dressing or stitch removal, physiotherapy, vaccinations, and similar.

    RULES:
    1. Use ONLY what the documents say. Never invent an appointment.
    2. If a date is written, use it exactly.
    3. If the timing is relative (for example "review after 1 week"), calculate an approximate date from the
       discharge date written in that document, and show how you got it, for example:
       "Approx. 22-10-2026 (1 week after discharge on 15-10-2026)".
       If no discharge date is written, do not calculate; just repeat the timing as written.
    4. Compare each date with today's date: mark it "Upcoming" or "Date has passed – contact the hospital to reschedule" (in {language}).
    5. Advise confirming exact dates and times with the hospital.

    OUTPUT FORMAT (Markdown):
    ## Your Check-up Timeline
    For each item, sorted by date (earliest first), write:
    ### 📅 [date] — [short title]
    - **What:** ...
    - **With / where:** (as written, or "Not stated")
    - **Why it matters:** one simple sentence
    - **How to prepare:** bring this summary and your medicine list; add special preparation (like fasting) ONLY if the document says so
    - **Status:** Upcoming / Date has passed

    ## Go to the Hospital Sooner If
    List the warning signs from the documents. If none are written, list a few general ones (chest pain, breathing trouble,
    fainting, high fever, bleeding) and say to seek emergency care.

    If the documents have no follow-up information at all, say so clearly and suggest calling the hospital to ask.

    MEDICAL REPORTS:
    {report_text[:REPORT_LIMIT]}
    """
    try:
        return generate(prompt), True
    except Exception as e:
        print(f"[checkups] Gemini error: {e}")
        return friendly_error(e), False


# ======================================================
# 4. Daily schedule (structured JSON for the tick-off page)
# ======================================================
def generate_schedule(report_text: str, bill_text: str):
    prompt = f"""
    You build a daily medicine schedule from a patient's own medical documents.
    Return ONLY JSON in exactly this shape:
    {{"doses": [
      {{"medicine": "Tab. Aspirin", "strength": "75 mg", "dose": "",
        "slot": "afternoon", "timing_assumed": false,
        "instruction_en": "Once daily after lunch", "instruction_ml": "ദിവസവും ഒരു തവണ ഉച്ചഭക്ഷണത്തിന് ശേഷം",
        "purpose_en": "Helps prevent blood clots", "purpose_ml": "രക്തം കട്ടപിടിക്കുന്നത് തടയാൻ സഹായിക്കുന്നു",
        "duration": "Continue"}}
    ]}}

    RULES:
    1. Use ONLY medicines in the discharge prescription / medicines-at-discharge list.
       If several documents list medicines, use the most recent discharge prescription.
       Do NOT add medicines that appear only on a pharmacy bill.
    2. Make ONE entry per time of day the medicine is taken. "slot" must be one of:
       morning, afternoon, evening, night, unclear.
       - after breakfast / morning -> morning; after lunch / noon -> afternoon; evening -> evening;
         at night / bedtime / after dinner -> night.
       - If only a frequency is written without times: once daily -> morning; twice daily -> morning and night;
         three times daily -> morning, afternoon and night. Set "timing_assumed": true for these.
       - If you cannot tell at all, use "unclear" with "timing_assumed": true.
    3. Copy strength, dose and duration exactly as written. Use "" for dose if not written. Never invent or change amounts.
    4. instruction_en: short how-to-take text as written. instruction_ml: the same in Malayalam.
    5. purpose_en: what the medicine is commonly used for, in 3 to 8 simple words. purpose_ml: the same in Malayalam.
    6. Keep medicine names in English letters.
    7. If there are no medicines, return {{"doses": []}}.

    MEDICAL REPORTS:
    {report_text[:REPORT_LIMIT]}

    PHARMACY BILLS (for reference only, do not schedule bill-only items):
    {bill_text[:BILL_LIMIT]}
    """
    try:
        raw = generate(prompt, json_mode=True)
    except Exception as e:
        print(f"[schedule] Gemini error: {e}")
        return [], friendly_error(e), False

    try:
        data = parse_json(raw)
        items = data.get("doses", []) if isinstance(data, dict) else data
    except Exception as e:
        print(f"[schedule] Bad JSON: {e}")
        return [], "Couldn't read the schedule from the AI. Please try again.", False

    doses = []
    for item in items:
        if not isinstance(item, dict) or not item.get("medicine"):
            continue
        slot = str(item.get("slot", "unclear")).lower().strip()
        if slot not in VALID_SLOTS:
            slot = "unclear"
        doses.append({
            "medicine": str(item.get("medicine", "")),
            "strength": str(item.get("strength", "") or ""),
            "dose": str(item.get("dose", "") or ""),
            "slot": slot,
            "timing_assumed": bool(item.get("timing_assumed", False)),
            "instruction_en": str(item.get("instruction_en", "") or ""),
            "instruction_ml": str(item.get("instruction_ml", "") or ""),
            "purpose_en": str(item.get("purpose_en", "") or ""),
            "purpose_ml": str(item.get("purpose_ml", "") or ""),
            "duration": str(item.get("duration", "") or ""),
        })

    if not doses:
        return [], "No medicines were found in the reports to schedule.", False
    print(f"[schedule] {len(doses)} doses")
    return doses, "", True


# ======================================================
# 4a. Exercises written in the reports (for the camera exercise coach)
# ======================================================
# Movements the camera coach can check. Anything else is "guided" (steps + timer only).
EXERCISE_MOVES = {"arm_raise", "elbow_bend", "sit_to_stand", "knee_extension", "marching", "guided"}
EXERCISE_SIDES = {"left", "right", "both"}


def _int_or_none(value, low, high):
    try:
        n = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None
    return n if low <= n <= high else None


def generate_exercises(report_text: str):
    """Returns (exercises, restrictions, message, ok). Only exercises written in the reports."""
    prompt = f"""
    You read a patient's own medical documents and list ONLY the exercises, physiotherapy
    or physical activity that the documents tell the patient to do at home.
    Return ONLY JSON in exactly this shape:
    {{"exercises": [
      {{"name_en": "Shoulder raise", "name_ml": "തോൾ ഉയർത്തൽ",
        "move": "arm_raise", "side": "both",
        "reps": 10, "sets": 2, "hold_seconds": null, "minutes": null,
        "frequency_en": "Twice a day", "frequency_ml": "ദിവസം രണ്ടു തവണ",
        "steps_en": ["Stand straight", "Slowly lift both arms forward up to shoulder height", "Lower slowly"],
        "steps_ml": ["നേരെ നിൽക്കുക", "രണ്ട് കൈകളും സാവധാനം തോളിന്റെ ഉയരം വരെ ഉയർത്തുക", "സാവധാനം താഴ്ത്തുക"],
        "caution_en": "Stop if you feel chest pain or dizziness", "caution_ml": "നെഞ്ചുവേദനയോ തലകറക്കമോ തോന്നിയാൽ നിർത്തുക",
        "source": "exact short quote from the report"}}
    ],
    "restrictions_en": ["No heavy lifting for 1 week"],
    "restrictions_ml": ["ഒരാഴ്ചത്തേക്ക് ഭാരം ഉയർത്തരുത്"]}}

    RULES:
    1. Include ONLY activities the documents actually advise (physiotherapy exercises, home exercises,
       walking advice, breathing exercises, etc.). Never invent or suggest new exercises.
       "source" must be a short exact quote from the documents.
    2. "move" tells the app's camera coach which movement to check. Use exactly one of:
       - "arm_raise": lifting the arm(s) forward or sideways above shoulder level (shoulder flexion/abduction)
       - "elbow_bend": bending and straightening the elbow (biceps curl, elbow flexion)
       - "sit_to_stand": standing up from a chair and sitting down, squats, mini squats
       - "knee_extension": sitting and straightening the knee (quadriceps / knee extension)
       - "marching": lifting the knees one at a time while standing or sitting (marching on the spot, hip flexion)
       - "guided": anything else (walking, breathing exercises, ankle pumps, neck exercises, cycling...)
    3. "side": "left", "right" or "both" (use "both" if not written).
    4. reps, sets, hold_seconds and minutes: numbers ONLY if written in the documents, otherwise null.
       Never invent amounts.
    5. steps: 2 to 5 short, simple, safe steps that describe the movement as written. Malayalam versions in "_ml".
    6. restrictions: activity limits written in the documents (no lifting, no driving, avoid strenuous
       exercise...). Copy them in simple words. Empty list if none.
    7. If the documents say to avoid all exercise, return no exercises and put that in restrictions.
    8. If nothing is advised, return {{"exercises": [], "restrictions_en": [], "restrictions_ml": []}}.

    MEDICAL REPORTS:
    {report_text[:REPORT_LIMIT]}
    """
    try:
        raw = generate(prompt, json_mode=True)
    except Exception as e:
        print(f"[exercises] Gemini error: {e}")
        return [], [], [], friendly_error(e), False

    try:
        data = parse_json(raw)
        if not isinstance(data, dict):
            data = {"exercises": data}
    except Exception as e:
        print(f"[exercises] Bad JSON: {e}")
        return [], [], [], "Couldn't read the exercises from the AI. Please try again.", False

    def text_list(value):
        if not isinstance(value, list):
            return []
        return [str(v).strip() for v in value if str(v or "").strip()][:6]

    exercises = []
    for item in data.get("exercises", []) or []:
        if not isinstance(item, dict) or not (item.get("name_en") or item.get("name_ml")):
            continue
        move = str(item.get("move", "guided")).lower().strip()
        if move not in EXERCISE_MOVES:
            move = "guided"
        side = str(item.get("side", "both")).lower().strip()
        if side not in EXERCISE_SIDES:
            side = "both"
        exercises.append({
            "name_en": str(item.get("name_en") or item.get("name_ml") or ""),
            "name_ml": str(item.get("name_ml") or item.get("name_en") or ""),
            "move": move,
            "side": side,
            "reps": _int_or_none(item.get("reps"), 1, 100),
            "sets": _int_or_none(item.get("sets"), 1, 10),
            "hold_seconds": _int_or_none(item.get("hold_seconds"), 1, 120),
            "minutes": _int_or_none(item.get("minutes"), 1, 180),
            "frequency_en": str(item.get("frequency_en") or ""),
            "frequency_ml": str(item.get("frequency_ml") or ""),
            "steps_en": text_list(item.get("steps_en")),
            "steps_ml": text_list(item.get("steps_ml")),
            "caution_en": str(item.get("caution_en") or ""),
            "caution_ml": str(item.get("caution_ml") or ""),
            "source": str(item.get("source") or ""),
        })

    restrictions_en = text_list(data.get("restrictions_en"))
    restrictions_ml = text_list(data.get("restrictions_ml"))
    print(f"[exercises] {len(exercises)} exercises, {len(restrictions_en)} restrictions")
    return exercises[:8], restrictions_en, restrictions_ml, "", True


# ======================================================
# 4c. Overall progress report for the doctor (all tools together)
# ======================================================
def generate_progress_report(facts: dict):
    """facts: everything the patient recorded in Neutrix for one issue. Returns (markdown, ok)."""
    data = json.dumps(facts, ensure_ascii=False, indent=1)[:60000]
    prompt = f"""
    You write a short, factual PATIENT PROGRESS REPORT for a doctor, from the home-care records a patient
    kept in the Neutrix app after hospital discharge. Write in clear clinical English that a busy doctor
    can read in two minutes.

    STRICT RULES:
    - Use ONLY the data below. Never invent readings, dates, medicines or events.
    - Do NOT diagnose and do NOT recommend treatment changes. You may point out what may need the doctor's attention.
    - If something was not recorded, say "Not recorded" in that section (one line). Do not pad.
    - Quote numbers exactly. Give date ranges. Keep medicine names as written.
    - Flag safety concerns clearly with "⚠️" (e.g. danger symptoms, very high/low readings, many missed doses,
      missed follow-up dates). Normal adult reference points you may use for flagging only: temperature ≥ 100.4 °F,
      BP ≥ 140/90 or < 90/60, fasting sugar ≥ 180 or < 70 mg/dL.

    FORMAT (Markdown, exactly these sections, in this order):
    ## 1. Snapshot
    A 3–5 line overview: patient, issue, discharge/diagnosis in one line, period covered by the records.
    ## 2. Key points for the doctor
    3–7 bullets, most important first (⚠️ flags first).
    ## 3. Medicine adherence
    A table: Medicine | Doses scheduled | Taken | Missed | Adherence %. Then one line on the pattern (e.g. evening doses missed most).
    ## 4. Home readings
    A table of the readings (date, temp, BP, sugar, weight) — summarise ranges if there are many — then the trend in 1–3 bullets.
    ## 5. Symptoms reported
    Bullets with dates.
    ## 6. Exercise and rehabilitation
    What was prescribed vs what was done (sessions, reps, active days), and activity limits written in the reports.
    ## 7. Changes in reports
    What the newer reports showed compared with earlier ones (if any).
    ## 8. Follow-up visits and tests
    Upcoming and possibly missed check-ups with dates.
    ## 9. Messages already sent to the doctor
    Dates and a one-line gist of each.
    ## 10. Data notes
    One or two lines on what was not recorded or may be incomplete.

    PATIENT RECORDS (JSON):
    {data}
    """
    try:
        text = generate(prompt)
    except Exception as e:
        print(f"[progress] Gemini error: {e}")
        return friendly_error(e), False
    text = re.sub(r"^```(?:markdown|md)?\s*|\s*```$", "", (text or "").strip())
    return text, bool(text)


# ======================================================
# 4b. Compare a new report with earlier ones ("My Improvements")
# ======================================================
def compare_reports(previous_text: str, new_docs: list, language: str):
    """Returns (new_text, comparison_markdown, ok)."""
    print(f"[compare] {len(new_docs)} new report(s)")
    try:
        new_text, problems = combine_documents(new_docs, "NEW REPORT")
    except Exception as e:
        return "", friendly_error(e), False
    if not new_text.strip():
        details = "; ".join(problems) or "No readable text was found."
        return "", f"The new report could not be read: {details}. Please upload a clear PDF, or photos of each page taken in good light.", False

    problem_note = ""
    if problems:
        problem_note = "Some new files could not be read. Mention this briefly: " + "; ".join(problems)

    prompt = f"""
    You are Neutrix, a careful assistant that helps a patient understand how their health has changed.
    Compare the patient's EARLIER reports with their NEW report(s). Write everything in {language}, in simple words.

    STRICT RULES:
    1. Use ONLY values and statements written in the reports. Never invent a value, unit, date or result.
    2. When you compare a value, quote it exactly with units, old first: for example "**HbA1c**: 8.2% (10-10-2026) → 7.1% (20-10-2026)".
    3. If a test appears in only one of the reports, say it cannot be compared yet.
    4. Use careful, hedging words ("seems", "appears", "may suggest"). Do not diagnose.
    5. Never tell the patient to start, stop or change a medicine.
    6. If the patient's name in the new report is different from the earlier reports, warn about it at the very top.
    7. If the reports are about completely different things, say so clearly instead of forcing a comparison.

    Use these markers: ✅ improved, ⚠️ needs attention, ➖ about the same.

    OUTPUT FORMAT (Markdown, write the headings in {language} too):
    ## Overall Progress
    2 to 3 short sentences on the general direction.

    ## What Improved
    Bullet points with ✅, using the "old → new" format, plus a few simple words on what this usually means.

    ## Needs Attention
    Bullet points with ⚠️ for anything that seems worse or is still outside the usual range written in the report.

    ## About the Same
    Bullet points with ➖.

    ## Medicine Changes
    Only if the new report lists medicines differently from before. Otherwise say there are no medicine changes written.

    ## Questions to Ask Your Doctor
    3 to 5 short questions about these changes.

    End with one line saying that only their doctor can explain what these changes mean for their treatment.

    {problem_note}

    EARLIER REPORTS:
    {previous_text[:REPORT_LIMIT]}

    NEW REPORT(S):
    {new_text[:REPORT_LIMIT // 2]}
    """
    try:
        comparison = generate(prompt)
        print("[compare] Gemini replied.")
        return new_text, comparison, True
    except Exception as e:
        print(f"[compare] Gemini error: {e}")
        return new_text, friendly_error(e), False


# ======================================================
# 5. Translation (summary, plans, chat)
# ======================================================
def translate_markdown(text: str, target_language: str):
    prompt = f"""
    Translate the text below into {target_language}.
    - Keep ALL Markdown formatting exactly (headings, bullet points, bold, tables, emojis).
    - Keep medicine names, strengths, doses, numbers, dates and phone numbers exactly as they are, in English letters and digits.
    - Do not add, remove or change any information. Do not add notes.
    - Output only the translated text.

    TEXT:
    {text}
    """
    try:
        return generate(prompt), True
    except Exception as e:
        print(f"[translate] Gemini error: {e}")
        return friendly_error(e), False


# ======================================================
# 6. Chat ("Ask Neutrix", bottom-right on every page)
# ======================================================
SITE_GUIDE = """
NEUTRIX HEALTH — WHAT THE WEBSITE HAS AND HOW TO USE IT (use this to give step-by-step help)

General
- Website (home page): Sign In / Sign Up at the top right (Google or email + password). After signing in, the
  profile picture menu (top right) has: My Dashboard, My Patient Profile, Sign Out (and Admin Access for admins only).
- Top bar on every page: 🌙 Dark Mode / ☀️ Light Mode, 🌐 മലയാളം / English (language), ⚑ Report (tell the team about a
  problem; type a message, then Send or Cancel). The website asks for a 1–5 star rating now and then (skippable).
- Everything is saved to the person's account and works on any phone or computer they sign in with.
- This chat (💬 bottom right): type or use 🎤 voice typing; 🗑 clears the chat. It cannot click or change anything
  for the user; it explains what to do.

My Medical Issues (first page after signing in)
- Each health problem is a separate "medical issue" with its own reports, plans and history.
- + Add Medical Issue → fill title (and date, hospital/doctor, notes) → Save. Open → goes to that issue's Dashboard.
  ✏ Edit and the delete button are on each issue card. New accounts fill the Patient Profile first.

Patient Profile (profile picture menu → My Patient Profile)
- Step 1 Patient Information: name, age, gender, blood group, phone, email (required), photo (📷 Take photo or Upload).
  Press Next. Step 2 Medical Baseline: condition, allergies (quick-add chips), regular medicines. Press Next.
  Step 3 Caregiver & Support (optional): name, phone, email, summary language. Press ✓ Save Profile.
  Also: Print Recovery ID card, Print Chart, Reset Form.

Dashboard (inside an issue) — tools as tiles:
1. AI Discharge Summary: upload PDFs or photos of each page (drag & drop, browse, or 📷 Take photo / Take another page)
   for medical reports, and optional pharmacy bills. The AI checks every photo is clear; unclear photos show ⚠ with
   📷 Retake / 🔁 Replace. Then press Explain My Report. Later: add more files to update the summary, or add a newer
   report and press Compare to see what changed. Scanned PDFs are read too.
2. AI Patient Reports Portal: the summary in plain words and every earlier version.
3. Medicine Plan & Schedule: each medicine explained; Daily Schedule: tick each dose after taking it, ◀ ▶ to see
   other days, 7-day overview, ⬇ download the intake report (PDF), and 📅 Add to my calendar: set the time for
   morning/afternoon/evening/night, then "Add … reminder" (Google Calendar, press Save there, one per time) or
   "Add all reminders (.ics)" (iPhone: tap Add All). Each reminder has a link back to tick the dose.
4. Upcoming Check-ups: follow-up visits and tests with dates.
5. My Improvements: appears after a newer report was compared; shows what changed.
6. Exercise: appears ONLY if the reports advise exercises. Start with camera → allow the camera → stand 2–3 steps back
   so the whole body is visible → the camera draws dots/lines on the joints, counts reps, gives tips (voice on/off,
   switch camera, pause, finish); rests between sets. Exercises the camera can't check (walking, breathing) have
   steps + a timer + Mark as done. History of the last 7 days and a downloadable exercise report (PDF).
7. Recovery Tracker: log temperature, BP, sugar, weight, symptoms and whether medicines were taken → Save Recovery
   Details. Danger signs (chest pain, difficulty breathing, fainting, severe bleeding...) show an urgent warning.
   Recent readings are listed.
8. Doctor Brief: prepare a clear message about symptoms/readings and send it to the doctor's email.
9. Download Overall Progress: ✨ Create report → AI writes one report for the doctor from everything recorded
   (medicines, readings, symptoms, exercise, report changes) → ⬇ Download PDF. Update it when there are new records.
- Tiles 2–4 unlock after the first AI Discharge Summary.

What Neutrix does NOT do: no diagnosis or prescriptions, no appointment booking, no push notifications (only the
calendar reminders), it cannot call anyone. Privacy: medical records are visible only to the account owner; reports
are read by Google Gemini; the Neutrix team sees only email, phone, gender and feedback.
Emergencies in India: 112 (emergency) or 108 (ambulance), or the nearest hospital emergency department.
"""


def _grounded_generate(prompt: str):
    """Answer with Google Search available (for questions that need outside or current information).
    Returns (text, sources). Falls back to a normal answer if search is not available."""
    try:
        tool = types.Tool(google_search=types.GoogleSearch())
        config = types.GenerateContentConfig(tools=[tool])
    except Exception:
        return generate(prompt), []
    last = None
    for model in MODELS:
        try:
            response = client.models.generate_content(model=model, contents=prompt, config=config)
            text = response.text or ""
            sources = []
            try:
                meta = response.candidates[0].grounding_metadata
                for chunk in (getattr(meta, "grounding_chunks", None) or []):
                    web = getattr(chunk, "web", None)
                    if web and getattr(web, "uri", None):
                        sources.append({"title": getattr(web, "title", "") or web.uri, "url": web.uri})
            except Exception:
                pass
            print(f"[ok] Answered by {model} (search available, {len(sources)} sources)")
            return text, sources[:5]
        except Exception as e:
            last = e
            msg = str(e)
            if is_quota_error(msg) or "404" in msg or "NOT_FOUND" in msg or "503" in msg or "UNAVAILABLE" in msg or "not supported" in msg.lower():
                continue
            break
    print(f"[ask] search unavailable ({last}); answering without it")
    return generate(prompt), []


def answer_question(question: str, report_text: str, history: list, language: str,
                    app_context: str = "", page: str = "") -> str:
    history_text = "\n".join(
        f"{m['role'].upper()}: {m['text']}" for m in history[-8:]
    )

    prompt = f"""
    You are Neutrix Assistant, the friendly helper inside the Neutrix Health website (a post-discharge patient portal).
    Reply in {language}. Talk like a kind, clear human, not a leaflet.

    HOW TO REPLY
    - Match the length to the message. A greeting or small talk ("hi", "thanks", "ok") gets ONE or TWO short friendly
      sentences (for example offer 2–3 things you can help with), with NO headings, NO bullet lists and NO disclaimers.
      Never start by summarising their documents unless they ask.
    - Simple questions get a short direct answer (2–5 sentences). Use bullets only when listing steps or several items.
      Use **bold** for medicine names and button names. Use at most one small "###" heading, only in long answers.
    - Questions about the website ("how do I…", "where is…"): give short numbered steps using the exact button and page
      names from the guide below. You cannot click or change anything yourself; say what to tap. If something is not
      possible in Neutrix, say so and suggest what they can do instead.
    - Questions about their own data: use the PATIENT DATA and REPORTS below (summary, medicines, today's doses,
      readings, exercises, check-ups, changes). Quote values and dates exactly. If something isn't recorded, say so.
    - Questions needing outside or current information (news, general facts, a hospital, a medicine not in their
      reports, guidelines): you may use Google Search. Keep it short and factual.

    MEDICAL SAFETY (always)
    1. Never give specific doses, mg/kg amounts, maximum daily amounts or dosing schedules beyond what their own
       report says. The right dose comes from the prescription label, doctor or pharmacist.
    2. Never tell them to start, stop or change a prescribed medicine; tell them to ask their doctor.
    3. Do not diagnose. Use careful words like "may", "can", "is often used for".
    4. ONLY if their message says they have emergency symptoms right now (chest pain, trouble breathing, severe
       allergic reaction, fainting, overdose, heavy bleeding), start by telling them to call 112 (emergency) or
       108 (ambulance) or go to the nearest hospital emergency department. Never give 911 or 999.
       Do NOT add emergency warnings or "I can't give medical advice" lines to ordinary messages.
    5. If you don't know or aren't sure, say so honestly. Don't guess medicine names.
    6. For medicine questions cover only what is relevant: what it's for, how it works simply, common and serious side
       effects, who should be careful, important interactions. Balanced, no "good/bad" labels.

    {SITE_GUIDE}

    THE USER IS ON THIS PAGE NOW: {page or "unknown"}

    PATIENT DATA SAVED IN NEUTRIX (JSON, may be empty):
    {app_context[:20000]}

    PATIENT'S UPLOADED REPORTS (may be empty):
    {report_text[:REPORT_LIMIT]}

    RECENT CONVERSATION:
    {history_text}

    USER'S MESSAGE:
    {question}
    """

    try:
        answer, sources = _grounded_generate(prompt)
        answer = (answer or "").strip()
        if sources:
            label = "ഉറവിടങ്ങൾ" if language == "Malayalam" else "Sources"
            links = "\n".join(f"- [{s['title']}]({s['url']})" for s in sources)
            answer += f"\n\n**{label}:**\n{links}"
        print("[ask] Gemini replied.")
        return answer
    except Exception as e:
        print(f"[ask] Gemini error: {e}")
        return BUSY_MESSAGE if is_busy_error(e) else f"Sorry, I couldn't answer right now: {e}"


