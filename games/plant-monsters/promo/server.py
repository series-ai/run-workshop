"""Receive the promo's recorded frames and sound cues (the page runs on the Vite dev server, so this one allows CORS).

    python3 promo/server.py [port]        (default 8797; run from games/plant-monsters)

POST /frame/<n> -> promo/frames/<n>.jpg     POST /events -> promo/out/events.json
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(ROOT, "frames")
OUT = os.path.join(ROOT, "out")


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path.startswith("/frame/"):
            os.makedirs(FRAMES, exist_ok=True)
            with open(os.path.join(FRAMES, f"{int(self.path.rsplit('/', 1)[1]):05d}.jpg"), "wb") as f:
                f.write(body)
        elif self.path == "/events":
            os.makedirs(OUT, exist_ok=True)
            with open(os.path.join(OUT, "events.json"), "wb") as f:
                f.write(body)
        else:
            self.send_response(404)
            self.cors()
            self.end_headers()
            return
        self.send_response(204)
        self.cors()
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8797
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
