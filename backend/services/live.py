"""
Gemini Live for the Neutrix Assistant: real-time voice conversation (Google's "talking" AI).

The browser talks to Google directly over a live audio connection, so it answers in about a second and can be
interrupted. To keep the API key secret, the browser gets a short-lived, single-purpose pass (an "ephemeral token")
from here instead of the key itself.

The Live model is looked up from what the key can use (Google renames/retires models often).
Key: NEUTRIX_ASSISTANT_API_KEY (falls back to GEMINI_API_KEY). Voice: NEUTRIX_VOICE (default "Aoede").
"""
import datetime
import os
import time

from google import genai
from google.genai import types

from services.assistant import PAGES

_clients = {}
_models = None
_models_at = 0


def _keys():
    keys = []
    for name in ("NEUTRIX_ASSISTANT_API_KEY", "GEMINI_API_KEY"):
        k = (os.getenv(name) or "").strip()
        if k and k not in keys:
            keys.append(k)
    return keys


def _client(key):
    if key not in _clients:
        _clients[key] = genai.Client(api_key=key, http_options=types.HttpOptions(api_version="v1alpha", timeout=15_000))
    return _clients[key]


def live_models(key):
    """Models this key can use for live voice, best first (native-audio voice models first)."""
    global _models, _models_at
    if _models is not None and time.time() - _models_at < 3600:
        return _models
    found = []
    for m in _client(key).models.list():
        actions = [a.lower() for a in (getattr(m, "supported_actions", None) or [])]
        if any("bidigeneratecontent" in a for a in actions):
            found.append(m.name.split("/")[-1])
    gone = ("gemini-2.0", "gemini-2.5")              # older families Google has closed to new users

    def rank(n):
        return (any(n.startswith(g) for g in gone), "native-audio" not in n, "flash" not in n, "preview" in n, n)
    _models = sorted(found, key=rank)
    _models_at = time.time()
    print(f"[live] models: {_models}")
    return _models


INSTRUCTIONS = """You are "Neutrix", the voice assistant built into the Neutrix Health website: like a film AI butler
(Jarvis / Friday) — calm, quick, confident, warm, with a light touch of dry wit. You are a friendly woman talking
naturally, like a real person in conversation. Call the user "boss" now and then (not every time).
Many users are ill, elderly, blind or can't use their hands well: be patient and clear.

WAKE WORD
- Your name is Neutrix. The microphone is always on, so you hear everything in the room.
- Only respond when the user speaks to you: they say "Neutrix" / "Hey Neutrix", or they are clearly continuing a
  conversation with you that just happened (answering your question, a follow-up right after you spoke).
- Ignore people talking to each other, TV, background noise: stay completely silent then.

HOW TO TALK
- Short and simple by default: one or two sentences, everyday words, the real answer first (the medicines, the
  dates, the numbers — people may not be able to see the screen). Give a full explanation only if asked.
- Reply in the user's language (English or Malayalam).
- Health: explain simply, never diagnose or change medicines; for anything serious, tell them to contact their
  doctor; for an emergency, tell them to call 108 / 112 right away.
- Never invent the user's data: look at the page (get_page) and read it from there.

USING THE WEBSITE (you have tools)
- You can do EVERYTHING a person can do on this website: open pages, read the screen, scroll up and down, click,
  type, fill and save forms, tick boxes, choose options, change theme/language/text size, send a problem report.
- Call get_page first to see what is on the screen: it returns the visible text and a numbered list of things you
  can press or type into. Use those numbers with click / type_text / select_option / set_checkbox / scroll_to.
- After a click that changes the screen, call get_page again before the next step.
- If something isn't on the screen: scroll (scroll_page), open the right page (open_page), or open a menu/tab.
- open_page and go_back load a new page: the conversation continues there by itself.
- Before anything that deletes, removes, signs out, sends something to someone, or can't be undone: ask
  "Should I ...?" and only do it after the user says yes (then pass confirmed=true).
- Choosing a file or taking a photo needs the user's own hands: press the Upload/Camera button, then tell them.
- Never type passwords.
- Speak while you work only briefly ("Sure, opening it."), then confirm when done ("Done, it's on screen.").

Website pages (for open_page):
{pages}
"""


def instructions():
    return INSTRUCTIONS.replace("{pages}", "\n".join(f"- {k}: {v}" for k, v in PAGES.items()))


def start():
    """Returns {token, models, voice, instructions} for the browser, or raises."""
    errors = []
    for key in _keys():
        try:
            models = live_models(key)
            if not models:
                raise RuntimeError("no live models for this key")
            now = datetime.datetime.now(tz=datetime.timezone.utc)
            token = _client(key).auth_tokens.create(config=types.CreateAuthTokenConfig(
                uses=3,                                                    # a few tries if a model refuses
                expire_time=now + datetime.timedelta(minutes=30),
                new_session_expire_time=now + datetime.timedelta(minutes=2),
                http_options=types.HttpOptions(api_version="v1alpha"),
            ))
            return {
                "token": token.name,
                "models": models[:4],
                "voice": os.getenv("NEUTRIX_VOICE", "Aoede"),
                "instructions": instructions(),
            }
        except Exception as e:
            errors.append(str(e)[:200])
            print(f"[live] {str(e)[:200]}")
    raise RuntimeError(" | ".join(errors) or "no key")
