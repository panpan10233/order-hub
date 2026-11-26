#!/usr/bin/env python3
"""OrderHub 多平台订单数据中台 - 服务入口。

仅使用 Python 标准库，零第三方依赖。
启动：python main.py   （监听 0.0.0.0:8790）
"""

from __future__ import annotations

import sys

from app import database as db
from app.api.server import create_server

HOST = "0.0.0.0"
PORT = 8790


def main() -> int:
    try:
        db.init_db()
    except Exception as exc:
        print(f"[OrderHub] 数据库初始化失败: {exc}", file=sys.stderr)
        return 1

    server = create_server(HOST, PORT)
    print(f"[OrderHub] 多平台订单数据中台已启动: http://{HOST}:{PORT}/", flush=True)
    print("[OrderHub] 按 Ctrl+C 停止服务", flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("\n[OrderHub] 正在停止服务...", flush=True)
    finally:
        server.server_close()
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
