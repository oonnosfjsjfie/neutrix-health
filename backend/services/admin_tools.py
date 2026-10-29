"""
Admin tools that need Firebase admin rights (run only on the server).

Needs the environment variable FIREBASE_SERVICE_ACCOUNT: the service account key JSON from
Firebase console -> Project settings -> Service accounts -> Generate new private key.
(Paste the whole JSON, or the same JSON base64-encoded.) Never put this key in the code or GitHub.
"""
import os
import re
import json
import base64

ADMIN_EMAILS = {"altlol2102@gmail.com", "ajay21022010@gmail.com", "lingesh.ganesh2@gmail.com", "adamspencer.miranda2010@gmail.com", "abcd6162@gmail.com"}

_app = None


class AdminNotConfigured(Exception):
    pass


def _init():
    """Start the Firebase Admin SDK once."""
    global _app
    if _app is not None:
        return _app
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not raw:
        raise AdminNotConfigured(
            "Deleting users is not set up yet: add FIREBASE_SERVICE_ACCOUNT (the Firebase service account key) "
            "to the server's environment variables.")
    try:
        info = json.loads(raw)
    except ValueError:
        try:
            info = json.loads(base64.b64decode(raw).decode("utf-8"))
        except Exception:
            raise AdminNotConfigured("FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file.")
    import firebase_admin
    from firebase_admin import credentials
    _app = firebase_admin.initialize_app(credentials.Certificate(info), name="neutrix-admin")
    return _app


def firebase_project_id() -> str:
    """The Firebase project id, from the same FIREBASE_CONFIG the website uses."""
    raw = os.getenv("FIREBASE_CONFIG", "")
    pairs = dict(re.findall(r'["\']?(\w+)["\']?\s*:\s*["\']([^"\']*)["\']', raw))
    return pairs.get("projectId", "") or os.getenv("FIREBASE_PROJECT_ID", "")


def verify_admin(id_token: str) -> dict:
    """Checks the signed-in person's Firebase ID token (Google's public keys; no admin key needed).
    Only verified admin emails pass."""
    if not id_token:
        raise PermissionError("Please sign in again.")
    project = firebase_project_id()
    if not project:
        raise AdminNotConfigured("FIREBASE_CONFIG is missing on the server.")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        decoded = google_id_token.verify_firebase_token(id_token, google_requests.Request(), audience=project)
    except Exception as e:
        print(f"[admin] token check failed: {e}")
        raise PermissionError("Your sign-in has expired. Please sign out and sign in again.")
    if not decoded:
        raise PermissionError("Please sign in again.")
    decoded.setdefault("uid", decoded.get("user_id") or decoded.get("sub"))
    email = str(decoded.get("email") or "").lower()
    if not decoded.get("email_verified") or email not in ADMIN_EMAILS:
        raise PermissionError("Only Neutrix admins can do this.")
    return decoded


def delete_user_completely(uid: str, admin: dict) -> dict:
    """Deletes everything stored for this person, then their sign-in account."""
    from firebase_admin import auth, firestore
    if not uid or "/" in uid:
        raise ValueError("Unknown user.")
    if uid == admin.get("uid"):
        raise PermissionError("You can't delete your own admin account here.")

    app = _init()
    db = firestore.client(app=app)
    user_ref = db.collection("users").document(uid)

    # Who is it? Admin accounts are protected.
    email = ""
    try:
        email = (auth.get_user(uid, app=app).email or "").lower()
    except auth.UserNotFoundError:
        pass
    snap = user_ref.get()
    if not email and snap.exists:
        email = str((snap.to_dict() or {}).get("email") or "").lower()
    if email in ADMIN_EMAILS:
        raise PermissionError("Admin accounts can't be deleted from the Admin page.")

    # 1. All saved data: users/{uid} and everything under it (store, chunks, ...)
    deleted_docs = 0
    contact_ref = db.collection("contacts").document(uid)
    if contact_ref.get().exists:
        contact_ref.delete()
        deleted_docs += 1
    if hasattr(db, "recursive_delete"):
        deleted_docs += db.recursive_delete(user_ref)
    else:
        for sub in user_ref.collections():
            for doc in sub.list_documents():
                doc.delete()
                deleted_docs += 1
        user_ref.delete()
        deleted_docs += 1

    # 2. The sign-in account (also signs them out on every device)
    account_deleted = False
    try:
        auth.delete_user(uid, app=app)
        account_deleted = True
    except auth.UserNotFoundError:
        pass

    print(f"[admin] {admin.get('email')} deleted user {uid} ({email}): {deleted_docs} documents, account={account_deleted}")
    return {"uid": uid, "email": email, "deleted_documents": deleted_docs, "account_deleted": account_deleted}
