#!/usr/bin/env python3
import cgi
import json
import os
import re
import shutil
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
UPLOAD_ROOT = Path(os.environ.get("ZOHO_WORKDRIVE_ROOT", ROOT / "uploads")).expanduser()


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
            self.send_json(200, {"ok": True, "uploadRoot": str(UPLOAD_ROOT)})
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/upload":
            self.send_error(404, "Not found")
            return

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            },
        )
        case_id = safe_name(form.getfirst("caseId"), "case")
        clinic = safe_name(form.getfirst("clinicName") or form.getfirst("clinicId"), "Unknown clinic")
        patient = safe_name(form.getfirst("patientName"), f"case-{case_id}")
        target_dir = UPLOAD_ROOT / clinic / f"{case_id} - {patient}"
        target_dir.mkdir(parents=True, exist_ok=True)

        fields = form["files"] if "files" in form else []
        if not isinstance(fields, list):
            fields = [fields]

        saved = []
        for item in fields:
            if not getattr(item, "filename", None):
                continue
            name = safe_name(item.filename, "file")
            dest = unique_path(target_dir / name)
            with dest.open("wb") as out:
                shutil.copyfileobj(item.file, out)
            saved.append({
                "name": dest.name,
                "size": dest.stat().st_size,
                "path": str(dest),
                "clinic": clinic,
                "caseId": case_id,
            })

        self.send_json(200, {"ok": True, "files": saved, "folder": str(target_dir)})


def main():
    port = int(os.environ.get("PORT", "8003"))
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    server = ThreadingHTTPServer(("127.0.0.1", port), DentalLabHandler)
    print(f"Serving dental lab on http://127.0.0.1:{port}")
    print(f"Uploads folder: {UPLOAD_ROOT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
