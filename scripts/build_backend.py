"""
Cross-platform PyInstaller build script for UniPath backend.
Usage: python scripts/build_backend.py
"""
import os
import sys
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_NAME = "unipath-backend"
BUILD_DIR = ROOT / "dist-backend"
ENTRY_POINT = ROOT / "backend" / "server.py"


def ensure_pyinstaller():
    try:
        import PyInstaller
    except ImportError:
        print("==> Installing PyInstaller...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "pyinstaller"]
        )


def main():
    ensure_pyinstaller()

    print(f"==> Building {APP_NAME} with PyInstaller...")
    print(f"    Entry point: {ENTRY_POINT}")
    print(f"    Output dir:  {BUILD_DIR}")

    build_dir = BUILD_DIR
    build_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="pyinstaller-") as tmp:
        work_dir = Path(tmp) / "build"
        spec_dir = Path(tmp) / "spec"
        work_dir.mkdir()
        spec_dir.mkdir()

        backend_dir = ROOT / "backend"
        separator = ";" if sys.platform == "win32" else ":"

        add_data = []
        for f in ["config.py", "database.py", "search_service.py", "llm_service.py",
                   "pipeline.py", "local_index.py", "email_service.py", "__init__.py",
                   "main.py", ".env"]:
            src = backend_dir / f
            if src.exists():
                add_data.append(f"{src}{separator}backend")

        hidden_imports = [
            "uvicorn", "uvicorn.logging", "uvicorn.loops.auto",
            "uvicorn.protocols.http.auto", "uvicorn.protocols.websockets.auto",
            "fastapi", "pydantic", "dotenv",
            "ddgs", "requests", "bs4", "openai",
            "lxml", "httpx", "httpcore", "anyio", "sniffio", "h11",
            "starlette", "starlette.applications",
            "tzdata",
        ]

        cmd = [
            sys.executable, "-m", "PyInstaller",
            "--onefile",
            "--name", APP_NAME,
            "--distpath", str(build_dir),
            "--workpath", str(work_dir),
            "--specpath", str(spec_dir),
            "--noconfirm",
        ]
        for d in add_data:
            cmd.extend(["--add-data", d])
        for h in hidden_imports:
            cmd.extend(["--hidden-import", h])
        cmd.extend(["--collect-all", "uvicorn"])
        cmd.extend(["--collect-all", "fastapi"])
        cmd.extend(["--collect-all", "starlette"])
        cmd.append(str(ENTRY_POINT))

        result = subprocess.run(cmd, cwd=str(ROOT))
        if result.returncode != 0:
            print(f"ERROR: PyInstaller failed with code {result.returncode}")
            sys.exit(1)

    print(f"==> Done! Binary at:")
    for p in build_dir.iterdir():
        print(f"    {p} ({p.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
