"""订单服务：筛选、同步（扣库存 + 写日志）、批量同步。"""

from __future__ import annotations

import random
from typing import Any, Dict, List

from .. import database as db
from .sync import add_log


def get_orders(
    platform: str = "",
    status: str = "",
    sync: str = "",
    search: str = "",
) -> List[Dict[str, Any]]:
    """对应前端 `filteredOrders()` 的筛选逻辑。"""
    orders = db.get_orders()
    keyword = (search or "").lower()
    out = []
    for o in orders:
        if platform and o["platform"] != platform:
            continue
        if status and o["status"] != status:
            continue
        if sync and o["syncStatus"] != sync:
            continue
        if keyword:
            haystack = " ".join(
                [o["id"], o["customer"], o["platformOrder"]] + [i["sku"] for i in o["items"]]
            ).lower()
            if keyword not in haystack:
                continue
        out.append(o)
    return out


def get_order(order_id: str) -> Dict[str, Any] | None:
    return db.get_order(order_id)


def sync_order(order_id: str) -> Dict[str, Any]:
    """同步单个订单到 ERP。

    复刻前端 syncOrder：
      1. syncStatus -> success，failed/pending 状态归一化为 synced
      2. 写一条成功同步日志
      3. 按订单商品扣减对应仓库可用库存（下限 0）
    """
    with db.transaction() as tx:
        row = tx.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if row is None:
            raise KeyError(f"订单不存在: {order_id}")
        if row["sync_status"] == "success":
            raise ValueError("该订单已同步")

        new_status = row["status"]
        if new_status in ("failed", "pending"):
            new_status = "synced"
        tx.execute(
            "UPDATE orders SET sync_status='success', status=? WHERE id=?",
            (new_status, order_id),
        )
        items = [
            dict(r) for r in tx.execute(
                "SELECT sku,qty FROM order_items WHERE order_id=? ORDER BY id", (order_id,)
            ).fetchall()
        ]
        warehouse = row["warehouse"]

    # 库存扣减（与前端一致：可用量不低于 0）
    with db.transaction() as tx:
        for it in items:
            tx.execute(
                "UPDATE inventory SET available=MAX(0, available - ?) "
                "WHERE sku=? AND warehouse=?",
                (it["qty"], it["sku"], warehouse),
            )

    short_id = order_id[-8:]
    add_log(
        platform=db.query_one("SELECT platform FROM orders WHERE id=?", (order_id,))["platform"],
        type_="订单同步",
        records=1,
        status="success",
        duration=round(random.random() * 2 + 0.4, 1),
        message=f"订单 {short_id} 推送 ERP 成功",
    )
    return db.get_order(order_id)


def bulk_sync() -> Dict[str, Any]:
    """批量同步所有非 success 订单（对应前端 bulkSync）。"""
    pending = db.query("SELECT id FROM orders WHERE sync_status != 'success' ORDER BY sort_order")
    succeeded: List[str] = []
    errors: List[Dict[str, str]] = []
    for row in pending:
        try:
            sync_order(row["id"])
            succeeded.append(row["id"])
        except (KeyError, ValueError) as exc:
            errors.append({"id": row["id"], "error": str(exc)})
    return {"submitted": len(pending), "succeeded": len(succeeded), "errors": errors}
