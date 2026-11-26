"""数据模型（dataclass）。

与前端 state 中的对象形状一一对应，字段顺序也保持一致，
便于序列化后直接交给前端渲染函数使用。
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class Platform:
    id: str
    name: str
    short: str
    color: str
    region: str
    connected: bool = False
    lastSync: Optional[str] = None
    autoSync: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Product:
    sku: str
    name: str
    cat: str
    price: float
    cost: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Warehouse:
    id: str
    name: str
    code: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class OrderItem:
    sku: str
    name: str
    qty: int
    price: float
    cat: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Order:
    id: str
    platform: str
    platformOrder: str
    customer: str
    country: str
    items: List[OrderItem] = field(default_factory=list)
    amount: float = 0.0
    currency: str = "USD"
    status: str = "pending"
    syncStatus: str = "pending"
    time: str = ""
    warehouse: str = "sz"

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["items"] = [i.to_dict() if isinstance(i, OrderItem) else i for i in self.items]
        return d


@dataclass
class Inventory:
    sku: str
    name: str
    cat: str
    warehouse: str
    available: int
    reserved: int
    inbound: int
    safety: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SyncLog:
    id: str
    time: str
    platform: str
    type: str
    records: int
    status: str
    duration: float
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Settings:
    interval: int = 15
    autoSync: bool = True
    emailAlert: bool = True
    lowStockThreshold: bool = True
    retry: int = 3
    currency: str = "USD"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ERP:
    connected: bool = True
    name: str = "金蝶云星空 ERP"
    lastSync: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
