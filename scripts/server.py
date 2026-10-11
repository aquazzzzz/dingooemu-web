import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


parser = argparse.ArgumentParser()
parser.add_argument("port", type=int)
parser.add_argument("directory")
parser.add_argument("--host", default="127.0.0.1", help="Bind address; use 0.0.0.0 for LAN access")
args = parser.parse_args()
server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=args.directory))
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
