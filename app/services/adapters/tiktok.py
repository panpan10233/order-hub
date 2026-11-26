"""TikTok Shop 适配器骨架。

TODO: 实现 OAuth 授权、订单列表 / 详情 / 履约接口分页拉取。
参考文档：partner.tiktokshop.com/docv2/page/get-authorized-category-assets-202405
"""

from .base import BaseAdapter


class TikTokAdapter(BaseAdapter):
    platform_id = "tiktok"
    name = "TikTok Shop"
    docs = "https://partner.tiktokshop.com/docv2/page/get-authorized-category-assets-202405"
