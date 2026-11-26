/* ================= OrderHub App Logic ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ================= 后端 API 驱动的状态 =================
 * 所有业务数据以服务端 SQLite 为准；前端不再使用 localStorage 存储业务状态。
 * state 保持为可变的模块级引用，reloadState() 后调用 navigate() 即可用最新数据渲染。
 */
let state = null;
let aiConfigMeta = { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', configured: false };

async function fetchJson(url, options) {
  const resp = await fetch(url, options);
  let data;
  try { data = await resp.json(); } catch (e) { throw new Error('后端返回了无效 JSON'); }
  if (!resp.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + resp.status));
  return data;
}

async function bootstrap() {
  const data = await fetchJson('/api/bootstrap');
  state = data.state || data;
  if (data.ai) aiConfigMeta = { ...aiConfigMeta, ...data.ai };
  return state;
}

async function reloadState() {
  const data = await fetchJson('/api/bootstrap');
  state = data.state || data;
  if (data.ai) aiConfigMeta = { ...aiConfigMeta, ...data.ai };
  return state;
}

function save() { /* 兼容旧调用：持久化统一由后端 API 负责 */ }

/* ---------- Deterministic RNG ---------- */
let _seed = 20261125;
function rnd() { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; }
const pick = a => a[Math.floor(rnd() * a.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

/* ---------- External reference links ---------- */
const REFS = {
  tiktokDoc: 'https://partner.tiktokshop.com/docv2/page/get-authorized-category-assets-202405',
  tiktokDeepseek: 'https://chat.deepseek.com/share/aqun2ilsh6c41incsx',
};
const extLink = (url, text, cls = 'btn btn-sm') => `<a class="${cls}" href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" class="ico" style="width:14px;height:14px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>${text}</a>`;

/* ---------- Reference data ---------- */
const PLATFORM_DEFS = [
  { id: 'amazon', name: 'Amazon', short: 'AZ', color: '#232f3e', region: '美国 / 欧洲 / 日本站' },
  { id: 'tiktok', name: 'TikTok Shop', short: 'TT', color: '#111827', region: '美国 / 东南亚 / 英国' },
  { id: 'aliexpress', name: 'AliExpress', short: 'AE', color: '#e62e04', region: '全球 200+ 国家' },
  { id: 'shein', name: 'SHEIN', short: 'SH', color: '#000000', region: '全球 / 快时尚类目' },
  { id: 'temu', name: 'Temu', short: 'TM', color: '#f4511e', region: '北美 / 欧洲' },
  { id: 'shopee', name: 'Shopee', short: 'SP', color: '#ee4d2d', region: '东南亚 / 拉美' },
  { id: 'ebay', name: 'eBay', short: 'EB', color: '#e53238', region: '全球站点' },
  { id: 'walmart', name: 'Walmart', short: 'WM', color: '#0071ce', region: '美国站' },
];
const PRODUCTS = [
  { sku: 'EH-1001', name: 'TWS 无线蓝牙耳机 Pro', cat: '3C数码', price: 39.9, cost: 16 },
  { sku: 'HM-2043', name: '便携智能保温杯 500ml', cat: '家居生活', price: 22.5, cost: 8.5 },
  { sku: 'FA-3310', name: '折叠便携补光灯', cat: '摄影配件', price: 18.9, cost: 6.2 },
  { sku: 'EL-1188', name: '迷你蓝牙音箱 RGB', cat: '3C数码', price: 28.0, cost: 11 },
  { sku: 'AP-4021', name: '硅胶手机支架 磁吸款', cat: '手机配件', price: 9.9, cost: 2.8 },
  { sku: 'CL-5520', name: '女士防晒冰袖套装', cat: '服饰', price: 12.9, cost: 4.1 },
  { sku: 'KT-2091', name: '宠物自动饮水机', cat: '宠物用品', price: 45.0, cost: 19 },
  { sku: 'HM-7788', name: '多功能收纳盒 三件套', cat: '家居生活', price: 16.5, cost: 5.6 },
  { sku: 'EL-6602', name: '65W 氮化镓充电器', cat: '3C数码', price: 34.9, cost: 14 },
  { sku: 'SP-8830', name: '瑜伽弹力带 5件套', cat: '运动户外', price: 14.9, cost: 4.8 },
  { sku: 'AP-1204', name: '车载手机无线充电器', cat: '汽车配件', price: 25.9, cost: 9.5 },
  { sku: 'FA-9011', name: '旅行洗漱收纳包', cat: '箱包', price: 19.9, cost: 7 },
];
const COUNTRIES = ['美国', '英国', '德国', '法国', '日本', '加拿大', '澳大利亚', '新加坡', '马来西亚', '巴西', '西班牙', '意大利'];
const FIRST = ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Lucas', 'Mia', 'Logan', 'Isla', 'Elijah', 'Amelia'];
const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Moore'];
const WAREHOUSES = [
  { id: 'sz', name: '深圳保税仓', code: 'CN-SZ' },
  { id: 'gz', name: '广州白云仓', code: 'CN-GZ' },
  { id: 'yw', name: '义乌中心仓', code: 'CN-YW' },
  { id: 'la', name: '洛杉矶海外仓', code: 'US-LA' },
  { id: 'de', name: '德国汉堡海外仓', code: 'DE-HH' },
];
const ORDER_STATUS = {
  pending: { label: '待同步', cls: 'tag-warning' },
  synced: { label: '已同步ERP', cls: 'tag-info' },
  shipped: { label: '已发货', cls: 'tag-purple' },
  completed: { label: '已完成', cls: 'tag-success' },
  failed: { label: '同步失败', cls: 'tag-danger' },
};
const SYNC_STATUS = {
  pending: { label: '待同步', cls: 'tag-warning' },
  success: { label: '同步成功', cls: 'tag-success' },
  failed: { label: '同步失败', cls: 'tag-danger' },
};

/* ---------- Date helpers ---------- */
function daysAgo(n, h = 10, m = 0) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d; }
function fmtDate(d, withTime = false) {
  const p = x => String(x).padStart(2, '0');
  const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${s} ${p(d.getHours())}:${p(d.getMinutes())}` : s;
}
function timeAgo(d) {
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 1) return '刚刚';
  if (diff < 60) return `${Math.floor(diff)} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return `${Math.floor(diff / 1440)} 天前`;
}

/* ================= Utilities ================= */
const money = (n, c = 'USD') => {
  const sym = c === 'USD' ? '$' : c === 'CNY' ? '¥' : c + ' ';
  return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtNum = n => n.toLocaleString('en-US');
const platById = id => state.platforms.find(p => p.id === id) || PLATFORM_DEFS.find(p => p.id === id) || { id, name: id, short: '??', color: '#64748b' };
const platLogo = (p, lg = false) => `<span class="${lg ? 'plat-logo-lg' : 'plat-logo'}" style="background:${p.color}">${p.short}</span>`;
const statusTag = s => `<span class="tag ${ORDER_STATUS[s]?.cls || 'tag-muted'}"><span class="dot" style="background:currentColor"></span>${ORDER_STATUS[s]?.label || s}</span>`;
const syncTag = s => `<span class="tag ${SYNC_STATUS[s]?.cls || 'tag-muted'}">${SYNC_STATUS[s]?.label || s}</span>`;
const whName = id => WAREHOUSES.find(w => w.id === id)?.name || id;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, type = '') {
  const icon = type === 'err' ? '<path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/>'
    : type === 'ok' ? '<path d="M20 6L9 17l-5-5"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<svg viewBox="0 0 24 24" class="ico">${icon}</svg><span>${esc(msg)}</span>`;
  $('#toastWrap').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; el.style.transition = '.25s'; setTimeout(() => el.remove(), 260); }, 3200);
}

/* ================= SVG Charts ================= */
function lineChart(series, labels, opts = {}) {
  const W = 660, H = 230, padL = 42, padR = 12, padT = 16, padB = 28;
  const iw = W - padL - padR, ih = H - padT - padB;
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all, 1) * 1.18;
  const x = i => padL + (i / Math.max(labels.length - 1, 1)) * iw;
  const y = v => padT + ih - (v / max) * ih;
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const gy = padT + (ih / 4) * i;
    const val = Math.round(max - (max / 4) * i);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#eef2f7" stroke-width="1"/>`;
    grid += `<text x="${padL - 9}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${val}</text>`;
  }
  let xlab = '';
  labels.forEach((l, i) => { if (i % Math.ceil(labels.length / 7) === 0 || i === labels.length - 1) xlab += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${l}</text>`; });
  let paths = '', defs = '';
  series.forEach((s, si) => {
    const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const line = `M${s.data.map((v, i) => `${x(i)},${y(v)}`).join(' L')}`;
    const area = `${line} L${x(s.data.length - 1)},${padT + ih} L${x(0)},${padT + ih} Z`;
    defs += `<linearGradient id="grad${si}_${opts.uid || 0}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity="${s.fill ? .28 : 0}"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
    paths += `<path d="${area}" fill="url(#grad${si}_${opts.uid || 0})"/>`;
    paths += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (opts.dots !== false) s.data.forEach((v, i) => { paths += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${labels[i]}: ${v}</title></circle>`; });
  });
  return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${grid}${paths}${xlab}</svg>`;
}
function donutChart(segs, centerTop, centerSub) {
  const r = 66, C = 2 * Math.PI * r, total = segs.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0, arcs = '';
  segs.forEach(s => {
    const len = (s.value / total) * C;
    arcs += `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${s.color}" stroke-width="24" stroke-dasharray="${len - 2} ${C - len + 2}" stroke-dashoffset="${-acc}" transform="rotate(-90 90 90)" stroke-linecap="round"><title>${esc(s.label)}: ${s.value} (${(s.value / total * 100).toFixed(1)}%)</title></circle>`;
    acc += len;
  });
  return `<svg viewBox="0 0 180 180" style="width:180px;height:180px;max-width:100%">
    <circle cx="90" cy="90" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="24"/>${arcs}
    <text x="90" y="85" text-anchor="middle" font-size="26" font-weight="750" fill="#1e293b">${centerTop}</text>
    <text x="90" y="106" text-anchor="middle" font-size="11" fill="#94a3b8">${centerSub}</text>
  </svg>`;
}
function barChart(data, opts = {}) {
  const W = 640, H = 220, padL = 36, padR = 10, padT = 14, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...data.map(d => d.value), 1) * 1.15;
  const bw = Math.min(46, (iw / data.length) * .6);
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const gy = padT + (ih / 4) * i;
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#eef2f7"/>`;
    grid += `<text x="${padL - 7}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${Math.round(max - max / 4 * i)}</text>`;
  }
  let bars = '';
  data.forEach((d, i) => {
    const cx = padL + (i + .5) * (iw / data.length);
    const h = (d.value / max) * ih;
    bars += `<rect x="${cx - bw / 2}" y="${padT + ih - h}" width="${bw}" height="${h}" rx="5" fill="${d.color || '#6366f1'}" opacity="${opts.opacity || .92}"><title>${esc(d.label)}: ${d.value}</title></rect>`;
    bars += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#94a3b8">${esc(d.label)}</text>`;
  });
  return `<svg class="svg-chart" viewBox="0 0 ${W} ${H}">${grid}${bars}</svg>`;
}
function hbarChart(data) {
  return `<div style="display:flex;flex-direction:column;gap:13px">${data.map(d => `
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="font-weight:600">${esc(d.label)}</span><span class="muted">${fmtNum(d.value)}</span>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${(d.value / (data[0]?.value || 1) * 100).toFixed(1)}%;background:${d.color || 'linear-gradient(90deg,#6366f1,#a855f7)'}"></div></div>
    </div>`).join('')}</div>`;
}

/* ================= Derived metrics ================= */
function metrics() {
  const orders = state.orders;
  const today = fmtDate(new Date());
  const todayOrders = orders.filter(o => fmtDate(new Date(o.time)) === today);
  const monthPrefix = today.slice(0, 7);
  const monthOrders = orders.filter(o => o.time.startsWith(monthPrefix));
  const gmv = monthOrders.reduce((s, o) => s + o.amount, 0);
  const pending = orders.filter(o => o.syncStatus === 'pending').length;
  const failed = orders.filter(o => o.syncStatus === 'failed').length;
  const lowStock = state.inventory.filter(i => i.available < i.safety).length;
  return { todayOrders, monthOrders, gmv, pending, failed, lowStock };
}
function trendData(days = 14) {
  const labels = [], ordersArr = [], gmvArr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const key = fmtDate(d);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    const os = state.orders.filter(o => fmtDate(new Date(o.time)) === key);
    ordersArr.push(os.length);
    gmvArr.push(Math.round(os.reduce((s, o) => s + o.amount, 0)));
  }
  return { labels, ordersArr, gmvArr };
}

/* ================= Router ================= */
const PAGES = {
  dashboard: { title: '数据总览', sub: '全平台订单与库存的实时经营视图', render: renderDashboard },
  platforms: { title: '平台接入', sub: '管理海外电商平台的授权连接与数据同步', render: renderPlatforms },
  orders: { title: '订单中心', sub: '统一订单池 · 多平台订单聚合与 ERP 同步状态', render: renderOrders },
  sync: { title: '同步中心', sub: '数据采集 → 清洗映射 → ERP/WMS 的全链路同步', render: renderSync },
  erp: { title: 'ERP 对接', sub: 'ERP 连接状态、字段映射与数据回写配置', render: renderErp },
  wms: { title: 'WMS 库存', sub: '多仓库库存台账、出入库与补货预警', render: renderWms },
  analytics: { title: '数据分析', sub: '销售趋势、平台贡献与商品表现洞察', render: renderAnalytics },
  settings: { title: '系统设置', sub: '同步策略、告警规则与系统参数配置', render: renderSettings },
};
let currentPage = 'dashboard';
function navigate(page) {
  if (!PAGES[page]) page = 'dashboard';
  currentPage = page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#pageTitle').textContent = PAGES[page].title;
  $('#pageSubtitle').textContent = PAGES[page].sub;
  $('#content').innerHTML = '';
  $('#content').appendChild(PAGES[page].render());
  $('#content').scrollTop = 0;
  $('#sidebar').classList.remove('show');
}
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

/* ================= Page: Dashboard ================= */
function renderDashboard() {
  const m = metrics();
  const t = trendData(14);
  const page = el('<div class="page"></div>');
  const kpis = [
    { label: '今日订单量', val: fmtNum(m.todayOrders.length), ico: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>', c: 'var(--primary)', bg: 'var(--primary-l)', trend: '+12.6%', up: true },
    { label: '本月 GMV', val: money(m.gmv), ico: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', c: 'var(--success)', bg: 'var(--success-l)', trend: '+8.4%', up: true },
    { label: '待同步 / 失败', val: `${m.pending + m.failed}`, ico: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>', c: 'var(--warning)', bg: 'var(--warning-l)', trend: `${m.pending} 待处理`, up: false },
    { label: '库存预警 SKU', val: fmtNum(m.lowStock), ico: '<path d="M3 21V8l9-5 9 5v13"/><path d="M3 21h18M8 21v-7h8v7"/>', c: 'var(--danger)', bg: 'var(--danger-l)', trend: '低于安全库存', up: false },
  ];
  page.innerHTML = `
    ${m.lowStock > 6 ? `<div class="banner banner-warn"><svg viewBox="0 0 24 24" class="ico"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>当前有 <b>${m.lowStock}</b> 个 SKU 库存低于安全线，建议尽快补货。</span><button class="btn btn-sm" data-go="wms">查看库存</button></div>` : ''}
    <div class="grid g4">${kpis.map(k => `
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">${k.label}</span><span class="kpi-ico" style="background:${k.bg};color:${k.c}"><svg viewBox="0 0 24 24" class="ico">${k.ico}</svg></span></div>
      <div class="kpi-val">${k.val}</div>
      <div class="kpi-foot"><span class="trend ${k.up ? 'up' : 'down'}">${k.up ? '<svg viewBox="0 0 24 24" class="ico"><path d="M6 15l6-6 6 6"/></svg>' : ''}${k.trend}</span><span>较上周期</span></div></div>`).join('')}</div>

    <div class="grid g2 mt16">
      <div class="card card-pad">
        <div class="section-head"><div><h2>订单趋势</h2><p>近 14 天订单量与 GMV 变化</p></div><div class="chart-legend"><span><i class="legend-dot" style="background:#6366f1"></i>订单量</span></div></div>
        <div class="chart-wrap">${lineChart([{ data: t.ordersArr, color: '#6366f1', fill: true }], t.labels, { uid: 1 })}</div>
      </div>
      <div class="card card-pad">
        <div class="section-head"><div><h2>平台订单占比</h2><p>按已接入平台统计近 30 天</p></div></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap">
          ${donutChart(PLATFORM_DEFS.slice(0, 6).map((p, i) => ({ label: p.name, value: state.orders.filter(o => o.platform === p.id).length + 40 + i * 13, color: p.color === '#000000' ? '#475569' : p.color })), fmtNum(state.orders.length), '总订单')}
          <div class="chart-legend" style="flex-direction:column;gap:9px">${PLATFORM_DEFS.slice(0, 6).map((p, i) => `<span><i class="legend-dot" style="background:${p.color === '#000000' ? '#475569' : p.color}"></i>${p.name}</span>`).join('')}</div>
        </div>
      </div>
    </div>

    <div class="card card-pad mt16">
      <div class="section-head"><div><h2>数据同步流水线</h2><p>多平台订单统一汇聚至 ERP 与 WMS</p></div><button class="btn btn-sm btn-primary" data-go="sync">前往同步中心 <svg viewBox="0 0 24 24" class="ico"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>
      ${pipelineHtml('idle')}
    </div>

    <div class="grid g2 mt16">
      <div class="card">
        <div class="section-head" style="padding:18px 20px 0"><div><h2>最新订单</h2><p>来自各平台的实时订单</p></div><button class="btn btn-sm" data-go="orders">全部订单</button></div>
        <div class="tbl-scroll"><table class="tbl"><thead><tr><th>订单号</th><th>平台</th><th>客户</th><th>金额</th><th>同步状态</th></tr></thead><tbody>
        ${state.orders.slice(0, 6).map(o => `<tr data-order="${o.id}"><td class="mono cell-main">${o.id.slice(-12)}</td><td>${platLogo(platById(o.platform))} ${platById(o.platform).name}</td><td>${esc(o.customer)}<div class="cell-sub">${o.country}</div></td><td class="cell-main">${money(o.amount)}</td><td>${syncTag(o.syncStatus)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="card card-pad">
        <div class="section-head"><div><h2>平台运行状态</h2><p>连接与最近同步时间</p></div></div>
        <div style="display:flex;flex-direction:column;gap:11px">
        ${state.platforms.filter(p => p.connected).map(p => `<div style="display:flex;align-items:center;gap:11px">
          ${platLogo(p)}<div style="flex:1"><div style="font-weight:600;font-size:12.5px">${p.name}</div><div class="muted" style="font-size:11px">最近同步 ${p.lastSync ? timeAgo(new Date(p.lastSync)) : '—'}</div></div>
          <span class="tag tag-success"><span class="dot" style="background:currentColor"></span>正常</span></div>`).join('')}
        </div>
      </div>
    </div>`;
  return page;
}
function pipelineHtml(mode) {
  const steps = [
    { ico: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/>', name: '多平台采集', desc: 'Amazon / TikTok / AE / SHEIN' },
    { ico: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>', name: '统一订单池', desc: '字段清洗 · SKU 映射 · 去重' },
    { ico: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', name: 'ERP 同步', desc: '销售订单 / 客户 / 物流' },
    { ico: '<path d="M3 21V8l9-5 9 5v13"/><path d="M8 21v-7h8v7"/>', name: 'WMS 库存', desc: '库存扣减 · 入库 · 调拨' },
  ];
  const cls = mode === 'running' ? 'active' : 'done';
  return `<div class="pipeline">${steps.map((s, i) => `${i ? '<div class="pipe-arrow"><svg viewBox="0 0 24 24" class="ico"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>' : ''}
    <div class="pipe-step ${cls}" style="${mode === 'running' ? `animation-delay:${i * .18}s` : ''}"><div class="pipe-ico"><svg viewBox="0 0 24 24" class="ico">${s.ico}</svg></div><div class="pipe-name">${s.name}</div><div class="pipe-desc">${s.desc}</div></div>`).join('')}</div>`;
}

/* ================= Page: Platforms ================= */
function renderPlatforms() {
  const page = el('<div class="page"></div>');
  const connected = state.platforms.filter(p => p.connected).length;
  page.innerHTML = `
    <div class="stat-strip" style="margin-bottom:16px">
      <div class="stat-cell"><div class="v">${state.platforms.length}</div><div class="l">支持平台</div></div>
      <div class="stat-cell"><div class="v">${connected}</div><div class="l">已接入</div></div>
      <div class="stat-cell"><div class="v">${state.platforms.length - connected}</div><div class="l">待接入</div></div>
      <div class="stat-cell"><div class="v">${state.settings.interval} 分钟</div><div class="l">自动同步间隔</div></div>
    </div>
      <div class="grid g3">${state.platforms.map(p => `
      <div class="plat-card" data-view-plat="${p.id}" title="点击查看该平台订单">
        <div class="plat-head">${platLogo(p, true)}<div><div class="plat-name">${p.name}</div><div class="plat-region">${p.region}</div></div>
          <div class="plat-status"><span class="tag ${p.connected ? 'tag-success' : 'tag-muted'}"><span class="dot" style="background:currentColor"></span>${p.connected ? '已连接' : '未连接'}</span></div></div>
        <div class="plat-metrics">
          <div class="plat-metric"><div class="v" style="color:var(--primary)">${state.orders.filter(o => o.platform === p.id).length}</div><div class="l">累计订单 · 点击查看</div></div>
          <div class="plat-metric"><div class="v">${p.lastSync ? timeAgo(new Date(p.lastSync)) : '—'}</div><div class="l">最近同步</div></div>
        </div>
        <div class="plat-foot">
          <button class="btn btn-sm ${p.connected ? '' : 'btn-primary'}" data-toggle-plat="${p.id}">${p.connected ? '断开连接' : '立即接入'}</button>
          <button class="btn btn-sm" data-sync-plat="${p.id}" ${p.connected ? '' : 'disabled'}>同步数据</button>
          ${p.id === 'tiktok' ? extLink(REFS.tiktokDoc, 'API 文档') : ''}
        </div>
      </div>`).join('')}</div>`;
  return page;
}

/* ================= Page: Orders ================= */
const ordersFilter = { platform: '', status: '', sync: '', search: '', page: 1, size: 12 };
function filteredOrders() {
  return state.orders.filter(o =>
    (!ordersFilter.platform || o.platform === ordersFilter.platform) &&
    (!ordersFilter.status || o.status === ordersFilter.status) &&
    (!ordersFilter.sync || o.syncStatus === ordersFilter.sync) &&
    (!ordersFilter.search || [o.id, o.customer, o.platformOrder, ...o.items.map(i => i.sku)].join(' ').toLowerCase().includes(ordersFilter.search.toLowerCase()))
  );
}
function renderOrders() {
  const page = el('<div class="page"></div>');
  const list = filteredOrders();
  const total = Math.max(1, Math.ceil(list.length / ordersFilter.size));
  ordersFilter.page = Math.min(ordersFilter.page, total);
  const slice = list.slice((ordersFilter.page - 1) * ordersFilter.size, ordersFilter.page * ordersFilter.size);
  page.innerHTML = `
    <div class="card card-pad" style="margin-bottom:16px">
      <div class="table-tools">
        <div class="search-sm"><svg viewBox="0 0 24 24" class="ico"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="orderSearch" placeholder="搜索订单号 / 客户 / SKU" value="${esc(ordersFilter.search)}"></div>
        <select class="select-sm" id="fPlatform"><option value="">全部平台</option>${state.platforms.map(p => `<option value="${p.id}" ${ordersFilter.platform === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select>
        <select class="select-sm" id="fStatus"><option value="">全部状态</option>${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${ordersFilter.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <select class="select-sm" id="fSync"><option value="">全部同步状态</option>${Object.entries(SYNC_STATUS).map(([k, v]) => `<option value="${k}" ${ordersFilter.sync === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <button class="btn btn-sm" id="resetFilter">重置</button>
        <div style="margin-left:auto;display:flex;gap:8px"><button class="btn btn-sm" data-bulk-sync>批量同步待处理</button><button class="btn btn-sm btn-primary" data-go="sync">同步中心</button></div>
      </div>
      <div class="stat-strip" style="margin-bottom:16px">
        <div class="stat-cell"><div class="v">${fmtNum(state.orders.length)}</div><div class="l">订单总数</div></div>
        <div class="stat-cell"><div class="v">${state.orders.filter(o => o.syncStatus === 'success').length}</div><div class="l">已同步 ERP</div></div>
        <div class="stat-cell"><div class="v">${state.orders.filter(o => o.syncStatus === 'pending').length}</div><div class="l">待同步</div></div>
        <div class="stat-cell"><div class="v">${state.orders.filter(o => o.syncStatus === 'failed').length}</div><div class="l">同步失败</div></div>
      </div>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>订单编号</th><th>平台</th><th>客户 / 国家</th><th>商品</th><th>金额</th><th>下单时间</th><th>履约仓</th><th>ERP 同步</th><th>操作</th></tr></thead><tbody>
      ${slice.length ? slice.map(o => `<tr data-order="${o.id}">
        <td><div class="cell-main mono">${o.id.slice(-13)}</div><div class="cell-sub mono">${o.platformOrder}</div></td>
        <td>${platLogo(platById(o.platform))} <span>${platById(o.platform).name}</span></td>
        <td>${esc(o.customer)}<div class="cell-sub">${o.country}</div></td>
        <td>${esc(o.items[0].name)}${o.items.length > 1 ? `<div class="cell-sub">等 ${o.items.length} 件商品</div>` : ''}</td>
        <td class="cell-main">${money(o.amount)}</td>
        <td>${fmtDate(new Date(o.time), true)}</td>
        <td>${whName(o.warehouse)}</td>
        <td>${syncTag(o.syncStatus)}</td>
        <td>${o.syncStatus === 'success' ? '<button class="btn btn-sm btn-ghost" data-order-detail="' + o.id + '">详情</button>' : `<button class="btn btn-sm ${o.syncStatus === 'failed' ? 'btn-danger' : 'btn-primary'}" data-sync-order="${o.id}">${o.syncStatus === 'failed' ? '重试' : '同步'}</button>`}</td>
      </tr>`).join('') : '<tr><td colspan="9"><div class="empty"><svg viewBox="0 0 24 24" class="ico"><path d="M6 2h9l5 5v15H6z"/></svg>没有符合条件的订单</div></td></tr>'}
      </tbody></table></div>
      <div class="pager"><span>共 ${list.length} 条记录 · 第 ${ordersFilter.page}/${total} 页</span>
        <div class="pager-btns"><button class="pg" data-pg="prev" ${ordersFilter.page === 1 ? 'disabled' : ''}>‹</button>
        ${Array.from({ length: Math.min(total, 5) }, (_, i) => `<button class="pg ${ordersFilter.page === i + 1 ? 'active' : ''}" data-pg="${i + 1}">${i + 1}</button>`).join('')}
        <button class="pg" data-pg="next" ${ordersFilter.page === total ? 'disabled' : ''}>›</button></div></div>
    </div>`;
  return page;
}

/* ================= Page: Sync ================= */
let syncRunning = false;
function renderSync() {
  const page = el('<div class="page"></div>');
  const ok = state.syncLogs.filter(l => l.status === 'success').length;
  const partial = state.syncLogs.filter(l => l.status === 'partial').length;
  const failed = state.syncLogs.filter(l => l.status === 'failed').length;
  page.innerHTML = `
    <div class="card card-pad" style="margin-bottom:16px">
      <div class="section-head"><div><h2>数据同步链路</h2><p>订单数据从平台到 ERP / WMS 的实时流转</p></div>
        <div style="display:flex;gap:8px"><button class="btn btn-sm" id="testConn">测试连接</button><button class="btn btn-sm btn-primary" id="runSync" ${syncRunning ? 'disabled' : ''}><svg viewBox="0 0 24 24" class="ico"><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/></svg>${syncRunning ? '同步中…' : '立即同步全部'}</button></div></div>
      ${pipelineHtml(syncRunning ? 'running' : 'idle')}
      <div id="syncProgress" style="margin-top:16px;${syncRunning ? '' : 'display:none'}"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span id="syncProgLabel">正在同步…</span><span id="syncProgPct">0%</span></div><div class="progress"><div class="progress-bar" id="syncProgBar" style="width:0%"></div></div></div>
    </div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">今日同步任务</div><div class="kpi-val">${state.syncLogs.length}</div><div class="kpi-foot">执行次数</div></div>
      <div class="kpi"><div class="kpi-label">成功</div><div class="kpi-val" style="color:var(--success)">${ok}</div><div class="kpi-foot">成功率 ${(ok / state.syncLogs.length * 100).toFixed(0)}%</div></div>
      <div class="kpi"><div class="kpi-label">部分成功</div><div class="kpi-val" style="color:var(--warning)">${partial}</div><div class="kpi-foot">有跳过记录</div></div>
      <div class="kpi"><div class="kpi-label">失败</div><div class="kpi-val" style="color:var(--danger)">${failed}</div><div class="kpi-foot">需人工介入</div></div>
    </div>
    <div class="card">
      <div class="section-head" style="padding:18px 20px 0"><div><h2>同步日志</h2><p>最近 ${state.syncLogs.length} 条同步任务记录</p></div><span class="tag tag-info">实时</span></div>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>任务编号</th><th>平台</th><th>任务类型</th><th>记录数</th><th>耗时</th><th>状态</th><th>执行时间</th><th>说明</th></tr></thead><tbody>
      ${state.syncLogs.slice(0, 14).map(l => `<tr><td class="mono cell-main">${l.id}</td><td>${platLogo(platById(l.platform))} ${platById(l.platform).name}</td><td>${l.type}</td><td>${fmtNum(l.records)}</td><td>${l.duration}s</td>
        <td><span class="tag ${l.status === 'success' ? 'tag-success' : l.status === 'partial' ? 'tag-warning' : 'tag-danger'}">${l.status === 'success' ? '成功' : l.status === 'partial' ? '部分成功' : '失败'}</span></td>
        <td>${fmtDate(new Date(l.time), true)}</td><td class="muted" style="max-width:230px;overflow:hidden;text-overflow:ellipsis">${esc(l.message)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  return page;
}

/* ================= Page: ERP ================= */
function renderErp() {
  const page = el('<div class="page"></div>');
  const fields = [
    ['platform_order_id', 'erp_order_no'], ['buyer_name', 'customer_name'], ['buyer_country', 'ship_country'],
    ['sku', 'item_code'], ['qty', 'qty'], ['unit_price', 'price'], ['order_amount', 'total_amount'],
    ['paid_at', 'order_date'], ['warehouse_code', 'warehouse'], ['tracking_no', 'tracking_number'],
  ];
  page.innerHTML = `
    <div class="grid g2">
      <div class="card card-pad">
        <div class="section-head"><div><h2>ERP 连接状态</h2><p>与内部 ERP 系统的对接情况</p></div><span class="tag ${state.erp.connected ? 'tag-success' : 'tag-danger'}"><span class="dot" style="background:currentColor"></span>${state.erp.connected ? '已连接' : '已断开'}</span></div>
        <div class="info-grid">
          <div class="info-item"><div class="l">ERP 系统</div><div class="v">${state.erp.name}</div></div>
          <div class="info-item"><div class="l">对接方式</div><div class="v">OpenAPI / RESTful</div></div>
          <div class="info-item"><div class="l">最后同步</div><div class="v">${timeAgo(new Date(state.erp.lastSync))}</div></div>
          <div class="info-item"><div class="l">同步方向</div><div class="v">双向同步</div></div>
        </div>
        <div class="divider"></div>
        <div class="stat-strip">
          <div class="stat-cell"><div class="v">${state.orders.filter(o => o.syncStatus === 'success').length}</div><div class="l">已推送订单</div></div>
          <div class="stat-cell"><div class="v">${state.orders.filter(o => o.syncStatus === 'failed').length}</div><div class="l">推送失败</div></div>
          <div class="stat-cell"><div class="v">${state.settings.retry}</div><div class="l">重试次数</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-sm" id="erpTest">测试连接</button><button class="btn btn-sm btn-primary" id="erpPush">全量推送</button></div>
      </div>
      <div class="card card-pad">
        <div class="section-head"><div><h2>同步内容</h2><p>已启用的数据对象</p></div></div>
        ${[['销售订单', '订单头 / 明细 / 客户信息'], ['库存台账', '可用量 / 预占量 / 在途量'], ['物流发货', '运单号 / 履约状态'], ['商品资料', 'SKU / 类目 / 条码']].map((x, i) => `
          <div class="config-row"><div class="info"><div class="t">${x[0]}</div><div class="d">${x[1]}</div></div>
          <div class="switch on" data-erp-module="${i}"></div></div>`).join('')}
      </div>
    </div>
    <div class="card card-pad mt16">
      <div class="section-head"><div><h2>字段映射配置</h2><p>平台标准字段 → ERP 目标字段</p></div><button class="btn btn-sm" id="addMapping">+ 新增映射</button></div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;padding:0 0 8px;font-size:11px;color:var(--muted);font-weight:700"><div>中台标准字段</div><div></div><div>ERP 目标字段</div></div>
      ${fields.map(f => `<div class="field-map"><div class="src">${f[0]}</div><div class="arr">→</div><div class="dst">${f[1]}</div></div>`).join('')}
    </div>
    <div class="card card-pad mt16">
      <div class="section-head"><div><h2>对接参考资料</h2><p>平台 API 文档与能力梳理，供接口开发与字段映射参考</p></div></div>
      <div class="config-row">
        <div class="info"><div class="t">TikTok Shop · 获取授权类目资产（官方 API 文档）</div><div class="d">partner.tiktokshop.com · Get Authorized Category Assets · 用于确认店铺已授权经营的类目与商品资产范围</div></div>
        ${extLink(REFS.tiktokDoc, '打开文档')}
      </div>
      <div class="config-row">
        <div class="info"><div class="t">TikTok Shop API 能力梳理（对话记录）</div><div class="d">chat.deepseek.com · 商品 / 订单 / 履约 / 物流 / 财务 / 数据分析等接口能力矩阵与对接要点</div></div>
        ${extLink(REFS.tiktokDeepseek, '查看梳理')}
      </div>
    </div>`;
  return page;
}

/* ================= Page: WMS ================= */
let activeWarehouse = 'all';
function stockStatus(i) { return i.available === 0 ? { t: '缺货', c: 'tag-danger' } : i.available < i.safety ? { t: '低库存', c: 'tag-warning' } : { t: '正常', c: 'tag-success' }; }
function renderWms() {
  const page = el('<div class="page"></div>');
  const inv = state.inventory.filter(i => activeWarehouse === 'all' || i.warehouse === activeWarehouse);
  const low = state.inventory.filter(i => i.available < i.safety);
  const totalAvail = state.inventory.reduce((s, i) => s + i.available, 0);
  const totalRes = state.inventory.reduce((s, i) => s + i.reserved, 0);
  const totalIn = state.inventory.reduce((s, i) => s + i.inbound, 0);
  page.innerHTML = `
    ${low.length ? `<div class="banner banner-danger"><svg viewBox="0 0 24 24" class="ico"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg><span><b>${low.length}</b> 个 SKU 低于安全库存，其中 <b>${low.filter(i => i.available === 0).length}</b> 个已缺货。</span><button class="btn btn-sm" id="genPo">生成补货建议</button></div>` : ''}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">库存 SKU 数</div><div class="kpi-val">${state.inventory.length}</div><div class="kpi-foot">跨 ${WAREHOUSES.length} 个仓库</div></div>
      <div class="kpi"><div class="kpi-label">可用库存总量</div><div class="kpi-val">${fmtNum(totalAvail)}</div><div class="kpi-foot">件</div></div>
      <div class="kpi"><div class="kpi-label">预占 / 在途</div><div class="kpi-val" style="font-size:23px">${fmtNum(totalRes)} / ${fmtNum(totalIn)}</div><div class="kpi-foot">件</div></div>
      <div class="kpi"><div class="kpi-label">库存预警</div><div class="kpi-val" style="color:var(--danger)">${low.length}</div><div class="kpi-foot">需补货 SKU</div></div>
    </div>
    <div class="card card-pad">
      <div class="section-head"><div><h2>库存台账</h2><p>各仓库 SKU 实时库存</p></div>
        <div style="display:flex;gap:8px"><button class="btn btn-sm" data-stock-op="in">入库</button><button class="btn btn-sm" data-stock-op="out">出库</button></div></div>
      <div class="warehouse-tabs">
        <button class="wtab ${activeWarehouse === 'all' ? 'active' : ''}" data-wh="all">全部仓库</button>
        ${WAREHOUSES.map(w => `<button class="wtab ${activeWarehouse === w.id ? 'active' : ''}" data-wh="${w.id}">${w.name}</button>`).join('')}
      </div>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>SKU</th><th>商品名称</th><th>仓库</th><th>可用</th><th>预占</th><th>在途</th><th>安全库存</th><th>库存水位</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${inv.map(i => { const st = stockStatus(i); const pct = Math.min(100, Math.round(i.available / Math.max(i.safety * 1.5, 1) * 100)); return `<tr>
        <td class="mono cell-main">${i.sku}</td><td>${esc(i.name)}<div class="cell-sub">${i.cat}</div></td><td>${whName(i.warehouse)}</td>
        <td class="cell-main">${fmtNum(i.available)}</td><td>${fmtNum(i.reserved)}</td><td>${fmtNum(i.inbound)}</td><td>${fmtNum(i.safety)}</td>
        <td><div class="stock-bar"><i style="width:${pct}%;background:${pct < 35 ? 'var(--danger)' : pct < 70 ? 'var(--warning)' : 'var(--success)'}"></i></div></td>
        <td><span class="tag ${st.c}">${st.t}</span></td>
        <td><button class="btn btn-sm btn-ghost" data-stock-adjust="${i.sku}|${i.warehouse}">调整</button></td></tr>`; }).join('')}
      </tbody></table></div>
    </div>`;
  return page;
}

/* ================= Page: Analytics ================= */
function renderAnalytics() {
  const page = el('<div class="page"></div>');
  const t = trendData(14);
  const platData = PLATFORM_DEFS.slice(0, 6).map(p => ({ label: p.name, value: state.orders.filter(o => o.platform === p.id).length + ri(20, 60), color: p.color === '#000000' ? '#475569' : p.color }));
  const topProducts = PRODUCTS.slice(0, 6).map((p, i) => ({ label: p.name.slice(0, 9), value: state.orders.filter(o => o.items.some(x => x.sku === p.sku)).length * ri(2, 8) + 40 - i * 4 }));
  const countryData = COUNTRIES.slice(0, 6).map((c, i) => ({ label: c, value: 320 - i * 41 + ri(-10, 10) }));
  page.innerHTML = `
    <div class="grid g2">
      <div class="card card-pad"><div class="section-head"><div><h2>GMV 趋势</h2><p>近 14 天各平台销售金额（USD）</p></div></div><div class="chart-wrap">${lineChart([{ data: t.gmvArr, color: '#8b5cf6', fill: true }], t.labels, { uid: 2 })}</div></div>
      <div class="card card-pad"><div class="section-head"><div><h2>平台订单对比</h2><p>各平台订单量</p></div></div><div class="chart-wrap">${barChart(platData)}</div></div>
    </div>
    <div class="grid g2 mt16">
      <div class="card card-pad"><div class="section-head"><div><h2>热销商品 Top 6</h2><p>按销量排序</p></div></div>${hbarChart(topProducts)}</div>
      <div class="card card-pad"><div class="section-head"><div><h2>销售国家分布</h2><p>Top 6 目的地</p></div></div>${hbarChart(countryData)}</div>
    </div>
    <div class="card card-pad mt16"><div class="section-head"><div><h2>经营指标摘要</h2><p>近 30 天核心指标</p></div></div>
      <div class="stat-strip">
        <div class="stat-cell"><div class="v">${fmtNum(metrics().gmv)}</div><div class="l">GMV (USD)</div></div>
        <div class="stat-cell"><div class="v">${fmtNum(metrics().monthOrders.length)}</div><div class="l">订单数</div></div>
        <div class="stat-cell"><div class="v">$${(metrics().gmv / Math.max(metrics().monthOrders.length, 1)).toFixed(2)}</div><div class="l">客单价</div></div>
        <div class="stat-cell"><div class="v">${(metrics().gmv > 0 ? (1 - metrics().monthOrders.reduce((s, o) => s + o.items.reduce((a, x) => a + (PRODUCTS.find(p => p.sku === x.sku)?.cost || 0) * x.qty, 0), 0) / metrics().gmv) * 100 : 0).toFixed(1)}%</div><div class="l">毛利率</div></div>
      </div>
    </div>`;
  return page;
}

/* ================= Page: Settings ================= */
function renderSettings() {
  const page = el('<div class="page"></div>');
  const s = state.settings;
  page.innerHTML = `
    <div class="grid g2">
      <div class="card card-pad">
        <div class="section-head"><div><h2>同步策略</h2><p>订单与库存的自动同步规则</p></div></div>
        <div class="config-row"><div class="info"><div class="t">启用自动同步</div><div class="d">按设定间隔自动拉取各平台数据</div></div><div class="switch ${s.autoSync ? 'on' : ''}" data-set="autoSync"></div></div>
        <div class="config-row"><div class="info"><div class="t">同步间隔</div><div class="d">两次自动同步之间的分钟数</div></div><select class="select-sm" id="setInterval">${[5, 10, 15, 30, 60].map(v => `<option ${s.interval === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="config-row"><div class="info"><div class="t">失败重试次数</div><div class="d">接口异常时的自动重试上限</div></div><select class="select-sm" id="setRetry">${[1, 2, 3, 5].map(v => `<option ${s.retry === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="config-row"><div class="info"><div class="t">默认币种</div><div class="d">订单金额的展示币种</div></div><select class="select-sm" id="setCurrency"><option ${s.currency === 'USD' ? 'selected' : ''}>USD</option><option ${s.currency === 'CNY' ? 'selected' : ''}>CNY</option></select></div>
      </div>
      <div class="card card-pad">
        <div class="section-head"><div><h2>AI 助手</h2><p>右下角智能对话助手的数据源配置</p></div><button class="btn btn-sm" id="aiConfigOpen">配置</button></div>
        <div class="config-row"><div class="info"><div class="t">内置数据问答引擎</div><div class="d">默认启用，基于中台实时订单/库存/同步数据回答，无需密钥</div></div><span class="tag tag-success">已启用</span></div>
        <div class="config-row"><div class="info"><div class="t">大模型接入</div><div class="d">${aiCfg().apiKey ? `已配置 · ${esc(aiCfg().model)}` : '未配置 · 可填自己的 OpenAI 兼容 API Key'}</div></div><span class="tag ${aiCfg().apiKey ? 'tag-info' : 'tag-muted'}">${aiCfg().apiKey ? '已接入' : '可选'}</span></div>
      </div>
      <div class="card card-pad">
        <div class="section-head"><div><h2>告警规则</h2><p>异常与库存预警通知</p></div></div>
        <div class="config-row"><div class="info"><div class="t">邮件告警</div><div class="d">同步失败时发送邮件通知</div></div><div class="switch ${s.emailAlert ? 'on' : ''}" data-set="emailAlert"></div></div>
        <div class="config-row"><div class="info"><div class="t">低库存预警</div><div class="d">SKU 低于安全库存时提醒</div></div><div class="switch ${s.lowStockThreshold ? 'on' : ''}" data-set="lowStockThreshold"></div></div>
        <div class="config-row"><div class="info"><div class="t">ERP 连接告警</div><div class="d">ERP 接口不可用即时提醒</div></div><div class="switch on" data-set="erpAlert"></div></div>
        <div style="margin-top:18px"><button class="btn btn-primary" id="saveSettings">保存设置</button></div>
      </div>
    </div>
    <div class="card card-pad mt16"><div class="section-head"><div><h2>数据管理</h2><p>演示数据与本地缓存</p></div></div>
      <div class="config-row"><div class="info"><div class="t">重置演示数据</div><div class="d">恢复初始的订单、库存与同步日志（不可撤销）</div></div><button class="btn btn-sm btn-danger" id="resetData">重置数据</button></div>
      <div class="config-row"><div class="info"><div class="t">导出数据</div><div class="d">将当前订单与库存导出为 JSON 文件</div></div><button class="btn btn-sm" id="exportData">导出 JSON</button></div>
    </div>`;
  return page;
}

/* ================= Drawer: Order detail ================= */
function openOrderDrawer(id) {
  const o = state.orders.find(x => x.id === id); if (!o) return;
  const p = platById(o.platform);
  $('#drawerTitle').textContent = '订单详情';
  $('#drawerSubtitle').textContent = o.id;
  $('#drawerBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:18px">${platLogo(p, true)}<div><div style="font-weight:700">${p.name}</div><div class="muted" style="font-size:11.5px">平台订单号 ${o.platformOrder}</div></div><div style="margin-left:auto">${statusTag(o.status)}</div></div>
    <div class="block-title">基本信息</div>
    <div class="info-grid">
      <div class="info-item"><div class="l">客户</div><div class="v">${esc(o.customer)}</div></div>
      <div class="info-item"><div class="l">目的国家</div><div class="v">${o.country}</div></div>
      <div class="info-item"><div class="l">下单时间</div><div class="v">${fmtDate(new Date(o.time), true)}</div></div>
      <div class="info-item"><div class="l">履约仓</div><div class="v">${whName(o.warehouse)}</div></div>
      <div class="info-item"><div class="l">订单金额</div><div class="v" style="color:var(--primary)">${money(o.amount)}</div></div>
      <div class="info-item"><div class="l">ERP 同步</div><div class="v">${syncTag(o.syncStatus)}</div></div>
    </div>
    <div class="block-title">商品明细</div>
    ${o.items.map(it => `<div class="item-row"><div class="item-thumb"><svg viewBox="0 0 24 24" class="ico"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg></div>
      <div style="flex:1"><div style="font-weight:600;font-size:12.5px">${esc(it.name)}</div><div class="muted mono" style="font-size:11px">${it.sku} · ${it.cat}</div></div>
      <div class="right"><div style="font-weight:600">${money(it.price * it.qty)}</div><div class="muted" style="font-size:11px">× ${it.qty}</div></div></div>`).join('')}
    <div class="block-title">同步时间线</div>
    <div class="timeline">
      <div class="tl-item"><div class="tl-dot"></div><div class="tl-title">订单接入中台</div><div class="tl-time">${fmtDate(new Date(o.time), true)}</div><div class="tl-desc">从 ${p.name} 增量拉取订单并写入统一订单池</div></div>
      <div class="tl-item"><div class="tl-dot ${o.syncStatus === 'failed' ? 'bad' : 'ok'}"></div><div class="tl-title">${o.syncStatus === 'success' ? '推送至 ERP 成功' : o.syncStatus === 'failed' ? '推送 ERP 失败' : '等待推送 ERP'}</div><div class="tl-time">${o.syncStatus === 'pending' ? '待处理' : fmtDate(new Date(new Date(o.time).getTime() + 1000 * 60 * 3), true)}</div><div class="tl-desc">${o.syncStatus === 'failed' ? 'ERP 接口返回超时，可点击重试' : o.syncStatus === 'pending' ? '将在下一次同步任务中推送' : '销售订单已写入 ERP，字段映射校验通过'}</div></div>
      ${o.status === 'shipped' || o.status === 'completed' ? `<div class="tl-item"><div class="tl-dot ok"></div><div class="tl-title">WMS 库存已扣减</div><div class="tl-time">同步完成</div><div class="tl-desc">履约仓 ${whName(o.warehouse)} 可用库存已更新</div></div>` : ''}
    </div>`;
  $('#drawerFoot').innerHTML = o.syncStatus === 'success'
    ? '<button class="btn" data-close-drawer>关闭</button>'
    : `<button class="btn" data-close-drawer>关闭</button><button class="btn btn-primary" data-sync-order="${o.id}">${o.syncStatus === 'failed' ? '重试同步' : '同步至 ERP'}</button>`;
  $('#drawer').classList.add('show'); $('#drawerOverlay').classList.add('show');
}
function closeDrawer() { $('#drawer').classList.remove('show'); $('#drawerOverlay').classList.remove('show'); }

/* ================= Modal ================= */
function openModal(title, body, foot) {
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body; $('#modalFoot').innerHTML = foot;
  $('#modalOverlay').classList.add('show');
}
function closeModal() { $('#modalOverlay').classList.remove('show'); }

/* ================= Actions ================= */
async function syncOrder(id, silent = false) {
  const o = state.orders.find(x => x.id === id); if (!o) return;
  if (o.syncStatus === 'success') { if (!silent) toast('该订单已同步', 'err'); return; }
  try {
    const data = await fetchJson('/api/orders/' + encodeURIComponent(id) + '/sync', { method: 'POST' });
    if (!data.ok) throw new Error(data.error || '同步失败');
    await reloadState();
    if (!silent) toast(`订单 ${id.slice(-8)} 已同步至 ERP，库存已扣减`, 'ok');
    navigate(currentPage);
    updateBadges();
  } catch (err) {
    if (!silent) toast('同步失败：' + err.message, 'err');
  }
}
async function bulkSync() {
  const pending = state.orders.filter(o => o.syncStatus !== 'success');
  if (!pending.length) { toast('没有待同步的订单'); return; }
  try {
    const data = await fetchJson('/api/orders/bulk-sync', { method: 'POST' });
    await reloadState();
    toast(`已提交 ${data.submitted} 条订单同步任务，成功 ${data.succeeded} 条`, 'ok');
    navigate(currentPage); updateBadges();
  } catch (err) { toast('批量同步失败：' + err.message, 'err'); }
}
function runFullSync() {
  if (syncRunning) return;
  syncRunning = true; navigate('sync');
  const bar = $('#syncProgBar'), pct = $('#syncProgPct'), label = $('#syncProgLabel'), prog = $('#syncProgress');
  if (prog) prog.style.display = 'block';
  let p = 0; const labels = ['采集平台订单…', '清洗与字段映射…', '写入统一订单池…', '推送 ERP…', '回写 WMS 库存…', '同步完成'];
  const timer = setInterval(() => {
    p = Math.min(100, p + ri(9, 19));
    if (bar) { bar.style.width = p + '%'; pct.textContent = p + '%'; label.textContent = labels[Math.min(labels.length - 1, Math.floor(p / 17))]; }
    if (p >= 100) {
      clearInterval(timer);
      // 真实写操作交给后端：加同步日志 + 更新平台/ERP lastSync
      fetchJson('/api/sync/full', { method: 'POST' }).then(async data => {
        syncRunning = false;
        await reloadState();
        toast(`全量同步完成，处理 ${data.records} 条订单`, 'ok');
        setTimeout(() => navigate('sync'), 500);
      }).catch(err => { syncRunning = false; toast('全量同步失败：' + err.message, 'err'); navigate('sync'); });
    }
  }, 260);
}
async function togglePlatform(id) {
  const p = state.platforms.find(x => x.id === id); if (!p) return;
  try {
    const data = await fetchJson('/api/platforms/' + encodeURIComponent(id) + '/toggle', { method: 'POST' });
    await reloadState(); navigate('platforms'); updateBadges();
    const np = state.platforms.find(x => x.id === id);
    toast(`${np.name} 已${np.connected ? '接入' : '断开'}`, np.connected ? 'ok' : '');
  } catch (err) { toast('操作失败：' + err.message, 'err'); }
}
async function syncPlatform(id) {
  const p = state.platforms.find(x => x.id === id); if (!p) return;
  try {
    await fetchJson('/api/platforms/' + encodeURIComponent(id) + '/sync', { method: 'POST' });
    await reloadState(); navigate('platforms');
    toast(`${p.name} 同步完成`, 'ok');
  } catch (err) { toast('同步失败：' + err.message, 'err'); }
}
function stockOpModal(op, skuWarehouse) {
  const isIn = op === 'in';
  let sku = '', wh = WAREHOUSES[0].id;
  if (skuWarehouse) { [sku, wh] = skuWarehouse.split('|'); }
  const opts = PRODUCTS.map(p => `<option value="${p.sku}" ${sku === p.sku ? 'selected' : ''}>${p.sku} · ${p.name}</option>`).join('');
  openModal(isIn ? '库存入库' : '库存出库', `
    <div class="form-group"><label>商品 SKU</label><select class="form-control" id="opSku">${opts}</select></div>
    <div class="form-group"><label>仓库</label><select class="form-control" id="opWh">${WAREHOUSES.map(w => `<option value="${w.id}" ${wh === w.id ? 'selected' : ''}>${w.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>${isIn ? '入库' : '出库'}数量</label><input class="form-control" id="opQty" type="number" min="1" value="50"><div class="form-hint">${isIn ? '入库后可用库存增加' : '出库将扣减对应仓库的可用库存'}</div></div>
    <div class="form-group"><label>备注</label><textarea class="form-control" id="opNote" placeholder="选填，例如：采购入库 / 平台订单出库"></textarea></div>`,
    `<button class="btn" data-close-modal>取消</button><button class="btn btn-primary" id="opConfirm">确认${isIn ? '入库' : '出库'}</button>`);
  $('#opConfirm').onclick = async () => {
    const s = $('#opSku').value, w = $('#opWh').value, q = +$('#opQty').value;
    if (!q || q <= 0) { toast('请输入有效数量', 'err'); return; }
    const inv = state.inventory.find(i => i.sku === s && i.warehouse === w);
    if (!inv) { toast('该 SKU 在此仓库不存在，请先新增库存记录', 'err'); return; }
    try {
      await fetchJson('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: s, warehouse: w, qty: q, op: isIn ? 'in' : 'out', remark: $('#opNote').value.trim() }),
      });
      await reloadState(); closeModal(); navigate('wms'); updateBadges();
      toast(`${isIn ? '入库' : '出库'} ${q} 件成功`, 'ok');
    } catch (err) { toast('调整失败：' + err.message, 'err'); }
  };
}
function updateBadges() {
  const low = state.inventory.filter(i => i.available < i.safety).length;
  $('#navWmsCount').textContent = low;
  $('#navPlatformCount').textContent = state.platforms.filter(p => p.connected).length;
  const fail = state.orders.filter(o => o.syncStatus === 'failed').length;
  $('#navSyncDot').style.display = fail ? 'block' : 'none';
}

/* 设置写操作统一走后端 */
async function updateSetting(key, value) {
  try {
    const data = await fetchJson('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    await reloadState();
    return data;
  } catch (err) { toast('设置失败：' + err.message, 'err'); }
}
async function saveAllSettings() {
  try {
    await fetchJson('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.settings),
    });
    await reloadState();
    toast('设置已保存', 'ok');
  } catch (err) { toast('保存失败：' + err.message, 'err'); }
}

/* ================= Event wiring ================= */
document.addEventListener('click', e => {
  if (e.target.closest('a')) return; // 外部链接走自身默认行为，不触发卡片/按钮逻辑
  const t = e.target.closest('[data-view-plat],[data-page],[data-go],[data-order],[data-order-detail],[data-sync-order],[data-toggle-plat],[data-sync-plat],[data-pg],[data-bulk-sync],[data-wh],[data-stock-op],[data-stock-adjust],[data-set],[data-erp-module],[data-close-drawer],[data-close-modal]');
  if (!t) return;
  if (t.dataset.viewPlat) {
    ordersFilter.platform = t.dataset.viewPlat;
    ordersFilter.status = ''; ordersFilter.sync = ''; ordersFilter.search = ''; ordersFilter.page = 1;
    navigate('orders'); return;
  }
  if (t.dataset.page) { navigate(t.dataset.page); return; }
  if (t.dataset.go) { navigate(t.dataset.go); return; }
  if (t.dataset.orderDetail) { openOrderDrawer(t.dataset.orderDetail); return; }
  if (t.dataset.syncOrder) { syncOrder(t.dataset.syncOrder); return; }
  if (t.dataset.order) { openOrderDrawer(t.dataset.order); return; }
  if (t.dataset.togglePlat) { togglePlatform(t.dataset.togglePlat); return; }
  if (t.dataset.syncPlat) { syncPlatform(t.dataset.syncPlat); return; }
  if (t.dataset.pg) {
    const v = t.dataset.pg;
    const total = Math.max(1, Math.ceil(filteredOrders().length / ordersFilter.size));
    ordersFilter.page = v === 'prev' ? Math.max(1, ordersFilter.page - 1) : v === 'next' ? Math.min(total, ordersFilter.page + 1) : +v;
    navigate('orders'); return;
  }
  if (t.dataset.bulkSync !== undefined) { bulkSync(); return; }
  if (t.dataset.wh) { activeWarehouse = t.dataset.wh; navigate('wms'); return; }
  if (t.dataset.stockOp) { stockOpModal(t.dataset.stockOp); return; }
  if (t.dataset.stockAdjust) {
    const [sku, wh] = t.dataset.stockAdjust.split('|');
    const inv = state.inventory.find(i => i.sku === sku && i.warehouse === wh);
    stockOpModal(inv && inv.available < inv.safety ? 'in' : 'out', t.dataset.stockAdjust); return;
  }
  if (t.dataset.set) {
    const k = t.dataset.set;
    const v = !state.settings[k];
    state.settings[k] = v;
    t.classList.toggle('on', v);
    updateSetting(k, v);
    return;
  }
  if (t.dataset.erpModule !== undefined) { t.classList.toggle('on'); toast('同步对象配置已更新'); return; }
  if (t.dataset.closeDrawer !== undefined) { closeDrawer(); return; }
  if (t.dataset.closeModal !== undefined) { closeModal(); return; }
});
document.addEventListener('input', e => {
  if (e.target.id === 'orderSearch') { ordersFilter.search = e.target.value; ordersFilter.page = 1; navigate('orders'); $('#orderSearch').focus(); }
  if (e.target.id === 'globalSearch') { ordersFilter.search = e.target.value; ordersFilter.page = 1; if (currentPage !== 'orders') navigate('orders'); $('#orderSearch')?.focus(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'fPlatform') { ordersFilter.platform = e.target.value; ordersFilter.page = 1; navigate('orders'); }
  if (e.target.id === 'fStatus') { ordersFilter.status = e.target.value; ordersFilter.page = 1; navigate('orders'); }
  if (e.target.id === 'fSync') { ordersFilter.sync = e.target.value; ordersFilter.page = 1; navigate('orders'); }
  if (e.target.id === 'setInterval') { state.settings.interval = +e.target.value; updateSetting('interval', state.settings.interval); }
  if (e.target.id === 'setRetry') { state.settings.retry = +e.target.value; updateSetting('retry', state.settings.retry); }
  if (e.target.id === 'setCurrency') { state.settings.currency = e.target.value; updateSetting('currency', state.settings.currency); }
});
$('#refreshBtn').onclick = async () => { await reloadState(); navigate(currentPage); toast('数据已刷新', 'ok'); };
$('#bellBtn').onclick = () => toast(`你有 ${state.inventory.filter(i => i.available < i.safety).length} 条库存预警待处理`);
$('#drawerClose').onclick = closeDrawer;
$('#drawerOverlay').onclick = closeDrawer;
$('#modalClose').onclick = closeModal;
$('#modalOverlay').onclick = e => { if (e.target.id === 'modalOverlay') closeModal(); };
$('#mobileMenu').onclick = () => $('#sidebar').classList.toggle('show');
document.addEventListener('click', e => {
  if (e.target.closest('#resetFilter')) { Object.assign(ordersFilter, { platform: '', status: '', sync: '', search: '', page: 1 }); navigate('orders'); }
  if (e.target.closest('#runSync')) runFullSync();
  if (e.target.closest('#testConn')) toast('所有平台 API 连接正常', 'ok');
  if (e.target.closest('#erpTest')) toast(`${state.erp.name} 连接正常`, 'ok');
  if (e.target.closest('#erpPush')) { toast('已提交全量订单推送任务', 'ok'); }
  if (e.target.closest('#addMapping')) toast('字段映射配置功能（演示）');
  if (e.target.closest('#genPo')) toast(`已生成 ${state.inventory.filter(i => i.available < i.safety).length} 条补货建议`, 'ok');
  if (e.target.closest('#saveSettings')) { saveAllSettings(); }
  if (e.target.closest('#resetData')) {
    openModal('重置演示数据', '<p style="font-size:13px;color:var(--text-2)">此操作将恢复初始的订单、库存与同步日志，且不可撤销。确定继续吗？</p>', '<button class="btn" data-close-modal>取消</button><button class="btn btn-danger" id="doReset">确认重置</button>');
    $('#doReset').onclick = async () => {
      try {
        const data = await fetchJson('/api/data/reset', { method: 'POST' });
        state = data.state || data;
        closeModal(); navigate('dashboard'); updateBadges(); toast('演示数据已重置', 'ok');
      } catch (err) { toast('重置失败：' + err.message, 'err'); }
    };
  }
  if (e.target.closest('#exportData')) {
    fetchJson('/api/data/export').then(data => {
      const blob = new Blob([JSON.stringify({ orders: data.orders, inventory: data.inventory }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'orderhub-data.json'; a.click(); URL.revokeObjectURL(a.href);
      toast('数据已导出', 'ok');
    }).catch(err => toast('导出失败：' + err.message, 'err'));
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDrawer(); closeModal(); } });

/* ================= AI Assistant =================
 * 内置引擎与大模型调用全部在服务端完成；浏览器只拿到答案，不接触密钥。
 */
function aiCfg() {
  return {
    baseUrl: aiConfigMeta.baseUrl,
    model: aiConfigMeta.model,
    apiKey: aiConfigMeta.configured ? 'configured' : '', // 占位值，仅用于 UI 状态判断
  };
}
async function saveAiCfg(cfg) {
  const data = await fetchJson('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  aiConfigMeta = { ...aiConfigMeta, ...data };
  return aiConfigMeta;
}

/* aiContext() / localAnswer() 已迁移到后端 services/ai.py，
 * 浏览器仅通过 /api/ai/chat 获取渲染好的答案。 */

let aiHistory = [];
function aiOpen() { $('#aiPanel').classList.add('show'); $('#aiInput').focus(); }
function aiClose() { $('#aiPanel').classList.remove('show'); }
function aiAppend(role, text) {
  const wrap = document.createElement('div');
  wrap.className = `ai-msg ${role}`;
  wrap.innerHTML = `<div class="ai-bubble">${text}</div>`;
  $('#aiMsgs').appendChild(wrap);
  $('#aiMsgs').scrollTop = $('#aiMsgs').scrollHeight;
  return wrap;
}
async function aiAsk(question) {
  if (!question.trim()) return;
  aiAppend('user', esc(question));
  $('#aiInput').value = '';
  const typing = aiAppend('bot', '<span class="ai-typing"><i></i><i></i><i></i></span>');
  try {
    const data = await fetchJson('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: aiHistory.slice(-8), question }),
    });
    const answer = String(data.answer || '').replace(/\n/g, '<br>');
    typing.querySelector('.ai-bubble').innerHTML = answer;
    aiHistory.push({ role: 'user', content: question }, { role: 'assistant', content: answer.replace(/<[^>]+>/g, '') });
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(-20);
    $('#aiMode').textContent = data.model ? `${data.model} · 已接入` : '基于中台实时数据';
  } catch (err) {
    typing.querySelector('.ai-bubble').innerHTML = '⚠️ 请求失败：' + esc(err.message);
  }
}
function initAi() {
  const cfg = aiCfg();
  $('#aiMode').textContent = cfg.apiKey ? `${cfg.model} · 已接入` : '基于中台实时数据';
  $('#aiQuick').innerHTML = ['今天多少订单？', '哪些 SKU 缺货？', '同步失败情况？', '各平台订单对比？'].map(q => `<button class="ai-chip" data-ai-q="${q}">${q}</button>`).join('');
  if (!$('#aiMsgs').children.length) aiAppend('bot', '你好！我是 OrderHub 智能助手，可以基于中台实时数据帮你查订单、库存、同步和 ERP 情况。<br>点下面的问题试试，或直接输入。');
}
document.addEventListener('click', e => {
  if (e.target.closest('#aiFab')) { $('#aiPanel').classList.contains('show') ? aiClose() : aiOpen(); return; }
  if (e.target.closest('#aiClose')) { aiClose(); return; }
  const chip = e.target.closest('[data-ai-q]'); if (chip) { aiAsk(chip.dataset.aiQ); return; }
  if (e.target.closest('#aiSend')) { aiAsk($('#aiInput').value); return; }
  if (e.target.closest('#aiConfigOpen')) { openAiConfig(); return; }
  if (e.target.closest('#aiCfgSave')) {
    const key = $('#aiKey').value.trim();
    saveAiCfg({
      baseUrl: $('#aiBase').value.trim() || 'https://api.deepseek.com/v1',
      model: $('#aiModel').value.trim() || 'deepseek-chat',
      apiKey: key,
      keepKey: !key && aiConfigMeta.configured,
    }).then(() => {
      closeModal(); initAi(); toast('AI 助手配置已保存（密钥仅存于服务端）', 'ok');
    }).catch(err => toast('保存失败：' + err.message, 'err'));
    return;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && document.activeElement?.id === 'aiInput') aiAsk($('#aiInput').value); });

function openAiConfig() {
  const c = aiCfg();
  openModal('AI 助手配置', `
    <div class="banner banner-info" style="margin-bottom:16px"><svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg><span>不填密钥也能用：默认走<b>内置数据引擎</b>，基于中台实时数据回答。填入你自己的 OpenAI 兼容 API Key 后可启用大模型自由问答。密钥仅保存在服务端，不会下发到浏览器。</span></div>
    <div class="form-group"><label>API Base URL</label><input class="form-control" id="aiBase" value="${esc(c.baseUrl)}" placeholder="https://api.deepseek.com/v1"><div class="form-hint">需为 OpenAI 兼容的 /chat/completions 接口，由服务端发起调用</div></div>
    <div class="form-group"><label>模型名称</label><input class="form-control" id="aiModel" value="${esc(c.model)}" placeholder="deepseek-chat"></div>
    <div class="form-group"><label>API Key</label><input class="form-control" id="aiKey" type="password" value="" placeholder="${c.apiKey ? '已配置，留空表示不修改' : '留空则使用内置数据引擎'}"></div>`,
    `<button class="btn" data-close-modal>取消</button><button class="btn btn-primary" id="aiCfgSave">保存配置</button>`);
}

/* ================= Boot ================= */
(async function boot() {
  try {
    await bootstrap();
    updateBadges();
    navigate('dashboard');
    initAi();
  } catch (err) {
    const content = $('#content');
    if (content) content.innerHTML = `<div class="page"><div class="card card-pad"><h2>后端服务不可用</h2><p>无法连接 OrderHub 后端 API：${esc(err.message)}</p><p>请先运行 <code>python main.py</code> 启动服务（端口 8790），然后刷新页面。</p></div></div>`;
  }
})();
