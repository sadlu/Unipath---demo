import json
import os
import socket
import sqlite3
import sys
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

from scraper.scraper import run_scraper
from engine.ai_payload import AIPayloadController

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "unipath_store.db")


class Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        c = self.conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                target_major TEXT NOT NULL,
                subjects TEXT NOT NULL,
                current_country TEXT DEFAULT 'Nepal',
                current_city TEXT DEFAULT 'Kathmandu',
                api_key TEXT DEFAULT ''
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS opportunities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                type TEXT NOT NULL,
                organization TEXT NOT NULL DEFAULT '',
                tier TEXT DEFAULT 'Private/Institutional',
                cost TEXT DEFAULT 'TBD',
                start_date TEXT DEFAULT 'TBD',
                skills_developed TEXT DEFAULT '',
                source_url TEXT UNIQUE,
                status TEXT DEFAULT 'Discovered'
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS cv (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                opportunity_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES user_profile(id),
                FOREIGN KEY (opportunity_id) REFERENCES opportunities(id),
                UNIQUE(user_id, opportunity_id)
            )
        """)
        self.conn.commit()

    def get_first_user(self):
        c = self.conn.cursor()
        c.execute("SELECT * FROM user_profile ORDER BY id LIMIT 1")
        row = c.fetchone()
        return dict(row) if row else None

    def save_user(self, name, target_major, subjects, current_city, current_country, api_key):
        existing = self.get_first_user()
        c = self.conn.cursor()
        if existing:
            c.execute("""
                UPDATE user_profile SET name=?, target_major=?, subjects=?,
                current_city=?, current_country=?, api_key=? WHERE id=?
            """, (name, target_major, ",".join(subjects), current_city, current_country, api_key, existing["id"]))
        else:
            c.execute("""
                INSERT INTO user_profile (name, target_major, subjects, current_city, current_country, api_key)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (name, target_major, ",".join(subjects), current_city, current_country, api_key))
        self.conn.commit()
        return True

    def get_opportunities(self):
        c = self.conn.cursor()
        c.execute("SELECT * FROM opportunities ORDER BY id DESC")
        return [dict(r) for r in c.fetchall()]

    def add_opportunities_batch(self, opportunities):
        ids = []
        c = self.conn.cursor()
        for opp in opportunities:
            try:
                c.execute("""
                    INSERT OR IGNORE INTO opportunities
                    (title, type, organization, tier, cost, start_date, skills_developed, source_url, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    opp.get("title", "Untitled"),
                    opp.get("type", "Project"),
                    opp.get("organization", "Unknown"),
                    opp.get("tier", "Private/Institutional"),
                    opp.get("cost", "TBD"),
                    opp.get("start_date", "TBD"),
                    opp.get("skills_developed", ""),
                    opp.get("source_url", ""),
                    opp.get("status", "Discovered"),
                ))
                if c.lastrowid:
                    ids.append(c.lastrowid)
            except sqlite3.IntegrityError:
                continue
        self.conn.commit()
        return ids

    def update_opportunity_status(self, opp_id, status):
        c = self.conn.cursor()
        c.execute("UPDATE opportunities SET status=? WHERE id=?", (status, opp_id))
        self.conn.commit()

    def get_cv_by_type(self, user_id):
        c = self.conn.cursor()
        c.execute("""
            SELECT c.description, o.title, o.type, o.organization, o.skills_developed
            FROM cv c JOIN opportunities o ON c.opportunity_id = o.id
            WHERE c.user_id=? ORDER BY o.type
        """, (user_id,))
        entries = [dict(r) for r in c.fetchall()]
        sections = {
            "Competitions & Academic Achievements": [],
            "Volunteering & Leadership": [],
            "Projects & Internships": [],
        }
        for e in entries:
            t = e.get("type", "")
            if t == "Competition":
                sections["Competitions & Academic Achievements"].append(e)
            elif t == "Volunteering":
                sections["Volunteering & Leadership"].append(e)
            else:
                sections["Projects & Internships"].append(e)
        return sections

    def add_to_cv(self, user_id, opp_id, description):
        c = self.conn.cursor()
        try:
            c.execute("INSERT OR REPLACE INTO cv (user_id, opportunity_id, description) VALUES (?, ?, ?)",
                      (user_id, opp_id, description))
            self.conn.commit()
        except sqlite3.IntegrityError:
            c.execute("UPDATE cv SET description=? WHERE user_id=? AND opportunity_id=?",
                      (description, user_id, opp_id))
            self.conn.commit()

    def close(self):
        self.conn.close()


def find_free_port(start=8765, max_attempts=10):
    for port in range(start, start + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start


def make_handler(db, ai_controller):
    _scan_lock = threading.Lock()
    _scanning = False

    class Handler(SimpleHTTPRequestHandler):
        def _send_json(self, data, status=200):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data, default=str).encode())

        def _read_body(self):
            length = int(self.headers.get("Content-Length", 0) or 0)
            if length:
                return json.loads(self.rfile.read(length).decode())
            return {}

        def _enrich_opps(self, opps, user):
            for opp in opps:
                opp["match"] = self._compute_match(opp, user)
                opp["org"] = opp.get("organization", "")
                opp["date"] = opp.get("start_date", "")
                t = opp.get("type", "Opportunity")
                o = opp.get("organization", "")
                opp["description"] = f"{t} opportunity at {o}." if o else f"{t} opportunity."
                if user:
                    opp["location"] = f"{user.get('current_city', '')}, {user.get('current_country', '')}"
                else:
                    opp["location"] = "Nepal"

        def _compute_match(self, opp, user):
            s = 60
            if user:
                subs = set((user.get("subjects") or "").lower().split(","))
                txt = ((opp.get("title") or "") + " " + (opp.get("skills_developed") or "")).lower()
                for sub in subs:
                    if sub.strip() and sub.strip() in txt:
                        s += 8
                if opp.get("tier") == "Government Level":
                    s += 5
                if "nepal" in txt:
                    s += 10
            return min(s, 99)

        def _compute_stats(self, user):
            xp, level, streak = 0, 1, 0
            saved = []
            if user:
                uid = user["id"]
                opps = db.get_opportunities()
                cv = sum(len(v) for v in db.get_cv_by_type(uid).values())
                xp = cv * 50 + len(opps) * 10
                level = max(1, xp // 100 + 1)
                saved = [o for o in opps if o.get("status") == "In Progress"]
                streak = min(len(saved), 7)
            names = ["Explorer", "Achiever", "Competitor", "Scholar", "Future Leader"]
            level_name = names[min(level - 1, len(names) - 1)] if level > 0 else names[0]
            return {
                "xp": xp, "level": level, "level_name": level_name,
                "streak": streak, "saved_count": len(saved),
                "saved_ids": [s["id"] for s in saved if "id" in s],
            }

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            user = db.get_first_user()

            if path == "/api/opportunities":
                opps = db.get_opportunities()
                self._enrich_opps(opps, user)
                self._send_json(opps)

            elif path == "/api/user":
                self._send_json(user)

            elif path == "/api/stats":
                self._send_json(self._compute_stats(user))

            elif path == "/api/scan-status":
                self._send_json({"scanning": _scanning})

            elif path == "/api/cv":
                if user:
                    cv = db.get_cv_by_type(user["id"])
                    flat = []
                    for section, entries in cv.items():
                        for e in entries:
                            flat.append(e)
                    self._send_json(flat)
                else:
                    self._send_json([])

            else:
                if path == "/" or path == "":
                    path = "/index.html"
                file_path = os.path.join(WEB_DIR, path.lstrip("/"))
                if os.path.isfile(file_path) and not path.startswith("/api/"):
                    self._serve_file(file_path)
                else:
                    self._serve_file(os.path.join(WEB_DIR, "index.html"))

        def _serve_file(self, file_path):
            ext = os.path.splitext(file_path)[1].lower()
            mime_map = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
            }
            content_type = mime_map.get(ext, "application/octet-stream")
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except FileNotFoundError:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not Found")

        def do_POST(self):
            nonlocal _scanning
            user = db.get_first_user()

            if self.path == "/api/scan":
                with _scan_lock:
                    if _scanning:
                        self._send_json({"status": "already_scanning"}, 409)
                        return
                    _scanning = True

                if not user:
                    _scanning = False
                    self._send_json({"error": "No user configured"}, 400)
                    return

                subs_raw = user.get("subjects", "")
                subs = [s.strip() for s in subs_raw.split(",") if s.strip()]
                city = user.get("current_city", "Kathmandu")
                country = user.get("current_country", "Nepal")

                def _do_scan():
                    nonlocal _scanning
                    try:
                        opps = ai_controller._free_fallback_scan(subs, city, country)
                        if opps:
                            db.add_opportunities_batch(opps)
                    finally:
                        _scanning = False

                threading.Thread(target=_do_scan, daemon=True).start()
                self._send_json({"status": "started"})

            elif self.path == "/api/save":
                body = self._read_body()
                opp_id = body.get("id")
                if opp_id:
                    db.update_opportunity_status(opp_id, "In Progress")
                    self._send_json({"status": "saved", "id": opp_id})
                else:
                    self._send_json({"error": "Missing id"}, 400)

            elif self.path == "/api/save-settings":
                body = self._read_body()
                db.save_user(
                    name=body.get("name", "Student"),
                    target_major=body.get("target_major", ""),
                    subjects=body.get("subjects", []),
                    current_city=body.get("current_city", "Kathmandu"),
                    current_country=body.get("current_country", "Nepal"),
                    api_key=body.get("api_key", ""),
                )
                self._send_json({"status": "saved"})

            elif self.path == "/api/scrape":
                try:
                    msg = run_scraper()
                    from scraper.scraper import get_scraped_context
                    content = get_scraped_context()
                    self._send_json({"status": "ok", "message": msg, "content": content[:3000]})
                except Exception as e:
                    self._send_json({"status": "error", "message": str(e)}, 500)

            elif self.path == "/api/query":
                body = self._read_body()
                query = body.get("query", "")
                if not query:
                    self._send_json({"answer": "Please provide a query."}, 400)
                    return
                ai_controller.refresh_context()
                answer = ai_controller.query(query)
                self._send_json({"answer": answer})

            else:
                self._send_json({"error": "Not found"}, 404)

        def log_message(self, fmt, *args):
            pass

    return Handler


def start_server(port=None):
    db = Database()
    api_key = ""
    user = db.get_first_user()
    if user:
        api_key = user.get("api_key", "")
    ai_controller = AIPayloadController(api_key=api_key)

    if port is None:
        port = find_free_port()
    handler_class = make_handler(db, ai_controller)
    server = HTTPServer(("127.0.0.1", port), handler_class)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{port}"
    return url, server, db


if __name__ == "__main__":
    url, server, db = start_server()
    print(f"Uni Path running at {url}")
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
        server.shutdown()
        db.close()
