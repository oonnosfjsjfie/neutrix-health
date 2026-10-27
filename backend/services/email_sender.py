# =====================================================
# Sends the Doctor Brief email from the team Gmail account.
# The account and its app password live ONLY in backend/.env:
#   NEUTRIX_EMAIL=neutrixhealth.team@gmail.com
#   NEUTRIX_EMAIL_PASSWORD=abcdefghijklmnop   (16-letter Gmail app password)
# =====================================================
import os
import re
import smtplib
from pathlib import Path
from email.message import EmailMessage
from email.utils import formataddr

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def send_doctor_email(to_address: str, subject: str, body: str, patient_name: str = "", reply_to: str = ""):
    """Returns (ok, message)."""
    sender = os.getenv("NEUTRIX_EMAIL", "").strip()
    password = os.getenv("NEUTRIX_EMAIL_PASSWORD", "").replace(" ", "").strip()

    if not sender or not password:
        return False, ("Email is not set up yet. Add NEUTRIX_EMAIL and NEUTRIX_EMAIL_PASSWORD "
                       "to backend/.env, then restart the backend.")

    to_address = (to_address or "").strip()
    if not EMAIL_RE.match(to_address):
        return False, "Please enter a valid doctor email address."
    if not (body or "").strip():
        return False, "The message is empty. Create the doctor message first."

    msg = EmailMessage()
    msg["From"] = formataddr((f"Neutrix Health{' – ' + patient_name if patient_name else ''}", sender))
    msg["To"] = to_address
    msg["Subject"] = subject or "Patient update from Neutrix Health"
    if reply_to and EMAIL_RE.match(reply_to.strip()):
        msg["Reply-To"] = reply_to.strip()
    msg.set_content(
        body.strip()
        + "\n\n—\nSent with Neutrix Health on behalf of the patient. "
          "Neutrix organizes information; it does not diagnose or prescribe."
    )

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
            server.login(sender, password)
            server.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        return False, ("Gmail refused the login. Check NEUTRIX_EMAIL and the 16-letter app password "
                       "in backend/.env (2-Step Verification must be on).")
    except Exception as e:
        print(f"[email] error: {e}")
        return False, f"Could not send the email: {e}"

    print(f"[email] Sent doctor brief to {to_address}")
    return True, f"Email sent to {to_address}."
