#!/usr/bin/env python3
"""Uni Path - Localized Educational & Career Opportunity Tracker for Nepal"""

import os
import sys
import argparse

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))


def ensure_deps():
    req_file = os.path.join(PROJECT_DIR, "requirements.txt")
    try:
        import requests
        import bs4
    except ImportError:
        print("Installing Uni Path dependencies...")
        import subprocess
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", req_file]
        )


def run_web():
    ensure_deps()
    sys.path.insert(0, PROJECT_DIR)
    from web.server import start_server
    url, server, db = start_server()
    print(f"\n  Uni Path running at: {url}")
    print("  Press Ctrl+C to stop.\n")
    try:
        import webbrowser
        webbrowser.open(url)
    except Exception:
        pass
    try:
        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
        db.close()


def run_scrape():
    ensure_deps()
    sys.path.insert(0, PROJECT_DIR)
    from scraper.scraper import run_scraper
    result = run_scraper()
    print(result)


def run_query():
    ensure_deps()
    sys.path.insert(0, PROJECT_DIR)
    from engine.ai_payload import AIPayloadController
    ai = AIPayloadController()
    ai.refresh_context()
    print("Uni Path Notice Query Engine (type 'exit' to quit)")
    print("Ask about admissions, scholarships, exams, or jobs in Nepal.\n")
    while True:
        try:
            q = input("> ").strip()
            if not q or q.lower() in ("exit", "quit"):
                break
            answer = ai.query(q)
            print(f"\n{answer}\n")
        except (EOFError, KeyboardInterrupt):
            break


def main():
    parser = argparse.ArgumentParser(
        description="Uni Path - Educational & Career Opportunity Tracker for Nepal"
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="web",
        choices=["web", "scrape", "query"],
        help="Command to run (default: web)",
    )
    args = parser.parse_args()

    if args.command == "web":
        run_web()
    elif args.command == "scrape":
        run_scrape()
    elif args.command == "query":
        run_query()


if __name__ == "__main__":
    main()
