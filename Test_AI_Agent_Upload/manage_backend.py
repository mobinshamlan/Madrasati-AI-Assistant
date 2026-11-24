"""Keep the local demo backend alive with macOS launchd, for this login session only.

Usage: python3 manage_backend.py start|stop|status
No login-startup installation and no provider requests are made by this launcher.
"""
import os
from pathlib import Path
import plistlib
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
LABEL = "local.tammeni.backend"
DOMAIN = f"gui/{os.getuid()}"
SERVICE = f"{DOMAIN}/{LABEL}"


def registered():
    return subprocess.run(["launchctl", "print", SERVICE], capture_output=True).returncode == 0


def main():
    if sys.platform != "darwin":
        raise SystemExit("This launcher uses macOS launchd. On other systems run uvicorn in your terminal.")
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    if action not in {"start", "stop", "status"}:
        raise SystemExit("Usage: python3 manage_backend.py start|stop|status")
    if action == "stop":
        if registered():
            subprocess.run(["launchctl", "bootout", SERVICE], check=True)
        print("Backend supervisor stopped.")
        return
    if action == "status":
        print("Backend supervisor is running." if registered() else "Backend supervisor is not running.")
        return
    if registered():
        print("Backend supervisor is already running.")
        return
    port = subprocess.run(["lsof", "-tiTCP:8000", "-sTCP:LISTEN"], capture_output=True)
    if port.returncode == 0:
        raise SystemExit("Port 8000 is in use. The existing server was left untouched.")
    python = ROOT / ".venv/bin/python"
    if not python.exists():
        raise SystemExit("Python environment missing. Install requirements in .venv first.")
    run = ROOT / ".demo"
    run.mkdir(exist_ok=True, mode=0o700)
    log = run / "backend.log"
    log.touch(mode=0o600, exist_ok=True)
    log.chmod(0o600)
    config = {
        "Label": LABEL,
        "ProgramArguments": [str(python), "-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", "8000"],
        "WorkingDirectory": str(ROOT),
        "StandardOutPath": str(log),
        "StandardErrorPath": str(log),
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 3,
        "ProcessType": "Background",
    }
    # Only the public tunnel address belongs in the plist. Secrets stay in the ignored .env.
    if os.environ.get("PUBLIC_URL"):
        config["EnvironmentVariables"] = {"PUBLIC_URL": os.environ["PUBLIC_URL"]}
    path = run / f"{LABEL}.plist"
    path.write_bytes(plistlib.dumps(config))
    path.chmod(0o600)
    subprocess.run(["launchctl", "bootstrap", DOMAIN, str(path)], check=True)
    print("Backend supervisor started; it will restart the server if it exits.")


if __name__ == "__main__":
    main()
