"""
3D body view: which parts of the body the patient's report is about.

Reads the report summary once and returns the affected areas (from a fixed list the 3D model knows),
each with a short, simple explanation: what happened there, what may have caused it, and what the report
says to do. The page saves the answer on the device, so this runs only when the report changes.
"""
import json
import os
import re

from google import genai
from google.genai import types

from services.ai_engine import MODELS

AREAS = {
    "brain": "brain, stroke, seizures, headaches, nerves of the head",
    "eyes": "eyes, vision, retina",
    "thyroid": "thyroid gland in the neck",
    "heart": "heart, coronary arteries, heart attack, angina, stent, valves, heart rhythm",
    "lungs": "lungs, breathing, asthma, COPD, pneumonia",
    "liver": "liver, fatty liver, hepatitis, gall bladder",
    "stomach": "stomach, acidity, ulcers, gastritis",
    "pancreas": "pancreas, insulin, diabetes / blood sugar",
    "kidneys": "kidneys, kidney function, creatinine, stones",
    "intestines": "intestines, bowel, colon, appendix",
    "bladder": "bladder, urinary tract",
    "reproductive": "uterus, ovaries, prostate, reproductive organs",
    "spine": "spine, back, discs, spinal cord",
    "blood_vessels": "arteries and veins all over the body, blood pressure / hypertension, cholesterol, circulation",
    "bones_joints": "bones, joints, knees, hips, fractures, arthritis",
    "skin": "skin, wounds, surgical scars",
}

PROMPT = """You are helping draw a 3D human body for a patient. Read the medical report summary below and list
the parts of the body it is about (problems, diseases, procedures, risk areas). Use ONLY these area keys:
{areas}

For each area give simple, kind, plain-language text (a 12-year-old should understand, no jargon; explain any
medical word in brackets), based ONLY on the report — never invent anything:
- "label": short name of the problem (e.g. "Blocked heart artery")
- "severity": "high" (the main problem), "medium", or "low" (a risk or minor finding)
- "what_happened": 1-2 sentences: what happened in this part of the body
- "cause": 1 sentence: what may have caused it, as the report says or suggests ("The report doesn't say" if unknown)
- "treatment": 1-2 sentences: what was done and what the report recommends (medicines, tests, lifestyle)
Order from most to least important. At most 6 areas. Language of the text: {language}.
The patient is {sex}: only name organs this patient has (no prostate for a woman, no uterus or ovaries for a man).
Also give "overview": one short sentence summing up.

REPORT:
{report}

Answer ONLY with JSON: {{"overview": "...", "areas": [{{"key": "heart", "label": "...", "severity": "high",
"what_happened": "...", "cause": "...", "treatment": "..."}}]}}"""


def _keys():
    keys = []
    for name in ("GEMINI_API_KEY", "NEUTRIX_ASSISTANT_API_KEY"):
        k = (os.getenv(name) or "").strip()
        if k and k not in keys:
            keys.append(k)
    return keys


def body_map(report: str, language: str = "English", sex: str = "neutral") -> dict:
    report = (report or "").strip()[:12000]
    if not report:
        return {"overview": "", "areas": []}
    prompt = PROMPT.format(areas="\n".join(f"- {k}: {v}" for k, v in AREAS.items()), language=language, report=report,
                           sex={'female': 'a woman', 'male': 'a man'}.get((sex or '').lower(), 'of unknown gender'))
    config = types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2, max_output_tokens=2500)
    last = None
    for key in _keys():
        client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=40_000))
        for model in ["gemini-3.1-flash-lite"] + [m for m in MODELS if m != "gemini-3.1-flash-lite"]:
            try:
                r = client.models.generate_content(model=model, contents=prompt, config=config)
                raw = (r.text or "").strip()
                m = re.search(r"\{.*\}", raw, re.S)
                data = json.loads(m.group(0) if m else raw)
                areas = []
                for a in (data.get("areas") or [])[:6]:
                    if isinstance(a, dict) and a.get("key") in AREAS:
                        areas.append({k: str(a.get(k) or "").strip() for k in ("key", "label", "severity", "what_happened", "cause", "treatment")})
                print(f"[body-map] {model}: {[a['key'] for a in areas]}")
                return {"overview": str(data.get("overview") or "").strip(), "areas": areas}
            except Exception as e:
                last = e
                msg = str(e)
                print(f"[body-map] {model}: {msg[:150]}")
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                    break                      # this key is out of quota: try the next key
                continue
    raise RuntimeError(str(last))
