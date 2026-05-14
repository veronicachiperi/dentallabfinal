#!/usr/bin/env python3
import cgi
import json
import mimetypes
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
UPLOAD_ROOT = Path(os.environ.get("ZOHO_WORKDRIVE_ROOT", ROOT / "uploads")).expanduser()
WORKDRIVE_MAP_PATH = Path(os.environ.get("ZOHO_WORKDRIVE_MAP", ROOT / "workdrive-folders.json")).expanduser()


# ── .env loader ──────────────────────────────────────────────
def _load_dotenv():
    for name in (".env", ".env.local"):
        p = ROOT / name
        try:
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, _, v = line.partition("=")
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v
        except FileNotFoundError:
            pass

_load_dotenv()

ZOHO_CLIENT_ID     = os.environ.get("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.environ.get("ZOHO_CLIENT_SECRET", "")
ZOHO_REFRESH_TOKEN = os.environ.get("ZOHO_REFRESH_TOKEN", "")
ZOHO_REGION        = os.environ.get("ZOHO_REGION", "eu")

_token_cache: dict = {"token": None, "expires_at": 0.0}


# ── Zoho OAuth ───────────────────────────────────────────────
def zoho_configured() -> bool:
    return bool(ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN)


def zoho_access_token() -> str:
    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]
    data = urllib.parse.urlencode({
        "grant_type":    "refresh_token",
        "client_id":     ZOHO_CLIENT_ID,
        "client_secret": ZOHO_CLIENT_SECRET,
        "refresh_token": ZOHO_REFRESH_TOKEN,
    }).encode()
    req = urllib.request.Request(
        f"https://accounts.zoho.{ZOHO_REGION}/oauth/v2/token",
        data=data, method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            r = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Token refresh HTTP {e.code}: {e.read()[:300]}")
    if "access_token" not in r:
        raise RuntimeError(f"Token refresh failed: {r}")
    _token_cache["token"] = r["access_token"]
    _token_cache["expires_at"] = time.time() + int(r.get("expires_in", 3600))
    return _token_cache["token"]


# ── Zoho WorkDrive API helpers ───────────────────────────────
def _zoho_req(method: str, url: str, body=None, extra_headers: dict = None) -> dict:
    token = zoho_access_token()
    headers = {"Authorization": f"Zoho-oauthtoken {token}"}
    if extra_headers:
        headers.update(extra_headers)
    if isinstance(body, dict):
        body = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Zoho {method} {url} → HTTP {e.code}: {e.read()[:300]}")


def _find_folder(parent_id: str, name: str):
    """Return the ID of an existing child folder named `name`, or None."""
    url = (
        f"https://www.zohoapis.{ZOHO_REGION}/workdrive/api/v1"
        f"/files/{urllib.parse.quote(parent_id)}/files"
    )
    try:
        result = _zoho_req("GET", url)
        for item in result.get("data", []):
            attrs = item.get("attributes", {})
            # Zoho WorkDrive uses "folder" for the type attribute
            if attrs.get("name") == name and "folder" in str(attrs.get("type", "")).lower():
                return item["id"]
    except Exception:
        pass
    return None


def _create_folder(parent_id: str, name: str) -> str:
    url = f"https://www.zohoapis.{ZOHO_REGION}/workdrive/api/v1/files"
    result = _zoho_req("POST", url, body={
        "data": {
            "attributes": {"name": name, "parent_id": parent_id},
            "type": "files",
        }
    })
    return result["data"]["id"]


def zoho_find_or_create_folder(parent_id: str, name: str) -> str:
    folder_id = _find_folder(parent_id, name)
    if folder_id:
        return folder_id
    try:
        return _create_folder(parent_id, name)
    except RuntimeError:
        # Possibly a race / duplicate — try to find it again before giving up
        folder_id = _find_folder(parent_id, name)
        if folder_id:
            return folder_id
        raise


def zoho_upload(folder_id: str, filename: str, file_obj, mime: str = None) -> dict:
    if mime is None:
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    content = file_obj.read() if hasattr(file_obj, "read") else file_obj
    boundary = "ZohoUploadBoundary7B8C9DA2"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="content"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    url = (
        f"https://www.zohoapis.{ZOHO_REGION}/workdrive/api/v1/upload"
        f"?parent_id={urllib.parse.quote(folder_id)}"
        f"&filename={urllib.parse.quote(filename)}"
        f"&override-name-exist=true"
    )
    token = zoho_access_token()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Zoho-oauthtoken {token}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Zoho upload '{filename}' → HTTP {e.code}: {e.read()[:300]}")


# ── Utility ──────────────────────────────────────────────────
def safe_name(value, fallback="untitled"):
    value = re.sub(r"[^\w .#()-]+", "-", str(value or "").strip(), flags=re.UNICODE)
    value = re.sub(r"\s+", " ", value).strip(" .-")
    return value or fallback


def unique_path(path):
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    i = 2
    while True:
        candidate = path.with_name(f"{stem}-{i}{suffix}")
        if not candidate.exists():
            return candidate
        i += 1


def load_workdrive_map():
    try:
        with WORKDRIVE_MAP_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def clinic_folder_config(clinic_id, clinic_name):
    mapping = load_workdrive_map()
    value = mapping.get(clinic_id) or mapping.get(clinic_name) or {}
    if isinstance(value, str):
        value = {"path": value}
    folder_id = value.get("folder_id", "")
    configured_path = value.get("path")
    folder_path = (
        Path(configured_path).expanduser()
        if configured_path
        else Path(safe_name(clinic_name or clinic_id, "Unknown clinic"))
    )
    if not folder_path.is_absolute():
        folder_path = UPLOAD_ROOT / folder_path
    return {
        "path":      folder_path,
        "folder_id": folder_id,
        "url":       value.get("url", ""),
        "label":     value.get("label") or clinic_name or clinic_id,
    }


# ── HTTP handler ─────────────────────────────────────────────
class DentalLabHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        rel = urlparse(path).path.lstrip("/")
        return str(ROOT / rel)

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urlparse(self.path).path == "/api/health":
            self.send_json(200, {
                "ok":             True,
                "uploadRoot":     str(UPLOAD_ROOT),
                "workdriveMap":   str(WORKDRIVE_MAP_PATH),
                "zohoConfigured": zoho_configured(),
                "zohoRegion":     ZOHO_REGION if zoho_configured() else None,
            })
            return
        super().do_GET()

    def do_HEAD(self):
        if urlparse(self.path).path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            return
        super().do_HEAD()

    def do_POST(self):
        if urlparse(self.path).path == "/api/upload":
            self._handle_upload()
        else:
            self.send_error(404, "Not found")

    def _handle_upload(self):
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE":   self.headers.get("Content-Type", ""),
            },
        )
        case_id   = safe_name(form.getfirst("caseId"),                      "case")
        clinic_id = safe_name(form.getfirst("clinicId"),                    "unknown")
        clinic    = safe_name(form.getfirst("clinicName") or clinic_id,     "Unknown clinic")
        patient   = safe_name(form.getfirst("patientName"), f"case-{case_id}")

        clinic_folder    = clinic_folder_config(clinic_id, clinic)
        case_folder_name = f"{case_id} - {patient}"

        fields = form["files"] if "files" in form else []
        if not isinstance(fields, list):
            fields = [fields]

        saved = []

        if zoho_configured() and clinic_folder["folder_id"]:
            # ── Zoho WorkDrive API path ──────────────────────
            try:
                case_folder_id = zoho_find_or_create_folder(
                    clinic_folder["folder_id"], case_folder_name
                )
            except Exception as e:
                self.send_json(500, {"ok": False, "error": f"Folder error: {e}"})
                return

            for item in fields:
                if not getattr(item, "filename", None):
                    continue
                name = safe_name(item.filename, "file")
                mime = getattr(item, "type", None) or None
                try:
                    result = zoho_upload(case_folder_id, name, item.file, mime)
                except Exception as e:
                    self.send_json(500, {"ok": False, "error": f"Upload failed: {e}"})
                    return
                attrs = result.get("data", {}).get("attributes", {})
                file_id = attrs.get("resource_id", "")
                saved.append({
                    "name":        name,
                    "size":        attrs.get("size_in_bytes") or 0,
                    "path":        f"zoho://{file_id}",
                    "folder":      case_folder_name,
                    "clinicFolder": clinic_folder["label"],
                    "folderUrl":   clinic_folder.get("url", ""),
                    "clinic":      clinic,
                    "clinicId":    clinic_id,
                    "caseId":      case_id,
                    "zoho":        True,
                    "fileId":      file_id,
                })

            self.send_json(200, {
                "ok":          True,
                "files":       saved,
                "folder":      case_folder_name,
                "clinicFolder": clinic_folder["label"],
                "folderUrl":   clinic_folder.get("url", ""),
                "backend":     "zoho",
            })

        else:
            # ── Local filesystem fallback ────────────────────
            target_dir = clinic_folder["path"] / case_folder_name
            target_dir.mkdir(parents=True, exist_ok=True)

            for item in fields:
                if not getattr(item, "filename", None):
                    continue
                name = safe_name(item.filename, "file")
                dest = unique_path(target_dir / name)
                with dest.open("wb") as out:
                    shutil.copyfileobj(item.file, out)
                saved.append({
                    "name":        dest.name,
                    "size":        dest.stat().st_size,
                    "path":        str(dest),
                    "folder":      str(target_dir),
                    "clinicFolder": str(clinic_folder["path"]),
                    "folderUrl":   clinic_folder["url"],
                    "clinic":      clinic,
                    "clinicId":    clinic_id,
                    "caseId":      case_id,
                })

            self.send_json(200, {
                "ok":          True,
                "files":       saved,
                "folder":      str(target_dir),
                "clinicFolder": str(clinic_folder["path"]),
                "folderUrl":   clinic_folder["url"],
                "backend":     "local",
            })


def main():
    port = int(os.environ.get("PORT", "8003"))
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    server = ThreadingHTTPServer(("127.0.0.1", port), DentalLabHandler)
    print(f"Serving dental lab on http://127.0.0.1:{port}")
    print(f"Uploads folder : {UPLOAD_ROOT}")
    if zoho_configured():
        print(f"Zoho WorkDrive : ENABLED (region: {ZOHO_REGION})")
    else:
        print("Zoho WorkDrive : not configured — using local files")
    server.serve_forever()


if __name__ == "__main__":
    main()
