"""AI 助手服务：内置数据引擎（直读 DB）+ 可选 OpenAI 兼容大模型降级。

完全复刻前端 ``aiContext()`` 与 ``localAnswer()`` 的提示词、规则顺序和
回答文案；密钥只从服务端配置读取，绝不写入响应。
"""

from __future__ import annotations

import html
import json
import re
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Tuple

from .. import config, database as db
from ..catalog import PLATFORM_DEFS, PRODUCTS, warehouse_name


def money(value: float) -> str:
    return "$" + f"{value:,.2f}"


def fmt_num(value: int) -> str:
    return f"{value:,}"


def _bold(value: Any) -> str:
    return f"<b>{value}</b>"


def _local_dt(iso: str) -> datetime:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone()
    except (ValueError, TypeError):
        return datetime.now()


def time_ago(iso: str | None) -> str:
    """对应前端 `timeAgo(new Date(iso))`。"""
    if not iso:
        return "—"
    diff = (datetime.now().astimezone() - _local_dt(iso)).total_seconds() / 60
    if diff < 1:
        return "刚刚"
    if diff < 60:
        return f"{int(diff)} 分钟前"
    if diff < 1440:
        return f"{int(diff / 60)} 小时前"
    return f"{int(diff / 1440)} 天前"


def ai_context() -> str:
    """生成实时数据快照提示词（服务端直读 DB）。"""
    orders = db.get_orders()
    platforms = db.get_platforms()
    inventory = db.get_inventory()
    logs = db.get_sync_logs()
    erp = db.get_erp()

    today = datetime.now().strftime("%Y-%m-%d")
    month_prefix = today[:7]
    today_count = sum(1 for o in orders if _local_dt(o["time"]).strftime("%Y-%m-%d") == today)
    month_orders = [o for o in orders if _local_dt(o["time"]).strftime("%Y-%m") == month_prefix]
    gmv = sum(o["amount"] for o in month_orders)
    pending = sum(1 for o in orders if o["syncStatus"] == "pending")
    failed = sum(1 for o in orders if o["syncStatus"] == "failed")

    plat_counts = "、".join(
        f"{p['name']}:{sum(1 for o in orders if o['platform'] == p['id'])}"
        for p in platforms if p["connected"]
    )
    low = [i for i in inventory if i["available"] < i["safety"]]
    low_str = "、".join(
        f"{i['sku']}({warehouse_name(i['warehouse'])} 可用{i['available']}/安全{i['safety']})"
        for i in low[:5]
    )
    wh_stock = "、".join(
        f"{w['name']}:{sum(i['available'] for i in inventory if i['warehouse'] == w['id'])}"
        for w in db.get_warehouses()
    )
    total_avail = sum(i["available"] for i in inventory)
    ok_logs = sum(1 for l in logs if l["status"] == "success")
    fail_logs = sum(1 for l in logs if l["status"] == "failed")

    return (
        "你是电商多平台订单数据中台 OrderHub 的智能助手。以下是当前系统的实时数据快照，请基于这些数据准确回答用户问题，不要编造数据。金额单位 USD。\n"
        f"【订单】总数 {len(orders)}；今日 {today_count}；本月 {len(month_orders)}；本月GMV {gmv:.2f}；待同步 {pending}；同步失败 {failed}。\n"
        f"【平台订单】{plat_counts}。\n"
        f"【WMS库存】SKU {len(inventory)}；可用总量 {total_avail}；低库存/缺货 {len(low)} 个，示例：{low_str or '无'}。\n"
        f"【仓库库存】{wh_stock}。\n"
        f"【同步】近 {len(logs)} 次任务，成功 {ok_logs}，失败 {fail_logs}。\n"
        f"【ERP】{erp['name']}，{'已连接' if erp['connected'] else '已断开'}，最近同步 {time_ago(erp['lastSync'])}。\n"
        "回答要简洁、用中文、可用列表；涉及操作可提示用户到对应模块处理。"
    )


def local_answer(question: str) -> str:
    """内置规则问答，规则顺序与前端 localAnswer 完全一致。"""
    orders = db.get_orders()
    platforms = db.get_platforms()
    inventory = db.get_inventory()
    logs = db.get_sync_logs()
    erp = db.get_erp()

    today = datetime.now().strftime("%Y-%m-%d")
    month_prefix = today[:7]
    today_orders = [o for o in orders if _local_dt(o["time"]).strftime("%Y-%m-%d") == today]
    month_orders = [o for o in orders if _local_dt(o["time"]).strftime("%Y-%m") == month_prefix]
    gmv = sum(o["amount"] for o in month_orders)
    pending = sum(1 for o in orders if o["syncStatus"] == "pending")
    failed = sum(1 for o in orders if o["syncStatus"] == "failed")
    success = sum(1 for o in orders if o["syncStatus"] == "success")
    low = [i for i in inventory if i["available"] < i["safety"]]

    def has(pattern: str, ignorecase: bool = False) -> bool:
        return re.search(pattern, question, re.IGNORECASE if ignorecase else 0) is not None

    def table(rows: List[List[Any]]) -> str:
        return '<table class="mini-tbl">' + "".join(
            f"<tr><td>{r[0]}</td><td>{r[1]}</td></tr>" for r in rows
        ) + "</table>"

    if has(r"帮助|能做什么|你好|hi|hello|功能"):
        return (
            "我可以基于中台实时数据回答你的问题，例如：\n"
            "· 今天/本月有多少订单、GMV 多少\n"
            "· 各平台订单量与占比\n"
            "· 哪些 SKU 缺货、库存预警\n"
            "· 订单同步与 ERP 状态\n"
            "· 仓库库存分布\n\n"
            "点下方快捷问题即可开始。如需接入你自己的大模型获得更强的自由问答能力，到「系统设置 → AI 助手配置」填写 API Key。"
        )

    if has(r"今天|今日|当日"):
        return (
            f"今日订单 {_bold(len(today_orders))} 笔。本月累计 {_bold(len(month_orders))} 笔，GMV {_bold(money(gmv))}。\n"
            f"待同步 {_bold(pending)} 笔，同步失败 {_bold(failed)} 笔。\n"
            "👉 到「订单中心」可查看明细并手动同步。"
        )

    if has(r"gmv|销售|营收|金额|成交额|客单价", True):
        return (
            f"本月 GMV {_bold(money(gmv))}，订单 {_bold(len(month_orders))} 笔，"
            f"客单价约 {_bold(money(gmv / max(len(month_orders), 1)))}。\n"
            "按平台拆分见「数据分析」页的 GMV 趋势与平台对比。"
        )

    if has(r"平台|amazon|tiktok|shein|速卖通|aliexpress|temu|shopee|ebay|walmart", True):
        rows = [
            [p["name"], sum(1 for o in orders if o["platform"] == p["id"])]
            for p in platforms if p["connected"]
        ]
        rows.sort(key=lambda r: -r[1])
        top = (
            f"\n订单最多的是 <b>{rows[0][0]}</b>（{rows[0][1]} 笔）。" if rows else ""
        )
        return (
            f"已接入 {_bold(len(rows))} 个平台，订单分布：\n{table(rows)}{top}\n"
            "👉 在「平台接入」点平台卡片可直接看该平台订单。"
        )

    if has(r"仓库|海外仓|洛杉矶|汉堡|深圳|广州|义乌"):
        rows = [
            [w["name"], sum(i["available"] for i in inventory if i["warehouse"] == w["id"])]
            for w in db.get_warehouses()
        ]
        return (
            "各仓库可用库存：\n" + table([[r[0], f"{fmt_num(r[1])} 件"] for r in rows]) +
            "👉 在「WMS 库存」可切换仓库查看 SKU 明细。"
        )

    if has(r"缺货|库存|补货|sku|safety|预警"):
        if not low:
            return f"当前所有 SKU 库存均高于安全线，共 {_bold(len(inventory))} 条库存记录。"
        rows = [[i["sku"], f"{i['available']}/{i['safety']}"] for i in low[:6]]
        more = f"\n…另有 {len(low) - 6} 个，见「WMS 库存」。" if len(low) > 6 else ""
        return (
            f"有 {_bold(len(low))} 个 SKU 低于安全库存，其中 {_bold(sum(1 for i in low if i['available'] == 0))} 个已缺货：\n"
            + table(rows) + more + "\n👉 到「WMS 库存」可执行入库或生成补货建议。"
        )

    if has(r"同步|erp|失败|重试|推送", True):
        ok = sum(1 for l in logs if l["status"] == "success")
        erp_state = "已连接" if erp["connected"] else "已断开"
        return (
            f"订单同步：已成功 {_bold(success)}，待同步 {_bold(pending)}，失败 {_bold(failed)}。\n"
            f"最近 {len(logs)} 次任务中成功 {_bold(ok)} 次；ERP（{erp['name']}）{erp_state}。\n"
            "👉 到「同步中心」点「立即同步全部」，或在订单中心对失败项点「重试」。同步成功会自动扣减 WMS 库存。"
        )

    if has(r"热销|商品|产品|卖得好|top"):
        rows = [
            [p["name"], sum(1 for o in orders if any(it["sku"] == p["sku"] for it in o["items"]))]
            for p in PRODUCTS[:5]
        ]
        return (
            "关联订单较多的商品：\n"
            + table([[r[0][:12], f"{r[1]} 笔"] for r in rows]) +
            "👉 完整榜单见「数据分析 → 热销商品 Top6」。"
        )

    return (
        f"当前中台概况：订单 {_bold(len(orders))} 笔（今日 {_bold(len(today_orders))}），本月 GMV {_bold(money(gmv))}；"
        f"已接入 {_bold(sum(1 for p in platforms if p['connected']))} 个平台；"
        f"库存 SKU {_bold(len(inventory))}，其中 {_bold(len(low))} 个需补货；"
        f"同步失败 {_bold(failed)} 笔。\n"
        "你可以问我：今天多少订单？哪些 SKU 缺货？同步失败情况？各平台订单对比？"
    )


def _call_llm(question: str, history: List[Dict[str, str]]) -> Tuple[str, str]:
    """调用 OpenAI 兼容接口；返回 (answer, model)，失败抛出异常。"""
    cfg = config.load_full()
    url = cfg["baseUrl"].rstrip("/") + "/chat/completions"
    messages: List[Dict[str, str]] = [{"role": "system", "content": ai_context()}]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": question})
    payload = json.dumps({
        "model": cfg["model"],
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 700,
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg['apiKey']}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    # 大模型输出按纯文本处理，做 HTML 转义防止 XSS；换行交给前端转 <br>
    return html.escape(str(content)), cfg["model"]


def chat(question: str, history: List[Dict[str, str]] | None = None) -> Dict[str, Any]:
    """返回 {ok, answer, model}；model 为空表示使用内置数据引擎。"""
    history = history or []
    if config.load_full()["apiKey"]:
        try:
            answer, model = _call_llm(question, history)
            return {"ok": True, "answer": answer, "model": model}
        except Exception as exc:  # 网络/协议/限流等一律降级
            message = html.escape(str(exc))
            return {
                "ok": True,
                "answer": (
                    f"⚠️ 大模型调用失败（{message}），已切换到内置数据引擎：<br>"
                    + local_answer(question)
                ),
                "model": "",
            }
    return {"ok": True, "answer": local_answer(question), "model": ""}
