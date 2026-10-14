"""Serve tools/run-costume-kids for the trailer page, and save what it records.

    python3 promo/server.py [port]

The page lives at /promo/ and loads the kids, houses and props from ../previewer/.

POST /frame/<n>    -> promo/frames/<n>.jpg     (one recorded frame)
POST /events       -> promo/out/events.json    (the sound cues, when recording ends)
POST /still/<name> -> promo/out/still-<name>.jpg (a check frame or contact sheet, ?at= / ?sheet=)
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
        elif re.fullmatch(r"/still/[a-z0-9-]+", self.path):
            os.makedirs(OUT, exist_ok=True)
            with open(os.path.join(OUT, f"still-{self.path.rsplit('/', 1)[1]}.jpg"), "wb") as f:
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

    def end_headers(self):  # never cache: the GLBs change while the pack is in progress
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):  # quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8798
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=ROOT)).serve_forever()
