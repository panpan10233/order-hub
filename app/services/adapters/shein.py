"""SHEIN 适配器骨架。

TODO: 实现卖家平台授权与订单 / 商品接口对接（以实际开放平台文档为准）。
"""

from .base import BaseAdapter


class SheinAdapter(BaseAdapter):
    platform_id = "shein"
    name = "SHEIN"
    docs = "https://open.shein.com/"
