"""服务端 AI 配置加载与保存。

安全约定：
  - API Key 只保存在服务端 ``app/data/ai_config.json``；
  - 任何返回给浏览器的接口都只暴露 ``configured / baseUrl / model``，
    绝不返回 ``apiKey`` 原文；
  - 配置文件路径固定，不接受来自请求的路径参数。
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict

DATA_DIR = Path(__file__).resolve().parent / "data"
CONFIG_FILE = DATA_DIR / "ai_config.json"

DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"

_LOCK = threading.RLock()

# 进程内缓存，避免每次问答都读磁盘
_cache: Dict[str, str] | None = None


def _defaults() -> Dict[str, str]:
    return {"baseUrl": DEFAULT_BASE_URL, "model": DEFAULT_MODEL, "apiKey": ""}


def _load_unlocked() -> Dict[str, str]:
    global _cache
    if _cache is not None:
        return dict(_cache)
    cfg = _defaults()
    try:
        if CONFIG_FILE.exists():
            raw = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                if isinstance(raw.get("baseUrl"), str) and raw["baseUrl"].strip():
                    cfg["baseUrl"] = raw["baseUrl"].strip()
                if isinstance(raw.get("model"), str) and raw["model"].strip():
                    cfg["model"] = raw["model"].strip()
                if isinstance(raw.get("apiKey"), str):
                    cfg["apiKey"] = raw["apiKey"].strip()
    except (OSError, ValueError):
        pass
    _cache = cfg
    return dict(cfg)


def load_full() -> Dict[str, str]:
    """读取完整配置（含密钥，仅在服务端内部使用）。"""
    with _LOCK:
        return _load_unlocked()


def public_config() -> Dict[str, Any]:
    """返回可安全下发给浏览器的配置摘要（不含密钥）。"""
    cfg = load_full()
    return {
        "configured": bool(cfg["apiKey"]),
        "baseUrl": cfg["baseUrl"],
        "model": cfg["model"],
    }


def save_config(base_url: str, model: str, api_key: str) -> Dict[str, Any]:
    """保存配置到服务端文件（线程安全、原子写入）。"""
    global _cache
    cfg = {
        "baseUrl": (base_url or "").strip() or DEFAULT_BASE_URL,
        "model": (model or "").strip() or DEFAULT_MODEL,
        "apiKey": (api_key or "").strip(),
    }
    with _LOCK:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = CONFIG_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, CONFIG_FILE)
        _cache = cfg
    return public_config()


def clear_cache() -> None:
    """仅供测试使用：清空进程内缓存。"""
    global _cache
    with _LOCK:
        _cache = None
