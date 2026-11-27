"""
Medicine photo check: the patient photographs a tablet strip, box or bottle, and we compare the label with the
medicines in their schedule. The AI only READS the printed label and compares it with the list. It never
identifies loose pills by their look, and never says a medicine is safe to take.
"""
import re

from google.genai import types

from services.ai_engine import generate, parse_json

PROMPT = """You are checking a photo of a medicine package (tablet strip, box, bottle or label) for a patient.

1. Read the printed text on the package: brand name, generic (salt) name and strength. Copy it EXACTLY.
   If you cannot read a label clearly, say so. Never guess from the colour or shape of a pill.
2. Compare it with the patient's medicine list below. A match means the same medicine (brand or generic name)
   from the list. Say whether the strength printed matches the strength in the list.
3. If there is no printed label (for example loose pills), set "readable" to false.

PATIENT'S MEDICINE LIST:
{meds}

Answer ONLY with JSON:
{{"readable": true, "label_text": "exact text read: brand, generic, strength", "generic": "generic name read, or ''",
  "strength": "strength read, or ''", "match": "the medicine from the list exactly as written there, or ''",
  "same_strength": true, "expiry": "expiry date if printed, else ''"}}"""


def pill_check(image: bytes, mime: str, meds: list) -> dict:
    meds_text = "\n".join(f"- {str(m)[:80]}" for m in (meds or [])[:40]) or "- (no medicines saved)"
    raw = generate([types.Part.from_bytes(data=image, mime_type=mime), PROMPT.format(meds=meds_text)], json_mode=True)
    d = parse_json(raw) if raw else {}
    out = {
        "readable": bool(d.get("readable")),
        "label_text": str(d.get("label_text") or "")[:200],
        "generic": str(d.get("generic") or "")[:80],
        "strength": str(d.get("strength") or "")[:40],
        "match": str(d.get("match") or "")[:120],
        "same_strength": d.get("same_strength") if isinstance(d.get("same_strength"), bool) else None,
        "expiry": str(d.get("expiry") or "")[:30],
    }
    # the match must really be one of the patient's medicines (never something the AI made up)
    names = [str(m) for m in (meds or [])]
    if out["match"] and not any(out["match"].lower() in n.lower() or n.lower() in out["match"].lower() for n in names):
        out["match"] = ""
        out["same_strength"] = None
    if not out["readable"]:
        out["match"] = ""
    return out
