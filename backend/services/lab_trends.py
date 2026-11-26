"""
Lab value trends for "My Improvements": every numeric test result in the patient's reports, with its date,
so the page can show how each value changed from report to report (e.g. HbA1c 9.2 -> 8.1 -> 7.4).

The AI only COPIES numbers that are written in the reports. It never calculates, guesses or adds values.
The page saves the answer on the device, so this runs only when the reports change.
"""
import json
import re

from google import genai
from google.genai import types

from services.ai_engine import MODELS
from services.body_map import _keys

PROMPT = """Read the medical reports below and list the NUMERIC lab test and measurement results written in them
(blood tests like HbA1c, glucose, cholesterol, LDL, HDL, triglycerides, creatinine, eGFR, urea, haemoglobin,
platelets, WBC, sodium, potassium, TSH, troponin, liver enzymes; and measurements like blood pressure, pulse,
weight, BMI, ejection fraction).

STRICT RULES:
- Copy every number EXACTLY as written. Never calculate, convert, round, estimate or invent a value.
- Only results that are numbers. Skip results written only in words ("normal", "positive").
- Each result gets the date the test was done, as written in the report (YYYY-MM-DD). If no date is written,
  use "" and set "doc" to the report it came from (1 = first report, 2 = next, ...), in the order they appear.
- Blood pressure: one test named "Blood pressure" with value "130/85" (keep it as text) and unit "mmHg".
- Use one consistent, common English name per test across all reports (e.g. "HbA1c", "LDL cholesterol").
- "normal": the normal/reference range if the report writes it, else "".
- "better": "lower" if lower values are generally better for this test (HbA1c, LDL, glucose, creatinine,
  blood pressure, triglycerides), "higher" if higher is better (HDL, eGFR, haemoglobin, ejection fraction),
  or "" if it depends.
- At most 25 tests, the most important first. If there are none, return {{"tests": []}}.

REPORTS:
{report}

Answer ONLY with JSON:
{{"tests": [{{"name": "HbA1c", "unit": "%", "normal": "4.0-5.6", "better": "lower",
  "points": [{{"date": "2026-10-12", "doc": 1, "value": "8.1"}}]}}]}}"""


def lab_trends(report: str) -> dict:
    report = (report or "").strip()[:30000]
    if not report:
        return {"tests": []}
    config = types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1, max_output_tokens=6000)
    last = None
    for key in _keys():
        client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=60_000))
        for model in ["gemini-3.1-flash-lite"] + [m for m in MODELS if m != "gemini-3.1-flash-lite"]:
            try:
                r = client.models.generate_content(model=model, contents=PROMPT.format(report=report), config=config)
                raw = (r.text or "").strip()
                m = re.search(r"\{.*\}", raw, re.S)
                data = json.loads(m.group(0) if m else raw)
                tests = []
                for t in (data.get("tests") or [])[:25]:
                    if not isinstance(t, dict) or not str(t.get("name") or "").strip():
                        continue
                    points = []
                    for p in (t.get("points") or [])[:30]:
                        if not isinstance(p, dict):
                            continue
                        value = str(p.get("value") or "").strip()[:20]
                        # keep only values that really are numbers (or "130/85" for blood pressure)
                        if not re.match(r"^-?\d+(\.\d+)?(/\d+(\.\d+)?)?$", value):
                            continue
                        date = str(p.get("date") or "").strip()
                        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                            date = ""
                        try:
                            doc = int(p.get("doc") or 0)
                        except (TypeError, ValueError):
                            doc = 0
                        points.append({"date": date, "doc": doc, "value": value})
                    if points:
                        tests.append({
                            "name": str(t.get("name")).strip()[:60],
                            "unit": str(t.get("unit") or "").strip()[:20],
                            "normal": str(t.get("normal") or "").strip()[:40],
                            "better": str(t.get("better") or "").strip().lower() if str(t.get("better") or "").strip().lower() in ("lower", "higher") else "",
                            "points": points,
                        })
                print(f"[lab-trends] {model}: {len(tests)} tests")
                return {"tests": tests}
            except Exception as e:
                last = e
                msg = str(e)
                print(f"[lab-trends] {model}: {msg[:150]}")
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                    break
                continue
    raise RuntimeError(str(last))
