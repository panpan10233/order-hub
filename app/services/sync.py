"""同步日志与全量同步服务。"""

from __future__ import annotations

import random
import time
from typing import Any, Dict, List

from .. import database as db


def new_log_id() -> str:
    """对应前端 `SY-${Date.now().toString().slice(-5)}`。"""
    return "SY-" + str(int(time.time() * 1000))[-5:]


def add_log(
    platform: str,
    type_: str,
    records: int,
    status: str,
    duration: float,
    message: str,
    log_id: str | None = None,
) -> Dict[str, Any]:
    """向同步日志头部插入一条记录（对应前端 `state.syncLogs.unshift`）。"""
    entry = {
        "id": log_id or new_log_id(),
        "time": db.now_iso(),
        "platform": platform,
        "type": type_,
        "records": int(records),
        "status": status,
        "duration": round(float(duration), 1),
        "message": message,
    }
    with db.transaction() as tx:
        row = tx.execute("SELECT COALESCE(MIN(seq), 1) AS m FROM sync_logs").fetchone()
        seq = int(row["m"]) - 1
        tx.execute(
            "INSERT OR REPLACE INTO sync_logs (id,time,platform,type,records,status,duration,message,seq) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (entry["id"], entry["time"], entry["platform"], entry["type"],
             entry["records"], entry["status"], entry["duration"], entry["message"], seq),
        )
    return entry


def get_logs() -> List[Dict[str, Any]]:
    return db.get_sync_logs()


def run_full_sync() -> Dict[str, Any]:
    """全量同步：新增成功日志 + 更新所有已接入平台与 ERP 的 lastSync。"""
    n = random.randint(28, 96)
    duration = round(random.random() * 5 + 2, 1)
    entry = add_log(
        platform="amazon",
        type_="订单同步",
        records=n,
        status="success",
        duration=duration,
        message=f"全量同步完成，成功处理 {n} 条订单",
    )
    now = db.now_iso()
    with db.transaction() as tx:
        tx.execute("UPDATE platforms SET last_sync=? WHERE connected=1", (now,))
        tx.execute("UPDATE erp SET last_sync=? WHERE id=1", (now,))
    return {"log": entry, "records": n, "platforms": db.get_platforms(), "erp": db.get_erp()}


def toggle_platform(platform_id: str) -> Dict[str, Any] | None:
    """切换平台接入状态；接入时同步更新时间。"""
    p = db.query_one("SELECT * FROM platforms WHERE id=?", (platform_id,))
    if p is None:
        return None
    connected = not bool(p["connected"])
    last_sync = p["last_sync"]
    if connected:
        last_sync = db.now_iso()
    with db.transaction() as tx:
        tx.execute(
            "UPDATE platforms SET connected=?, last_sync=? WHERE id=?",
            (int(connected), last_sync, platform_id),
        )
    return next(x for x in db.get_platforms() if x["id"] == platform_id)


def sync_platform(platform_id: str) -> Dict[str, Any] | None:
    """单平台增量同步：更新时间 + 写成功日志。"""
    p = db.query_one("SELECT id,name,connected FROM platforms WHERE id=?", (platform_id,))
    if p is None:
        return None
    now = db.now_iso()
    with db.transaction() as tx:
        tx.execute("UPDATE platforms SET last_sync=? WHERE id=?", (now, platform_id))
    records = random.randint(12, 88)
    add_log(
        platform=platform_id,
        type_="订单同步",
        records=records,
        status="success",
        duration=round(random.random() * 4 + 1, 1),
        message=f"{p['name']} 增量订单同步完成",
    )
    return next(x for x in db.get_platforms() if x["id"] == platform_id)
