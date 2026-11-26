"""Amazon SP-API 适配器骨架。

TODO: 实现 SP-API LWA 令牌刷新、getOrders / getOrderItems 分页拉取、
      SKU 映射与错误重试。凭证需由部署方自行配置。
"""

from .base import BaseAdapter


class AmazonAdapter(BaseAdapter):
    platform_id = "amazon"
    name = "Amazon"
    docs = "https://developer-docs.amazon.com/sp-api/"
