# OrderHub · 多平台订单数据中台（Python 后端）

纯 Python 标准库实现的工程化后端，零第三方依赖。前端静态资源由 `app/static/` 托管，业务数据全部落在 SQLite。

## 启动

```bash
python main.py
```

监听 `0.0.0.0:8790`，浏览器访问 <http://localhost:8790/>。

## 目录结构

```
order-hub/
  main.py                      入口（固定 8790）
  app/
    config.py                  服务端 AI 配置（密钥不下发）
    models.py                  dataclass 数据模型
    rng.py                     LCG 确定性随机（seed=20261125）
    catalog.py                 8 平台 / 12 商品 / 5 仓库 / 国家 / 姓名
    database.py                SQLite 建表、播种、WAL、线程安全访问
    services/
      orders.py                订单筛选 / 同步 / 批量同步
      inventory.py             出入库 / 低库存
      sync.py                  同步日志 / 全量同步 / 平台操作
      analytics.py             metrics / 趋势 / 分布 / 热销 / 毛利
      ai.py                    内置数据引擎 + OpenAI 兼容 LLM 降级
      adapters/                amazon / tiktok / aliexpress / shein 骨架
    api/
      router.py                所有 /api 端点
      server.py                ThreadingHTTPServer + 静态托管 + CORS
    static/                    index.html / styles.css / app.js
    data/                      orderhub.db / ai_config.json（运行时生成）
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/bootstrap` | 全量状态（含 ai 配置摘要，不含密钥） |
| GET | `/api/health` | 健康状态、DB、适配器 |
| GET | `/api/adapters` | 各平台适配器状态 |
| GET | `/api/analytics` | metrics / trend / platformCounts / topProducts |
| GET | `/api/config` | AI 配置摘要（不含密钥） |
| POST | `/api/config` | 保存 AI 配置（密钥仅存服务端） |
| POST | `/api/orders/{id}/sync` | 同步单订单 + 扣库存 + 写日志 |
| POST | `/api/orders/bulk-sync` | 批量同步 |
| POST | `/api/sync/full` | 全量同步 + 更新平台/ERP lastSync |
| POST | `/api/platforms/{id}/toggle` | 切换接入状态 |
| POST | `/api/platforms/{id}/sync` | 单平台增量同步 |
| POST | `/api/inventory/adjust` | 入库 / 出库 |
| POST | `/api/settings` | 更新设置 |
| POST | `/api/data/reset` | 重新播种（168 订单 / 40 库存 / 26 日志） |
| GET | `/api/data/export` | 导出订单 + 库存 JSON |
| POST | `/api/ai/chat` | 内置引擎直读 DB；有密钥走 LLM，失败降级 |

## 数据与安全

- 种子严格复刻前端生成顺序：`platforms → orders → inventory → syncLogs`，随机序列与前端 `defaultState()` 一致。
- 数据库位于 `app/data/orderhub.db`，WAL 模式；单连接 + `RLock` 保证线程安全。
- AI 默认使用内置数据引擎，不复用其他项目的密钥。用户填写的 OpenAI 兼容密钥写入 `app/data/ai_config.json`，任何响应都不返回原文。
- 静态服务只放行 `html/css/js/svg/图片/字体`，`.py` / `.db` / `.json` / 隐藏文件 / 路径穿越一律拦截。

## 前端改造

`app.js` 由 `/api/bootstrap` 注入 `state`，`save()` 为空操作；同步、库存、设置、重置、导出、AI 问答全部改为调用后端 API。所有页面渲染、SVG 图表、抽屉/弹窗与事件绑定保持原样。
