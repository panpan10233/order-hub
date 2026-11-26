"""SQLite 持久化层。

- 数据库文件：``app/data/orderhub.db``（WAL 模式）
- 单连接 + RLock 保证多线程 HTTP 请求下的线程安全
- 种子数据严格按前端 ``defaultState()`` 的随机调用顺序生成，
  保证 168 条订单 / 约 40 条库存 / 26 条同步日志与前端一致
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Sequence

from .catalog import (
    DEFAULT_CONNECTED_COUNT,
    DEFAULT_ERP,
    DEFAULT_SETTINGS,
    LAST,
    PLATFORM_DEFS,
    PRODUCTS,
    SAFETY_STOCK,
    SYNC_LOG_NOTES,
    SYNC_LOG_TYPES,
    COUNTRIES,
    FIRST,
    WAREHOUSES,
)
from .rng import DEFAULT_SEED, rng

DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = DATA_DIR / "orderhub.db"

DB_LOCK = threading.RLock()
_conn: sqlite3.Connection | None = None


# --------------------------------------------------------------------------- #
# 日期工具（复刻前端 daysAgo / fmtDate / toISOString）
# --------------------------------------------------------------------------- #
def days_ago(n: int, h: int = 10, m: int = 0) -> datetime:
    """对应前端 `new Date(); setDate(-n); setHours(h,m,0,0)`。"""
    d = datetime.now() - timedelta(days=n)
    return d.replace(hour=h % 24, minute=m % 60, second=0, microsecond=0)


def to_iso(d: datetime) -> str:
    """对应前端 `Date.toISOString()`：本地时间转 UTC，保留毫秒并带 Z。"""
    aware = d.astimezone()
    utc = aware.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


def fmt_date(d: datetime, with_time: bool = False) -> str:
    """对应前端 `fmtDate`：使用本地时区字段。"""
    base = d.strftime("%Y-%m-%d")
    return base + d.strftime(" %H:%M") if with_time else base


def now_iso() -> str:
    return to_iso(datetime.now())


# --------------------------------------------------------------------------- #
# 种子数据生成（顺序敏感：platforms -> orders -> inventory -> syncLogs）
# --------------------------------------------------------------------------- #
def gen_platforms() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, p in enumerate(PLATFORM_DEFS):
        connected = i < DEFAULT_CONNECTED_COUNT
        last_sync = to_iso(days_ago(0, rng.ri(8, 19), rng.ri(0, 59))) if connected else None
        out.append({
            "id": p["id"],
            "name": p["name"],
            "short": p["short"],
            "color": p["color"],
            "region": p["region"],
            "connected": connected,
            "lastSync": last_sync,
            "autoSync": connected,
        })
    return out


def gen_orders(n: int = 168) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i in range(n):
        pf = rng.pick(PLATFORM_DEFS[:DEFAULT_CONNECTED_COUNT])
        items_count = 1 if rng.rnd() < 0.72 else 2
        items: List[Dict[str, Any]] = []
        for _ in range(items_count):
            p = rng.pick(PRODUCTS)
            if any(x["sku"] == p["sku"] for x in items):
                continue
            items.append({
                "sku": p["sku"],
                "name": p["name"],
                "qty": 2 if rng.rnd() < 0.2 else 1,
                "price": p["price"],
                "cat": p["cat"],
            })
        amount = round(sum(x["price"] * x["qty"] for x in items), 2)
        roll = rng.rnd()
        status = (
            "pending" if roll < 0.16 else
            "synced" if roll < 0.46 else
            "shipped" if roll < 0.72 else
            "completed" if roll < 0.95 else
            "failed"
        )
        sync_status = "pending" if status == "pending" else "failed" if status == "failed" else "success"
        day = int(pow(rng.rnd(), 1.6) * 24)
        d = days_ago(day, rng.ri(8, 22), rng.ri(0, 59))
        out.append({
            "id": f"PO-{fmt_date(d).replace('-', '')}-{i + 1:04d}",
            "platform": pf["id"],
            "platformOrder": f"{pf['short'][:2].lower()}-{rng.ri(1000000, 9999999)}",
            "customer": f"{rng.pick(FIRST)} {rng.pick(LAST)[0]}.",
            "country": rng.pick(COUNTRIES),
            "items": items,
            "amount": amount,
            "currency": "USD",
            "status": status,
            "syncStatus": sync_status,
            "time": to_iso(d),
            "warehouse": rng.pick(WAREHOUSES)["id"],
        })
    out.sort(key=lambda o: o["time"], reverse=True)
    return out


def gen_inventory() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for pi, p in enumerate(PRODUCTS):
        for wi, w in enumerate(WAREHOUSES):
            if (pi + wi) % 3 == 2:
                continue  # 稀疏铺货
            avail = rng.ri(0, 620)
            if pi % 4 == 0 and wi == 3:
                avail = rng.ri(0, 28)  # 部分低库存
            out.append({
                "sku": p["sku"],
                "name": p["name"],
                "cat": p["cat"],
                "warehouse": w["id"],
                "available": avail,
                "reserved": rng.ri(0, 45),
                "inbound": rng.ri(0, 200),
                "safety": SAFETY_STOCK[wi],
            })
    return out


def gen_sync_logs(n: int = 26) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i in range(n):
        pf = rng.pick(PLATFORM_DEFS)
        typ = rng.pick(SYNC_LOG_TYPES)
        roll = rng.rnd()
        status = "success" if roll < 0.82 else "partial" if roll < 0.93 else "failed"
        d = days_ago(0, 20, rng.ri(0, 59))
        d -= timedelta(minutes=i * rng.ri(18, 95))
        # 注意：前端对象字面量按 records -> duration -> message 的顺序求值，
        # message 的 pick() 必须在最后消耗随机数。
        records = rng.ri(12, 460)
        duration = round(rng.rnd() * 9 + 0.8, 1)
        if status == "failed":
            message = "API 限流 429，任务重试 2 次后失败" if typ == "订单同步" else "目标 ERP 接口返回超时"
        elif status == "partial":
            message = "部分记录字段校验未通过，已跳过"
        else:
            message = rng.pick(SYNC_LOG_NOTES[typ])
        out.append({
            "id": f"SY-{i + 1:05d}",
            "time": to_iso(d),
            "platform": pf["id"],
            "type": typ,
            "records": records,
            "status": status,
            "duration": duration,
            "message": message,
        })
    return out


# --------------------------------------------------------------------------- #
# 连接管理
# --------------------------------------------------------------------------- #
def connect() -> sqlite3.Connection:
    global _conn
    with DB_LOCK:
        if _conn is not None:
            return _conn
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA synchronous=NORMAL")
        _conn.execute("PRAGMA busy_timeout=30000")
        return _conn


def close() -> None:
    global _conn
    with DB_LOCK:
        if _conn is not None:
            try:
                _conn.commit()
            finally:
                _conn.close()
                _conn = None


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """获取连接与锁的事务上下文，异常时自动回滚。"""
    conn = connect()
    with DB_LOCK:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def query(sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    conn = connect()
    with DB_LOCK:
        cur = conn.execute(sql, tuple(params))
        return [dict(row) for row in cur.fetchall()]


def query_one(sql: str, params: Sequence[Any] = ()) -> Dict[str, Any] | None:
    conn = connect()
    with DB_LOCK:
        cur = conn.execute(sql, tuple(params))
        row = cur.fetchone()
        return dict(row) if row is not None else None


def execute(sql: str, params: Sequence[Any] = ()) -> None:
    conn = connect()
    with DB_LOCK:
        conn.execute(sql, tuple(params))
        conn.commit()


SCHEMA = """
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short TEXT NOT NULL,
  color TEXT NOT NULL,
  region TEXT NOT NULL,
  connected INTEGER NOT NULL DEFAULT 0,
  last_sync TEXT,
  auto_sync INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cat TEXT NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_order TEXT NOT NULL,
  customer TEXT NOT NULL,
  country TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  sync_status TEXT NOT NULL,
  time TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_time ON orders(time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price REAL NOT NULL,
  cat TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS inventory (
  sku TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  name TEXT NOT NULL,
  cat TEXT NOT NULL,
  available INTEGER NOT NULL,
  reserved INTEGER NOT NULL,
  inbound INTEGER NOT NULL,
  safety INTEGER NOT NULL,
  PRIMARY KEY (sku, warehouse)
);
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  time TEXT NOT NULL,
  platform TEXT NOT NULL,
  type TEXT NOT NULL,
  records INTEGER NOT NULL,
  status TEXT NOT NULL,
  duration REAL NOT NULL,
  message TEXT NOT NULL,
  seq INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS erp (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  connected INTEGER NOT NULL,
  name TEXT NOT NULL,
  last_sync TEXT
);
"""


def _seed(conn: sqlite3.Connection) -> None:
    """按前端随机调用顺序重新播种全部表。"""
    rng.reset(DEFAULT_SEED)

    # 1) platforms（消耗 6 组 ri 随机数）
    platforms = gen_platforms()
    for idx, p in enumerate(platforms):
        conn.execute(
            "INSERT INTO platforms (id,name,short,color,region,connected,last_sync,auto_sync,sort_order) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (p["id"], p["name"], p["short"], p["color"], p["region"],
             int(p["connected"]), p["lastSync"], int(p["autoSync"]), idx),
        )

    # 2) static catalog
    for idx, p in enumerate(PRODUCTS):
        conn.execute(
            "INSERT INTO products (sku,name,cat,price,cost,sort_order) VALUES (?,?,?,?,?,?)",
            (p["sku"], p["name"], p["cat"], p["price"], p["cost"], idx),
        )
    for idx, w in enumerate(WAREHOUSES):
        conn.execute(
            "INSERT INTO warehouses (id,name,code,sort_order) VALUES (?,?,?,?)",
            (w["id"], w["name"], w["code"], idx),
        )

    # 3) orders（必须与前端 genOrders 调用顺序一致）
    orders = gen_orders(168)
    for idx, o in enumerate(orders):
        conn.execute(
            "INSERT INTO orders (id,platform,platform_order,customer,country,amount,currency,status,sync_status,time,warehouse,sort_order) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (o["id"], o["platform"], o["platformOrder"], o["customer"], o["country"],
             o["amount"], o["currency"], o["status"], o["syncStatus"], o["time"],
             o["warehouse"], idx),
        )
        for it in o["items"]:
            conn.execute(
                "INSERT INTO order_items (order_id,sku,name,qty,price,cat) VALUES (?,?,?,?,?,?)",
                (o["id"], it["sku"], it["name"], it["qty"], it["price"], it["cat"]),
            )

    # 4) inventory
    for row in gen_inventory():
        conn.execute(
            "INSERT INTO inventory (sku,warehouse,name,cat,available,reserved,inbound,safety) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (row["sku"], row["warehouse"], row["name"], row["cat"],
             row["available"], row["reserved"], row["inbound"], row["safety"]),
        )

    # 5) syncLogs
    for idx, log in enumerate(gen_sync_logs(26)):
        conn.execute(
            "INSERT INTO sync_logs (id,time,platform,type,records,status,duration,message,seq) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (log["id"], log["time"], log["platform"], log["type"], log["records"],
             log["status"], log["duration"], log["message"], idx),
        )

    # 6) settings（无随机消耗）
    for key, value in DEFAULT_SETTINGS.items():
        conn.execute(
            "INSERT INTO settings (key,value) VALUES (?,?)",
            (key, json.dumps(value, ensure_ascii=False)),
        )

    # 7) erp（无随机消耗）
    conn.execute(
        "INSERT INTO erp (id,connected,name,last_sync) VALUES (1,?,?,?)",
        (int(DEFAULT_ERP["connected"]), DEFAULT_ERP["name"], to_iso(days_ago(0, 9, 32))),
    )


def init_db(force_reset: bool = False) -> None:
    """建表并在空库时播种；force_reset=True 时清库重播。"""
    conn = connect()
    with transaction() as tx:
        tx.executescript(SCHEMA)
        count = tx.execute("SELECT COUNT(*) AS n FROM orders").fetchone()["n"]
        if force_reset or count == 0:
            for table in (
                "order_items", "orders", "inventory", "sync_logs",
                "platforms", "products", "warehouses", "settings", "erp",
            ):
                tx.execute(f"DELETE FROM {table}")
            _seed(tx)


def reset_db() -> None:
    """重新播种（对应前端「重置演示数据」）。"""
    init_db(force_reset=True)


# --------------------------------------------------------------------------- #
# 读取接口
# --------------------------------------------------------------------------- #
def get_platforms() -> List[Dict[str, Any]]:
    rows = query("SELECT * FROM platforms ORDER BY sort_order")
    return [{
        "id": r["id"], "name": r["name"], "short": r["short"], "color": r["color"],
        "region": r["region"], "connected": bool(r["connected"]),
        "lastSync": r["last_sync"], "autoSync": bool(r["auto_sync"]),
    } for r in rows]


def get_products() -> List[Dict[str, Any]]:
    return query("SELECT sku,name,cat,price,cost FROM products ORDER BY sort_order")


def get_warehouses() -> List[Dict[str, Any]]:
    return query("SELECT id,name,code FROM warehouses ORDER BY sort_order")


def get_orders() -> List[Dict[str, Any]]:
    rows = query("SELECT * FROM orders ORDER BY sort_order")
    if not rows:
        return []
    ids = [r["id"] for r in rows]
    placeholders = ",".join("?" for _ in ids)
    items = query(
        f"SELECT order_id,sku,name,qty,price,cat FROM order_items WHERE order_id IN ({placeholders}) "
        "ORDER BY id",
        ids,
    )
    grouped: Dict[str, List[Dict[str, Any]]] = {i: [] for i in ids}
    for it in items:
        grouped[it["order_id"]].append({
            "sku": it["sku"], "name": it["name"], "qty": it["qty"],
            "price": it["price"], "cat": it["cat"],
        })
    return [{
        "id": r["id"], "platform": r["platform"], "platformOrder": r["platform_order"],
        "customer": r["customer"], "country": r["country"], "items": grouped[r["id"]],
        "amount": r["amount"], "currency": r["currency"], "status": r["status"],
        "syncStatus": r["sync_status"], "time": r["time"], "warehouse": r["warehouse"],
    } for r in rows]


def get_order(order_id: str) -> Dict[str, Any] | None:
    return next((o for o in get_orders() if o["id"] == order_id), None)


def get_inventory() -> List[Dict[str, Any]]:
    return query(
        "SELECT sku,name,cat,warehouse,available,reserved,inbound,safety FROM inventory "
        "ORDER BY rowid"
    )


def get_sync_logs() -> List[Dict[str, Any]]:
    # seq 越小越新：初始种子 i=0 最新，后续 unshift 的新日志使用更小的 seq
    rows = query("SELECT * FROM sync_logs ORDER BY seq ASC")
    return [{
        "id": r["id"], "time": r["time"], "platform": r["platform"], "type": r["type"],
        "records": r["records"], "status": r["status"], "duration": r["duration"],
        "message": r["message"],
    } for r in rows]


def get_settings() -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for r in query("SELECT key,value FROM settings"):
        try:
            out[r["key"]] = json.loads(r["value"])
        except (ValueError, TypeError):
            out[r["key"]] = r["value"]
    return out


def set_setting(key: str, value: Any) -> None:
    execute(
        "INSERT INTO settings (key,value) VALUES (?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, json.dumps(value, ensure_ascii=False)),
    )


def get_erp() -> Dict[str, Any]:
    r = query_one("SELECT connected,name,last_sync FROM erp WHERE id=1")
    if r is None:
        return {"connected": True, "name": DEFAULT_ERP["name"], "lastSync": None}
    return {"connected": bool(r["connected"]), "name": r["name"], "lastSync": r["last_sync"]}


def snapshot() -> Dict[str, Any]:
    """一次性返回前端需要的全部状态。"""
    from .config import public_config
    return {
        "platforms": get_platforms(),
        "orders": get_orders(),
        "inventory": get_inventory(),
        "syncLogs": get_sync_logs(),
        "settings": get_settings(),
        "erp": get_erp(),
        "products": get_products(),
        "warehouses": get_warehouses(),
        "ai": public_config(),
    }
