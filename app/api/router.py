"""API 路由分发。

所有写操作均调用 services 层；响应结构与前端 app.js 的字段一一对应。
"""

from __future__ import annotations

import re
from typing import Any, Dict, Tuple

from .. import config, database as db
from ..services import ai as ai_service
from ..services import analytics, inventory as inv_service
from ..services import orders as order_service
from ..services import sync as sync_service
from ..services.adapters import registry as adapter_registry


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


_ID = r"([A-Za-z0-9_-]+)"


def _settings_from_body(body: Dict[str, Any]) -> Dict[str, Any]:
    raw = body.get("settings", body)
    if not isinstance(raw, dict):
        raise ApiError(400, "settings 必须是 JSON 对象")
    allowed = {"interval", "autoSync", "emailAlert", "lowStockThreshold", "retry", "currency", "erpAlert"}
    return {k: v for k, v in raw.items() if k in allowed}


def handle(method: str, path: str, query: Dict[str, str], body: Dict[str, Any]) -> Tuple[int, Any, Dict[str, str]]:
    """返回 (HTTP 状态码, 响应体, 额外响应头)。"""
    headers: Dict[str, str] = {}

    # ---------------- GET ----------------
    if method == "GET" and path == "/api/bootstrap":
        return 200, db.snapshot(), headers

    if method == "GET" and path == "/api/health":
        return 200, {
            "ok": True,
            "db": "ok" if db.query_one("SELECT 1 AS ok") else "error",
            "adapters": adapter_registry.statuses(),
        }, headers

    if method == "GET" and path == "/api/adapters":
        statuses = adapter_registry.statuses()
        return 200, {"adapters": statuses, "count": len(statuses)}, headers

    if method == "GET" and path == "/api/analytics":
        return 200, analytics.summary(), headers

    if method == "GET" and path == "/api/config":
        return 200, config.public_config(), headers

    if method == "GET" and path == "/api/data/export":
        headers["Content-Disposition"] = 'attachment; filename="orderhub-data.json"'
        return 200, {"orders": db.get_orders(), "inventory": db.get_inventory()}, headers

    # ---------------- POST ----------------
    if method == "POST" and path == "/api/orders/bulk-sync":
        return 200, {"ok": True, **order_service.bulk_sync()}, headers

    m = re.fullmatch(r"/api/orders/" + _ID + r"/sync", path)
    if method == "POST" and m:
        try:
            order = order_service.sync_order(m.group(1))
        except KeyError as exc:
            raise ApiError(404, str(exc))
        except ValueError as exc:
            raise ApiError(409, str(exc))
        return 200, {
            "ok": True,
            "order": order,
            "inventory": db.get_inventory(),
            "syncLogs": db.get_sync_logs(),
        }, headers

    if method == "POST" and path == "/api/sync/full":
        return 200, {"ok": True, **sync_service.run_full_sync()}, headers

    m = re.fullmatch(r"/api/platforms/" + _ID + r"/toggle", path)
    if method == "POST" and m:
        platform = sync_service.toggle_platform(m.group(1))
        if platform is None:
            raise ApiError(404, "平台不存在")
        return 200, {"ok": True, "platform": platform}, headers

    m = re.fullmatch(r"/api/platforms/" + _ID + r"/sync", path)
    if method == "POST" and m:
        platform = sync_service.sync_platform(m.group(1))
        if platform is None:
            raise ApiError(404, "平台不存在")
        return 200, {
            "ok": True,
            "platform": platform,
            "syncLogs": db.get_sync_logs(),
        }, headers

    if method == "POST" and path == "/api/inventory/adjust":
        sku = str(body.get("sku", "")).strip()
        warehouse = str(body.get("warehouse", "")).strip()
        try:
            row = inv_service.adjust(
                sku=sku,
                warehouse=warehouse,
                qty=body.get("qty"),
                op=str(body.get("op", "")).lower(),
                inbound=bool(body.get("inbound", False)),
                remark=str(body.get("remark", "")),
            )
        except KeyError as exc:
            raise ApiError(404, str(exc))
        except ValueError as exc:
            raise ApiError(400, str(exc))
        return 200, {"ok": True, "inventory": row}, headers

    if method == "POST" and path == "/api/settings":
        updates = _settings_from_body(body)
        for key, value in updates.items():
            db.set_setting(key, value)
        return 200, {"ok": True, "settings": db.get_settings()}, headers

    if method == "POST" and path == "/api/data/reset":
        db.reset_db()
        return 200, {"ok": True, **db.snapshot()}, headers

    if method == "POST" and path == "/api/ai/chat":
        question = str(body.get("question", "")).strip()
        if not question:
            raise ApiError(400, "question 不能为空")
        messages = body.get("messages") or []
        if not isinstance(messages, list):
            raise ApiError(400, "messages 必须是数组")
        clean = [
            {"role": str(m.get("role", "user")), "content": str(m.get("content", ""))}
            for m in messages if isinstance(m, dict)
        ]
        return 200, ai_service.chat(question, clean), headers

    if method == "POST" and path == "/api/config":
        api_key = str(body.get("apiKey", ""))
        if body.get("keepKey") and not api_key:
            api_key = config.load_full()["apiKey"]
        result = config.save_config(
            base_url=str(body.get("baseUrl", "")),
            model=str(body.get("model", "")),
            api_key=api_key,
        )
        return 200, {"ok": True, **result}, headers

    raise ApiError(404, "接口不存在: " + path)
