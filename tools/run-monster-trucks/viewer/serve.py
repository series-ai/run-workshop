"""Serve tools/ for the kit editor with caching off, so a rebuilt kit always
shows up on reload.

    python3 tools/run-monster-trucks/viewer/serve.py [port]   # default 8821
    open http://127.0.0.1:8821/run-monster-trucks/viewer/index.html
"""
import functools
import http.server
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8821
    http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=ROOT)).serve_forever()
