"""静态参考数据：平台、商品、仓库、国家与姓名池。

逐项复刻前端 app.js 的 PLATFORM_DEFS / PRODUCTS / WAREHOUSES /
COUNTRIES / FIRST / LAST / ORDER_STATUS / SYNC_STATUS。
"""

PLATFORM_DEFS = [
    {"id": "amazon", "name": "Amazon", "short": "AZ", "color": "#232f3e", "region": "美国 / 欧洲 / 日本站"},
    {"id": "tiktok", "name": "TikTok Shop", "short": "TT", "color": "#111827", "region": "美国 / 东南亚 / 英国"},
    {"id": "aliexpress", "name": "AliExpress", "short": "AE", "color": "#e62e04", "region": "全球 200+ 国家"},
    {"id": "shein", "name": "SHEIN", "short": "SH", "color": "#000000", "region": "全球 / 快时尚类目"},
    {"id": "temu", "name": "Temu", "short": "TM", "color": "#f4511e", "region": "北美 / 欧洲"},
    {"id": "shopee", "name": "Shopee", "short": "SP", "color": "#ee4d2d", "region": "东南亚 / 拉美"},
    {"id": "ebay", "name": "eBay", "short": "EB", "color": "#e53238", "region": "全球站点"},
    {"id": "walmart", "name": "Walmart", "short": "WM", "color": "#0071ce", "region": "美国站"},
]

# 默认接入前 6 个平台
DEFAULT_CONNECTED_COUNT = 6

PRODUCTS = [
    {"sku": "EH-1001", "name": "TWS 无线蓝牙耳机 Pro", "cat": "3C数码", "price": 39.9, "cost": 16},
    {"sku": "HM-2043", "name": "便携智能保温杯 500ml", "cat": "家居生活", "price": 22.5, "cost": 8.5},
    {"sku": "FA-3310", "name": "折叠便携补光灯", "cat": "摄影配件", "price": 18.9, "cost": 6.2},
    {"sku": "EL-1188", "name": "迷你蓝牙音箱 RGB", "cat": "3C数码", "price": 28.0, "cost": 11},
    {"sku": "AP-4021", "name": "硅胶手机支架 磁吸款", "cat": "手机配件", "price": 9.9, "cost": 2.8},
    {"sku": "CL-5520", "name": "女士防晒冰袖套装", "cat": "服饰", "price": 12.9, "cost": 4.1},
    {"sku": "KT-2091", "name": "宠物自动饮水机", "cat": "宠物用品", "price": 45.0, "cost": 19},
    {"sku": "HM-7788", "name": "多功能收纳盒 三件套", "cat": "家居生活", "price": 16.5, "cost": 5.6},
    {"sku": "EL-6602", "name": "65W 氮化镓充电器", "cat": "3C数码", "price": 34.9, "cost": 14},
    {"sku": "SP-8830", "name": "瑜伽弹力带 5件套", "cat": "运动户外", "price": 14.9, "cost": 4.8},
    {"sku": "AP-1204", "name": "车载手机无线充电器", "cat": "汽车配件", "price": 25.9, "cost": 9.5},
    {"sku": "FA-9011", "name": "旅行洗漱收纳包", "cat": "箱包", "price": 19.9, "cost": 7},
]

COUNTRIES = [
    "美国", "英国", "德国", "法国", "日本", "加拿大",
    "澳大利亚", "新加坡", "马来西亚", "巴西", "西班牙", "意大利",
]

FIRST = [
    "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan",
    "Sophia", "Lucas", "Mia", "Logan", "Isla", "Elijah", "Amelia",
]

LAST = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia",
    "Miller", "Davis", "Wilson", "Anderson", "Taylor", "Moore",
]

WAREHOUSES = [
    {"id": "sz", "name": "深圳保税仓", "code": "CN-SZ"},
    {"id": "gz", "name": "广州白云仓", "code": "CN-GZ"},
    {"id": "yw", "name": "义乌中心仓", "code": "CN-YW"},
    {"id": "la", "name": "洛杉矶海外仓", "code": "US-LA"},
    {"id": "de", "name": "德国汉堡海外仓", "code": "DE-HH"},
]

# 仓库索引 3（洛杉矶海外仓）的安全库存数值序列，前端 `[80,120,60,90,50][wi]`
SAFETY_STOCK = [80, 120, 60, 90, 50]

ORDER_STATUS = {
    "pending": {"label": "待同步", "cls": "tag-warning"},
    "synced": {"label": "已同步ERP", "cls": "tag-info"},
    "shipped": {"label": "已发货", "cls": "tag-purple"},
    "completed": {"label": "已完成", "cls": "tag-success"},
    "failed": {"label": "同步失败", "cls": "tag-danger"},
}

SYNC_STATUS = {
    "pending": {"label": "待同步", "cls": "tag-warning"},
    "success": {"label": "同步成功", "cls": "tag-success"},
    "failed": {"label": "同步失败", "cls": "tag-danger"},
}

SYNC_LOG_TYPES = ["订单同步", "库存回写", "物流状态同步", "平台商品同步"]

SYNC_LOG_NOTES = {
    "订单同步": ["增量拉取新订单并写入中间库", "按平台分页拉取近 24h 订单"],
    "库存回写": ["将 ERP 可用库存推送至各平台", "同步仓库可用量到海外仓"],
    "物流状态同步": ["拉取平台物流轨迹并回写 ERP", "同步发货状态与运单号"],
    "平台商品同步": ["同步平台 SKU 与本地商品映射", "更新商品标题与类目映射"],
}

DEFAULT_SETTINGS = {
    "interval": 15,
    "autoSync": True,
    "emailAlert": True,
    "lowStockThreshold": True,
    "retry": 3,
    "currency": "USD",
}

DEFAULT_ERP = {
    "connected": True,
    "name": "金蝶云星空 ERP",
}

PRODUCT_BY_SKU = {p["sku"]: p for p in PRODUCTS}
WAREHOUSE_BY_ID = {w["id"]: w for w in WAREHOUSES}
PLATFORM_BY_ID = {p["id"]: p for p in PLATFORM_DEFS}


def warehouse_name(warehouse_id: str) -> str:
    wh = WAREHOUSE_BY_ID.get(warehouse_id)
    return wh["name"] if wh else warehouse_id
