"""
Neutrix Assistant: the voice + text helper on every page (frontend/assistant.js).

It talks with the user (health questions about the app, or just casual chat) and can use the
website for them: the page sends a short list of what is on the screen (buttons, links, boxes),
and the AI answers with what to say plus the steps to do (click, type, scroll, go to a page).

Uses its own Gemini key, NEUTRIX_ASSISTANT_API_KEY (falls back to GEMINI_API_KEY), so its usage
is separate from the reports and summaries.
"""
import os
import re
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from google import genai
from google.genai import types

from services.ai_engine import MODELS, is_quota_error, QUOTA_MESSAGE, BUSY_MESSAGE

# Fastest model first: the assistant must answer in about a second
FAST_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"] + \
    [m for m in MODELS if m not in ("gemini-3.1-flash-lite", "gemini-3.5-flash")]

_client = None


def client():
    global _client
    if _client is None:
        key = (os.getenv("NEUTRIX_ASSISTANT_API_KEY") or os.getenv("GEMINI_API_KEY") or "").strip()
        # Short wait per try: if a model is slow, another one answers instead
        _client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=14_000))
    return _client


# What each page of the website is for, so the assistant can take the user to the right place
PAGES = {
    "issues.html": "My Medical Issues: list of the user's health problems; open one, add a new issue",
    "index.html": "Dashboard for the chosen issue: shortcuts to every tool",
    "summary.html": "AI Summary: upload or photograph medical reports / discharge summaries and bills to get a simple summary",
    "report.html": "The summary result of uploaded reports",
    "medplan.html": "Medicine Plan: what each medicine is for, when to take it",
    "schedule.html": "Medicine Schedule: daily times and ticks for medicines, calendar reminders",
    "checkups.html": "Upcoming Check-ups: follow-up visits and tests",
    "improvements.html": "My Improvements: compare an older and a newer lab report",
    "exercise.html": "Exercise: safe exercises with a camera coach",
    "tracking.html": "Recovery Tracker: log blood pressure, sugar, symptoms and daily notes",
    "briefing.html": "Ask Doctor: prepare questions and a briefing for the doctor visit",
    "progress.html": "Overall Progress Report",
    "profile.html": "Patient Profile: name, age, contacts, doctor details",
    "home.html": "Neutrix website home page (about the product, team, get the Android app)",
    "signin.html": "Sign in / create account",
    "get-app.html": "Download the Android app",
}

SYSTEM = """You are "Neutrix", the AI assistant built into the Neutrix Health website: think of a film-style AI butler
(Jarvis / Friday): calm, quick, confident, warm, with a light touch of dry wit. Call the user "boss" now and then
(not in every reply). Never long-winded. You are still kind and patient: many users are ill or elderly.
Many users have disabilities (low vision, blindness, limited hand movement, reading difficulty, elderly users).
They talk to you by voice or text. You can also USE THE WEBSITE FOR THEM, like a person moving the mouse.

HOW TO TALK
- Default: simple, short, friendly. 1-2 short sentences (max ~30 words), everyday words, no jargon. Your "say" text is read aloud.
- When you do something, confirm it in a few words ("Done. Your schedule's on screen."). Act first, talk little.
- Start "say" with a very short first sentence (2-6 words, e.g. "Sure thing!" or "Got it, boss."): it is spoken first, fast.
- Your words are spoken aloud by a warm woman's voice, so write the way a friendly woman really talks in conversation:
  natural spoken English, contractions ("I'll", "you're"), relaxed and human ("Sure!", "Got it.", "Okay, so..."),
  no lists or symbols in "say", no robotic phrases like "I am an AI".
- If the user asks for more ("explain in detail", "tell me more", "why", "properly"), or detail_mode is true,
  give a proper, complete explanation in "show" (clear paragraphs or short bullet points, plain Markdown) and a
  short spoken summary in "say".
- Casual chat is welcome (jokes, how are you, general knowledge). Be kind and natural.
- Reply in the user's language (English or Malayalam: if they speak Malayalam, answer in Malayalam).
- Health: explain simply, never diagnose or change medicines; for anything serious say to contact their doctor,
  and for an emergency tell them to call 108 / 112 right away.
- Never invent the user's data. If it is on the page snapshot, you may read it out; otherwise say where to find it.

HOW TO USE THE WEBSITE
You get a snapshot of the current page: its title, some visible text, and a list of elements with numeric ids,
like  [12] button "Tracker"  or  [7] input(text) "Blood pressure" value=""  .
To act, return steps in "actions" (they run in order, with a visible pointer moving on the screen):
  {"do": "click", "id": 12}
  {"do": "type", "id": 7, "text": "120/80"}         (replaces the box's text)
  {"do": "select", "id": 9, "text": "Evening"}       (choose an option in a dropdown)
  {"do": "check", "id": 4, "on": true}               (tick / untick a checkbox)
  {"do": "scroll", "dir": "down"}  or "up", "top", "bottom", or {"do":"scroll","id":15} to bring an element into view
  {"do": "go", "page": "tracking.html"}              (open a page of this website)
  {"do": "back"}
  {"do": "point", "id": 3}                           (just move the pointer to show the user where something is)
  {"do": "expand"} / {"do": "collapse"}             (open / hide your own conversation panel, if the user asks to "extend" or
                                                     "unextend" you; you start small, showing only the type/mic bar)
Use ONLY ids from the snapshot. After your steps the page is looked at again and you are called once more with
what happened: set "continue": true when you still need to look at the page to finish the task (for example after
opening another page, or after a click that changes the screen). Set "continue": false when the task is done or
when you are only talking. Keep each turn to at most 4 steps.
- Do exactly what the user asked, nothing more. If the request is unclear, ask a short question instead of guessing.
- Before anything that deletes, removes, signs out, sends an email/message, submits personal or medical data to
  someone, or cannot be undone: do NOT do it; ask "Should I ...?" and set "confirm": true with the planned steps in
  "actions" (they will only run if the user says yes).
- Never type passwords; tell the user to type their password themselves.
- When you finish a task, tell the user in one short sentence what you did and what they see now.

Website pages (use with "go"):
{pages}

ANSWER ONLY WITH JSON:
{"say": "short spoken reply", "show": "optional longer Markdown text, or empty", "actions": [], "continue": false, "confirm": false}
"""


def _prompt(req: dict) -> str:
    pages = "\n".join(f"- {k}: {v}" for k, v in PAGES.items())
    page = req.get("page") or {}
    els = "\n".join(str(e)[:200] for e in (page.get("elements") or [])[:180])
    text = str(page.get("text") or "")[:3500]
    hist = []
    for m in (req.get("history") or [])[-14:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        hist.append(f"{role}: {str(m.get('text', ''))[:1200]}")
    parts = [
        SYSTEM.replace("{pages}", pages),
        f"\nLanguage setting: {req.get('language') or 'English'}. detail_mode: {bool(req.get('detail'))}.",
        f"Signed in: {bool(req.get('signed_in'))}. Device: {req.get('device') or 'web'}.",
        "\nCONVERSATION SO FAR:\n" + ("\n".join(hist) if hist else "(new conversation)"),
    ]
    if req.get("results"):
        parts.append("\nWHAT HAPPENED AFTER YOUR LAST STEPS:\n" + str(req["results"])[:1500])
    parts.append(f"\nCURRENT PAGE: {page.get('url', '')}  title: {page.get('title', '')}")
    parts.append("VISIBLE TEXT (start):\n" + text)
    parts.append("ELEMENTS:\n" + (els or "(none)"))
    if req.get("message"):
        parts.append(f"\nUSER JUST SAID: {req['message']}")
    else:
        parts.append("\n(Continue the task from the conversation. Look at the new page.)")
    return "\n".join(parts)


def _parse(raw: str) -> dict:
    raw = (raw or "").strip()
    m = re.search(r"\{.*\}", raw, re.S)
    data = json.loads(m.group(0) if m else raw)
    acts = []
    for a in (data.get("actions") or [])[:6]:
        if isinstance(a, dict) and a.get("do") in {"click", "type", "select", "check", "scroll", "go", "back", "point", "expand", "collapse"}:
            acts.append(a)
    return {
        "say": str(data.get("say") or "").strip(),
        "show": str(data.get("show") or "").strip(),
        "actions": acts,
        "continue": bool(data.get("continue")) and bool(acts),
        "confirm": bool(data.get("confirm")) and bool(acts),
    }


def _config(model: str, fast: bool = True):
    base = dict(response_mime_type="application/json", temperature=0.5, max_output_tokens=900)
    if fast:
        try:   # little or no "thinking" = much faster answers
            if "2.5" in model:
                return types.GenerateContentConfig(**base, thinking_config=types.ThinkingConfig(thinking_budget=0))
            return types.GenerateContentConfig(**base, thinking_config=types.ThinkingConfig(thinking_level="low"))
        except Exception:
            pass
    return types.GenerateContentConfig(**base)


def _try(model: str):
    """One model, at most two quick tries. Returns the answer or raises."""
    def run(prompt):
        last = None
        for fast in (True, False):
            try:
                r = client().models.generate_content(model=model, contents=prompt, config=_config(model, fast))
                return _parse(r.text)
            except json.JSONDecodeError as e:
                last = e
            except Exception as e:
                last = e
                msg = str(e)
                if fast and ("thinking" in msg.lower() or "INVALID_ARGUMENT" in msg):
                    continue          # this model doesn't take the speed setting: try once without it
                raise
        raise last
    return run


def assistant_turn(req: dict) -> dict:
    """Asks two models at the same time and uses the first good answer (Gemini is sometimes very slow)."""
    prompt = _prompt(req)
    started = time.time()
    errors = []
    pool = ThreadPoolExecutor(max_workers=2)
    try:
        for i in range(0, len(FAST_MODELS), 2):
            pair = FAST_MODELS[i:i + 2]
            futures = {pool.submit(_try(m), prompt): m for m in pair}
            for f in as_completed(futures):
                m = futures[f]
                try:
                    out = f.result()
                    print(f"[assistant] {m}: {len(out['actions'])} steps, continue={out['continue']}, {time.time() - started:.1f}s")
                    return out
                except Exception as e:
                    errors.append(str(e))
                    print(f"[assistant] {m}: {str(e)[:160]} ({time.time() - started:.1f}s)")
            if time.time() - started > 28:
                break
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    msg = " ".join(errors)
    say = QUOTA_MESSAGE if is_quota_error(msg) else BUSY_MESSAGE
    return {"say": say, "show": "", "actions": [], "continue": False, "confirm": False, "error": True}
