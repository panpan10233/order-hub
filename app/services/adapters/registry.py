"""适配器注册表：集中管理已实现的平台适配器。"""

from __future__ import annotations

from typing import Dict, List

from .aliexpress import AliExpressAdapter
from .amazon import AmazonAdapter
from .base import BaseAdapter
from .shein import SheinAdapter
from .tiktok import TikTokAdapter

_REGISTRY: Dict[str, BaseAdapter] = {
    a.platform_id: a
    for a in (
        AmazonAdapter(),
        TikTokAdapter(),
        AliExpressAdapter(),
        SheinAdapter(),
    )
}


def all_adapters() -> List[BaseAdapter]:
    return list(_REGISTRY.values())


def get(platform_id: str) -> BaseAdapter | None:
    return _REGISTRY.get(platform_id)


def statuses() -> List[dict]:
    return [a.status() for a in all_adapters()]
