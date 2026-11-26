"""平台适配器基类。

当前为工程骨架：未配置平台凭证时所有拉单方法返回空列表。
TODO(接入真实平台时)：在子类中实现签名鉴权、分页拉取、字段映射与限流重试。
"""

from __future__ import annotations

from typing import Any, Dict, List

from ... import database as db
from ...catalog import PLATFORM_BY_ID


class BaseAdapter:
    platform_id: str = ""
    name: str = ""
    docs: str = ""

    # 凭证不从环境变量或其他项目读取；留空即视为未配置。
    def credentials(self) -> Dict[str, str]:
        return {}

    def configured(self) -> bool:
        creds = self.credentials()
        return bool(creds) and all(creds.values())

    def status(self) -> Dict[str, Any]:
        platform = next(
            (p for p in db.get_platforms() if p["id"] == self.platform_id),
            PLATFORM_BY_ID.get(self.platform_id, {}),
        )
        return {
            "id": self.platform_id,
            "name": self.name or platform.get("name", self.platform_id),
            "connected": bool(platform.get("connected", False)),
            "configured": self.configured(),
            "docs": self.docs,
            "message": (
                "凭证已配置，可对接真实平台 API" if self.configured()
                else "未配置凭证，使用内置演示数据（返回空批次）"
            ),
        }

    def fetch_orders(self, since: str | None = None) -> List[Dict[str, Any]]:
        """TODO: 实现真实平台订单拉取；未配置凭证时返回空列表。"""
        if not self.configured():
            return []
        return []
