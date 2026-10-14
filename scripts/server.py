import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from lan_signaling import LanSignaling, SignalingError
from lan_stun import LanStun, lan_address


class Handler(SimpleHTTPRequestHandler):
    def json_reply(self, value, status=200):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path == '/__stream__/status':
            ice = []
            if self.server.stun:
                address = lan_address(self.connection.getsockname()[0]) if self.server.stun.host == '0.0.0.0' else self.server.stun.host
                ice = [{'urls': f'stun:{address}:{self.server.stun.port}'}]
            return self.json_reply({'app': 'dingoo-lan-signaling', 'version': 1, 'iceServers': ice})
        super().do_GET()

    def do_POST(self):
        if self.path != '/__stream__/api':
            return self.json_reply({'error': 'not_found'}, 404)
        # JSON requests from other sites must preflight, which is unsupported.
        # Also verify same-origin requests before accepting browser credentials.
        origin = self.headers.get('Origin')
        if origin and origin not in ('http://' + self.headers.get('Host', ''), 'https://' + self.headers.get('Host', '')):
            return self.json_reply({'error': 'origin_rejected'}, 403)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 70000 or self.headers.get_content_type() != 'application/json':
                return self.json_reply({'error': 'invalid_request'}, 400)
            data = json.loads(self.rfile.read(length))
            reply = self.server.signaling.request(data, self.client_address[0])
            self.json_reply(reply)
        except (ValueError, SignalingError) as error:
            self.json_reply({'error': str(error) if isinstance(error, SignalingError) else 'invalid_request'}, 400)

    def log_request(self, code='-', size='-'):
        if not self.path.startswith('/__stream__/'):
            super().log_request(code, size)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


parser = argparse.ArgumentParser()
parser.add_argument("port", type=int)
parser.add_argument("directory")
parser.add_argument("--host", default="127.0.0.1", help="Bind address; use 0.0.0.0 for LAN access")
parser.add_argument('--stream-state', default=str(Path(__file__).resolve().parent.parent / '.local' / 'lan-pairing.json'), help='Persist trusted LAN devices; media and SDP are not saved')
args = parser.parse_args()
server = ThreadingHTTPServer((args.host, args.port), partial(Handler, directory=args.directory))
server.signaling = LanSignaling(args.stream_state)
try:
    server.stun = LanStun(args.host, server.server_address[1])
except OSError as error:
    server.stun = None
    print(f'LAN address discovery unavailable: {error}', flush=True)
print(f'Serving {args.directory} on {args.host}:{server.server_address[1]}', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    if server.stun:
        server.stun.close()
    server.server_close()
