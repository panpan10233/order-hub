"""AliExpress（速卖通）适配器骨架。

TODO: 实现淘宝开放平台 OAuth、订单查询 / 明细接口与字段映射。
"""

from .base import BaseAdapter


class AliExpressAdapter(BaseAdapter):
    platform_id = "aliexpress"
    name = "AliExpress"
    docs = "https://developers.aliexpress.com/"
