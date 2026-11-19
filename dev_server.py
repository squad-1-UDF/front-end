"""Servidor local de arquivos com proxy restrito para a API Django.

Uso: python dev_server.py (Django em http://127.0.0.1:8000).
"""

from http.client import HTTPConnection
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class FrontendHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def do_PATCH(self):
        self._handle()

    def _handle(self):
        if not self.path.startswith("/api/v1/"):
            if self.command == "GET":
                return super().do_GET()
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"connection", "content-length", "transfer-encoding"}
        }
        # Host e Origin precisam apontar para a mesma origem vista pelo navegador.
        headers["Host"] = self.headers.get("Host", "127.0.0.1:5173")
        upstream = HTTPConnection("127.0.0.1", 8000, timeout=30)
        try:
            upstream.request(self.command, self.path, body=body, headers=headers)
            response = upstream.getresponse()
            payload = response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in {"connection", "content-length", "transfer-encoding"}:
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except OSError:
            self.send_error(502, "Django indisponível em 127.0.0.1:8000")
        finally:
            upstream.close()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 5173), FrontendHandler)
    print("Front-end: http://127.0.0.1:5173/login.html")
    server.serve_forever()
