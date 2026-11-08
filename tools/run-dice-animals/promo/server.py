"""Serve tools/run-dice-animals for the promo page, and save what it records.

    python3 promo/server.py [port]

POST /frame/<n>  -> promo/frames/<n>.jpg   (one recorded frame)
POST /events     -> promo/out/events.json   (the sound cues, when recording ends)
POST /cover/<name> -> promo/out/cover-<name>.png   (a square-ish catalog cover, ?cover=<name>)
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAMES = os.path.join(ROOT, "promo", "frames")
OUT = os.path.join(ROOT, "promo", "out")


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path.startswith("/frame/"):
            os.makedirs(FRAMES, exist_ok=True)
            n = int(self.path.rsplit("/", 1)[1])
            with open(os.path.join(FRAMES, f"{n:05d}.jpg"), "wb") as f:
                f.write(body)
        elif re.fullmatch(r"/cover/[a-z-]+", self.path):
            os.makedirs(OUT, exist_ok=True)
            with open(os.path.join(OUT, f"cover-{self.path.rsplit('/', 1)[1]}.png"), "wb") as f:
                f.write(body)
        elif self.path == "/events":
            os.makedirs(OUT, exist_ok=True)
            with open(os.path.join(OUT, "events.json"), "wb") as f:
                f.write(body)
        else:
            self.send_error(404)
            return
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):  # quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8796
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=ROOT)).serve_forever()
