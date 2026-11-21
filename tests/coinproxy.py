#!/usr/bin/env python3
"""Minimal CONNECT proxy for the CoinGlance offline-fallback test.

- Listens on 127.0.0.1:18080.
- Forwards CONNECT tunnels normally, EXCEPT api.coingecko.com while the
  flag file /tmp/coinproxy.block exists — then it answers 502 and closes,
  so the app's fetch fails exactly like a real network outage.
- Everything else (the Vite dev server on localhost) bypasses the proxy
  via no_proxy, so only the CoinGecko API is affected.

Run:  python3 /tmp/coinproxy.py   (background)
Block: touch /tmp/coinproxy.block
Unblock: rm /tmp/coinproxy.block
"""
import base64
import os
import socket
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BLOCK_FLAG = '/tmp/coinproxy.block'
BLOCK_HOST = 'api.coingecko.com'

# This VM reaches the internet only through the sandbox egress proxy
# (HTTPS_PROXY env). The relay chains through it: direct TCP to the
# outside fails the TLS handshake, so the upstream leg is itself a
# CONNECT to the egress proxy. The credential comes from the environment
# and is never logged.
_EGRESS = urllib.parse.urlparse(os.environ.get('HTTPS_PROXY', ''))


def _open_upstream(host, port):
    """CONNECT through the sandbox egress proxy; returns the tunnel socket."""
    if not _EGRESS.hostname:
        return socket.create_connection((host, port), timeout=10)
    upstream = socket.create_connection((_EGRESS.hostname, _EGRESS.port or 3128), timeout=10)
    auth = ''
    if _EGRESS.username:
        creds = f'{urllib.parse.unquote(_EGRESS.username)}:{urllib.parse.unquote(_EGRESS.password or "")}'
        auth = 'Proxy-Authorization: Basic ' + base64.b64encode(creds.encode()).decode() + '\r\n'
    req = (
        f'CONNECT {host}:{port} HTTP/1.1\r\n'
        f'Host: {host}:{port}\r\n'
        f'{auth}\r\n'
    )
    upstream.sendall(req.encode())
    buf = b''
    while b'\r\n\r\n' not in buf:
        chunk = upstream.recv(4096)
        if not chunk:
            raise OSError('egress proxy closed the CONNECT')
        buf += chunk
    status = buf.split(b'\r\n', 1)[0].decode(errors='replace')
    if ' 200' not in status:
        raise OSError(f'egress proxy refused CONNECT: {status}')
    return upstream


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):  # keep stdout quiet; log to file
        with open('/tmp/coinproxy.log', 'a') as f:
            f.write(f'{self.command} {self.path}\n')

    def do_CONNECT(self):
        host, _, port = self.path.partition(':')
        port = int(port or 443)
        if host == BLOCK_HOST and os.path.exists(BLOCK_FLAG):
            self.send_response(502, 'Blocked by test proxy')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        try:
            upstream = _open_upstream(host, port)
        except OSError:
            self.send_response(502, 'Upstream unreachable')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.send_response(200, 'Connection Established')
        self.send_header('Content-Length', '0')
        self.end_headers()
        self._relay(self.connection, upstream)

    def _relay(self, a, b):
        # Two threads, one per direction, blocking sockets: the standard
        # robust CONNECT relay (select + non-blocking sendall drops bytes
        # under load and breaks the TLS handshake).
        def pump(src, dst):
            try:
                while True:
                    data = src.recv(65536)
                    if not data:
                        break
                    dst.sendall(data)
            except OSError:
                pass
            finally:
                try:
                    dst.shutdown(socket.SHUT_WR)
                except OSError:
                    pass

        t1 = threading.Thread(target=pump, args=(a, b), daemon=True)
        t2 = threading.Thread(target=pump, args=(b, a), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        a.close()
        b.close()

    # The app only uses CONNECT (https). Anything else: not implemented.
    def do_GET(self):
        self.send_response(501)
        self.send_header('Content-Length', '0')
        self.end_headers()


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', 18080), ProxyHandler)
    srv.daemon_threads = True
    print('coinproxy listening on 127.0.0.1:18080', flush=True)
    srv.serve_forever()
