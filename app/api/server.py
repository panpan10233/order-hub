"""ThreadingHTTPServer + 静态托管 + CORS + 敏感文件拦截。"""

from __future__ import annotations

import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Tuple
from urllib.parse import parse_qs, unquote, urlparse

from . import router

STATIC_DIR = (Path(__file__).resolve().parents[1] / "static").resolve()
MAX_BODY = 2 * 1024 * 1024

# 只放行前端静态资源；所有 .py / .db / .json / 配置文件一律 403
ALLOWED_EXT = {
    ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg",
    ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf",
}

MIME_OVERRIDES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
}


class OrderHubHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "OrderHub/1.0"

    # ------------------------------------------------------------------ #
    # 基础响应工具
    # ------------------------------------------------------------------ #
    def _cors_headers(self) -> Dict[str, str]:
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "no-store",
        }

    def _send_bytes(self, status: int, data: bytes, content_type: str,
                    extra: Dict[str, str] | None = None) -> None:
        headers = self._cors_headers()
        headers["Content-Type"] = content_type
        headers["Content-Length"] = str(len(data))
        if extra:
            headers.update(extra)
        try:
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.end_headers()
            if self.command != "HEAD" and data:
                self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_json(self, status: int, payload, extra: Dict[str, str] | None = None) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, data, MIME_OVERRIDES[".json"], extra)

    def _read_json_body(self) -> Dict:
        if self.command == "GET":
            return {}
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise router.ApiError(413, "请求体过大")
        raw = self.rfile.read(length)
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise router.ApiError(400, "请求体不是合法 JSON")
        if not isinstance(parsed, dict):
            raise router.ApiError(400, "请求体必须是 JSON 对象")
        return parsed

    # ------------------------------------------------------------------ #
    # 静态资源
    # ------------------------------------------------------------------ #
    def _serve_static(self, path: str) -> None:
        if path in ("", "/"):
            rel = "index.html"
        else:
            rel = unquote(path.lstrip("/"))
            if not rel or rel.endswith("/"):
                rel += "index.html"

        # 拦截路径穿越、隐藏文件与 Windows 反斜杠
        if "\\" in rel or ".." in rel.split("/") or any(
            part.startswith(".") for part in rel.split("/") if part
        ):
            self._send_json(403, {"ok": False, "error": "禁止访问"})
            return

        candidate = (STATIC_DIR / rel).resolve()
        root = str(STATIC_DIR)
        if str(candidate) != root and not str(candidate).startswith(root + os.sep):
            self._send_json(403, {"ok": False, "error": "禁止访问"})
            return
        if not candidate.is_file():
            self._send_json(404, {"ok": False, "error": "资源不存在"})
            return

        ext = candidate.suffix.lower()
        if ext not in ALLOWED_EXT:
            self._send_json(403, {"ok": False, "error": "禁止访问该类型文件"})
            return

        content_type = MIME_OVERRIDES.get(ext) or mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        if content_type.startswith("text/") and "charset=" not in content_type:
            content_type += "; charset=utf-8"
        self._send_bytes(200, candidate.read_bytes(), content_type)

    # ------------------------------------------------------------------ #
    # 请求入口
    # ------------------------------------------------------------------ #
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        self._dispatch("GET", parsed.path, parsed.query)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        self._dispatch("POST", parsed.path, parsed.query)

    def do_OPTIONS(self) -> None:
        self._send_bytes(204, b"", "text/plain; charset=utf-8")

    def _dispatch(self, method: str, path: str, raw_query: str) -> None:
        if path.startswith("/api/"):
            query = {k: v[-1] for k, v in parse_qs(raw_query).items()}
            try:
                body = self._read_json_body()
                status, payload, extra = router.handle(method, path, query, body)
            except router.ApiError as exc:
                status, payload, extra = exc.status, {"ok": False, "error": exc.message}, {}
            except Exception as exc:  # 避免单个请求拖垮服务
                status, payload, extra = 500, {"ok": False, "error": str(exc)}, {}
                self.log_error("API error: %s", exc)
            self._send_json(status, payload, extra)
            return

        if method not in ("GET", "HEAD"):
            self._send_json(405, {"ok": False, "error": "方法不允许"})
            return
        try:
            self._serve_static(path)
        except Exception as exc:
            self.log_error("Static error: %s", exc)
            self._send_json(500, {"ok": False, "error": "服务器内部错误"})

    # ------------------------------------------------------------------ #
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[OrderHub] %s - %s\n" % (self.address_string(), fmt % args))


def create_server(host: str = "0.0.0.0", port: int = 8790) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), OrderHubHandler)
    server.daemon_threads = True
    return server
