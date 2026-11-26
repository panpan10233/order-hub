"""库存服务：出入库调整与低库存查询。"""

from __future__ import annotations

from typing import Any, Dict, List

from .. import database as db


def get_inventory() -> List[Dict[str, Any]]:
    return db.get_inventory()


def low_stock(include_zero_only: bool = False) -> List[Dict[str, Any]]:
    rows = [i for i in db.get_inventory() if i["available"] < i["safety"]]
    if include_zero_only:
        rows = [i for i in rows if i["available"] == 0]
    return rows


def adjust(
    sku: str,
    warehouse: str,
    qty: int,
    op: str = "in",
    inbound: bool = False,
    remark: str = "",
) -> Dict[str, Any]:
    """库存入库 / 出库。

    对应前端 stockOpModal 的确认逻辑：
      - 入库：available += qty，同时 inbound -= qty（下限 0）
      - 出库：available -= qty（下限 0）
    `op` 为 'in'/'out'；当 op 缺省时按 `inbound` 布尔值判定。
    """
    try:
        qty = int(qty)
    except (TypeError, ValueError):
        raise ValueError("请输入有效数量")
    if qty <= 0:
        raise ValueError("请输入有效数量")

    is_in = (op or "").lower() == "in" if op else bool(inbound)
    row = db.query_one(
        "SELECT * FROM inventory WHERE sku=? AND warehouse=?", (sku, warehouse)
    )
    if row is None:
        raise KeyError("该 SKU 在此仓库不存在，请先新增库存记录")

    available = max(0, row["available"] + (qty if is_in else -qty))
    inbound_qty = row["inbound"]
    if is_in:
        inbound_qty = max(0, inbound_qty - qty)

    with db.transaction() as tx:
        tx.execute(
            "UPDATE inventory SET available=?, inbound=? WHERE sku=? AND warehouse=?",
            (available, inbound_qty, sku, warehouse),
        )
    return db.query_one(
        "SELECT sku,name,cat,warehouse,available,reserved,inbound,safety "
        "FROM inventory WHERE sku=? AND warehouse=?",
        (sku, warehouse),
    )
