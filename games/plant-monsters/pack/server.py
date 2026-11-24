"""Receive the pack exporter's files (the page runs on the Vite dev server, so this allows CORS).

    python3 pack/server.py [port]        (default 8798; run from games/plant-monsters)

POST /file/<path> -> pack/out/<path>
"""
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")


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
        rel = os.path.normpath(self.path[len("/file/"):]) if self.path.startswith("/file/") else ""
        if not rel or rel.startswith(".."):
            self.send_response(404)
            self.cors()
            self.end_headers()
            return
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        self.send_response(204)
        self.cors()
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8798
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
