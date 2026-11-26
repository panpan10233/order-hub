"""分析服务：核心指标、趋势、平台分布、热销商品与毛利。"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Any, Dict, List

from .. import database as db
from ..catalog import PLATFORM_DEFS, PRODUCTS

PRODUCT_COST = {p["sku"]: p["cost"] for p in PRODUCTS}


def _local_date(iso: str) -> datetime:
    """将 UTC ISO 时间转换为本地 datetime（对应前端 `new Date(iso)` 的本地取值）。"""
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone()
    except (ValueError, TypeError):
        return datetime.now()


def _js_round(value: float) -> int:
    """JS Math.round 的正数语义（四舍五入，.5 向上）。"""
    return int(value + 0.5)


def metrics() -> Dict[str, Any]:
    orders = db.get_orders()
    today = datetime.now().strftime("%Y-%m-%d")
    month_prefix = today[:7]
    today_orders = [o for o in orders if _local_date(o["time"]).strftime("%Y-%m-%d") == today]
    month_orders = [o for o in orders if _local_date(o["time"]).strftime("%Y-%m") == month_prefix]
    inventory = db.get_inventory()
    return {
        "todayOrders": len(today_orders),
        "monthOrders": len(month_orders),
        "gmv": round(sum(o["amount"] for o in month_orders), 2),
        "pending": sum(1 for o in orders if o["syncStatus"] == "pending"),
        "failed": sum(1 for o in orders if o["syncStatus"] == "failed"),
        "lowStock": sum(1 for i in inventory if i["available"] < i["safety"]),
    }


def trend_data(days: int = 14) -> Dict[str, Any]:
    orders = db.get_orders()
    labels: List[str] = []
    orders_arr: List[int] = []
    gmv_arr: List[int] = []
    now = datetime.now()
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        labels.append(f"{d.month}/{d.day}")
        daily = [o for o in orders if _local_date(o["time"]).strftime("%Y-%m-%d") == key]
        orders_arr.append(len(daily))
        gmv_arr.append(_js_round(sum(o["amount"] for o in daily)))
    return {"labels": labels, "ordersArr": orders_arr, "gmvArr": gmv_arr}


def platform_counts() -> List[Dict[str, Any]]:
    orders = db.get_orders()
    platforms = db.get_platforms()
    out: List[Dict[str, Any]] = []
    for idx, p in enumerate(platforms):
        count = sum(1 for o in orders if o["platform"] == p["id"])
        out.append({
            "id": p["id"],
            "label": p["name"],
            "color": "#475569" if p["color"] == "#000000" else p["color"],
            "count": count,
            "value": count + random.randint(20, 60),
            "connected": p["connected"],
        })
    return out


def top_products(limit: int = 6) -> List[Dict[str, Any]]:
    orders = db.get_orders()
    out: List[Dict[str, Any]] = []
    for i, p in enumerate(PRODUCTS[:limit]):
        count = sum(1 for o in orders if any(it["sku"] == p["sku"] for it in o["items"]))
        out.append({
            "sku": p["sku"],
            "label": p["name"][:9],
            "name": p["name"],
            "count": count,
            "value": count * random.randint(2, 8) + 40 - i * 4,
        })
    return out


def gross_margin() -> float:
    """对应前端「经营指标摘要」中的毛利率百分比。"""
    orders = db.get_orders()
    m = metrics()
    gmv = m["gmv"]
    if not gmv:
        return 0.0
    month_prefix = datetime.now().strftime("%Y-%m")
    month_orders = [o for o in orders if _local_date(o["time"]).strftime("%Y-%m") == month_prefix]
    cost = sum(
        PRODUCT_COST.get(it["sku"], 0) * it["qty"]
        for o in month_orders for it in o["items"]
    )
    return round((1 - cost / gmv) * 100, 1)


def summary() -> Dict[str, Any]:
    return {
        "metrics": metrics(),
        "trend": trend_data(14),
        "platformCounts": platform_counts(),
        "topProducts": top_products(6),
        "grossMargin": gross_margin(),
    }
