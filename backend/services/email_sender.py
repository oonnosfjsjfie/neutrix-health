# =====================================================
# Sends the Ask Doctor email from the team Gmail account.
#
# Two ways (secrets live ONLY in backend/.env or Render's Environment Variables):
# 1. Google Apps Script web app (works on Render's free plan, which blocks SMTP):
#      NEUTRIX_MAIL_WEBHOOK=https://script.google.com/macros/s/..../exec
#      NEUTRIX_MAIL_TOKEN=the secret word written in the Apps Script
# 2. Gmail SMTP with an app password (works on your own computer):
#      NEUTRIX_EMAIL=neutrixhealth.team@gmail.com
#      NEUTRIX_EMAIL_PASSWORD=abcdefghijklmnop
# If NEUTRIX_MAIL_WEBHOOK is set, way 1 is used.
# =====================================================
import os
import re
import json
import smtplib
import urllib.request
from pathlib import Path
from email.message import EmailMessage
from email.utils import formataddr

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


FOOTER = ("\n\n—\nSent with Neutrix Health on behalf of the patient. "
          "Neutrix organizes information; it does not diagnose or prescribe.")


def _send_via_apps_script(webhook: str, to_address: str, subject: str, body: str, sender_name: str, reply_to: str):
    payload = json.dumps({
        "token": os.getenv("NEUTRIX_MAIL_TOKEN", "").strip(),
        "to": to_address,
        "subject": subject,
        "body": body,
        "name": sender_name,
        "replyTo": reply_to,
    }).encode("utf-8")
    req = urllib.request.Request(webhook, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode("utf-8") or "{}")
    except Exception as e:
        print(f"[email] Apps Script error: {e}")
        return False, f"Could not reach the email service: {e}"
    if data.get("ok"):
        print(f"[email] Sent Ask Doctor to {to_address} (Apps Script)")
        return True, f"Email sent to {to_address}."
    return False, f"The email service refused it: {data.get('message', 'unknown error')}"


def send_doctor_email(to_address: str, subject: str, body: str, patient_name: str = "", reply_to: str = ""):
    """Returns (ok, message)."""
    to_address = (to_address or "").strip()
    if not EMAIL_RE.match(to_address):
        return False, "Please enter a valid doctor email address."
    if not (body or "").strip():
        return False, "The message is empty. Create the doctor message first."
    subject = subject or "Patient update from Neutrix Health"
    sender_name = f"Neutrix Health{' – ' + patient_name if patient_name else ''}"
    reply_to = reply_to.strip() if reply_to and EMAIL_RE.match(reply_to.strip()) else ""

    webhook = os.getenv("NEUTRIX_MAIL_WEBHOOK", "").strip()
    if webhook:
        return _send_via_apps_script(webhook, to_address, subject, body.strip() + FOOTER, sender_name, reply_to)

    sender = os.getenv("NEUTRIX_EMAIL", "").strip()
    password = os.getenv("NEUTRIX_EMAIL_PASSWORD", "").replace(" ", "").strip()

    if not sender or not password:
        return False, ("Email is not set up yet. Add NEUTRIX_MAIL_WEBHOOK (or NEUTRIX_EMAIL and "
                       "NEUTRIX_EMAIL_PASSWORD) to backend/.env or Render, then restart.")

    msg = EmailMessage()
    msg["From"] = formataddr((sender_name, sender))
    msg["To"] = to_address
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body.strip() + FOOTER)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
            server.login(sender, password)
            server.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        return False, ("Gmail refused the login. Check NEUTRIX_EMAIL and the 16-letter app password "
                       "in backend/.env (2-Step Verification must be on).")
    except OSError as e:
        print(f"[email] error: {e}")
        if getattr(e, "errno", None) in (101, 110, 111, 113) or "timed out" in str(e):
            return False, ("This server cannot connect to Gmail directly (free hosting blocks it). "
                           "Set up NEUTRIX_MAIL_WEBHOOK (Google Apps Script), or use 'Open in Gmail'.")
        return False, f"Could not send the email: {e}"
    except Exception as e:
        print(f"[email] error: {e}")
        return False, f"Could not send the email: {e}"

    print(f"[email] Sent Ask Doctor to {to_address}")
    return True, f"Email sent to {to_address}."


TEAM_FOOTER = ("\n\n—\nSent by the Neutrix Health team. You are receiving this because you have a Neutrix account. "
               "Reply to this email to answer us.")


def send_team_email(to_address: str, subject: str, body: str, reply_to: str = ""):
    """An email from the Neutrix team (Admin page) to one registered person. Returns (ok, message)."""
    to_address = (to_address or "").strip()
    if not EMAIL_RE.match(to_address):
        return False, f"{to_address or '(empty)'} is not a valid email address."
    if not (body or "").strip():
        return False, "The message is empty."
    subject = (subject or "").strip() or "A message from the Neutrix Health team"
    reply_to = reply_to.strip() if reply_to and EMAIL_RE.match(reply_to.strip()) else ""
    webhook = os.getenv("NEUTRIX_MAIL_WEBHOOK", "").strip()
    if not webhook:
        return False, "Email is not set up on the server (NEUTRIX_MAIL_WEBHOOK)."
    ok, message = _send_via_apps_script(webhook, to_address, subject, body.strip() + TEAM_FOOTER, "Neutrix Health Team", reply_to)
    return ok, message
