#!/usr/bin/env python3
"""
One-time script to obtain Zoho WorkDrive OAuth tokens and save them to .env.
Run this once, then restart server.py.
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT     = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"


def set_env_var(lines: list, key: str, value: str) -> None:
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}\n"
            return
    lines.append(f"{key}={value}\n")


def main():
    print("=" * 50)
    print("  Zoho WorkDrive OAuth Setup")
    print("=" * 50)

    print("""
STEP 1 — Create a Self Client in Zoho API Console:
  1. Open  https://api-console.zoho.eu/
  2. Click "Add Client" → choose "Self Client"
  3. After creation, copy the Client ID and Client Secret.
""")
    client_id = input("Client ID     : ").strip()
    client_secret = input("Client Secret : ").strip()
    if not client_id or not client_secret:
        sys.exit("Client ID and Secret are required.")

    print("""
STEP 2 — Generate an authorization code:
  1. In the Self Client page, click the "Generate Code" tab
  2. Scope    :  WorkDrive.files.ALL
  3. Duration :  3 minutes
  4. Click "Create" and copy the code shown.
""")
    code = input("Authorization code : ").strip()
    if not code:
        sys.exit("Authorization code is required.")

    region = input("Zoho region [eu/com/in/au/jp] (press Enter for eu): ").strip() or "eu"

    print("\nExchanging code for tokens...")
    data = urllib.parse.urlencode({
        "grant_type":    "authorization_code",
        "client_id":     client_id,
        "client_secret": client_secret,
        "code":          code,
        "redirect_uri":  "https://localhost",
    }).encode()

    req = urllib.request.Request(
        f"https://accounts.zoho.{region}/oauth/v2/token",
        data=data, method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:300]}")

    if "refresh_token" not in result:
        sys.exit(f"No refresh_token in response: {result}")

    lines: list = []
    if ENV_PATH.exists():
        with open(ENV_PATH) as f:
            lines = f.readlines()

    set_env_var(lines, "ZOHO_CLIENT_ID",     client_id)
    set_env_var(lines, "ZOHO_CLIENT_SECRET", client_secret)
    set_env_var(lines, "ZOHO_REFRESH_TOKEN", result["refresh_token"])
    set_env_var(lines, "ZOHO_REGION",        region)

    with open(ENV_PATH, "w") as f:
        f.writelines(lines)

    print(f"\nTokens saved to {ENV_PATH}")
    print("""
Next steps:
  1. Open workdrive-folders.json and fill in the folder_id for each clinic.
     (Find the ID in the WorkDrive URL when you open a folder —
      it's the long alphanumeric string, e.g. eokywe9d3d9b8a1104c88...)
  2. Restart server.py — Zoho API uploads will be active automatically.
""")


if __name__ == "__main__":
    main()
