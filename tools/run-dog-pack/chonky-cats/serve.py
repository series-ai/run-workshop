"""Serve tools/run-dog-pack for the cat viewer with caching off, so a reload always shows the latest page.

python3 chonky-cats/serve.py [port]   (default 8765) -> http://localhost:8765/chonky-cats/viewer.html
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ThreadingHTTPServer(('127.0.0.1', port), partial(NoCache, directory=root)).serve_forever()
