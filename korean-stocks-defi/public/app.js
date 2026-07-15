// ────────────────────────────────────────────────
//  MARKETS CONFIGURATION (Samsung & SK Hynix Only)
// ────────────────────────────────────────────────
const HL_LOGO = coin => `https://app.hyperliquid.xyz/coins/${coin}.svg`;

const MARKETS = [
  {
    symbol: 'SAMSUNG', name: '삼성전자', icon: HL_LOGO('xyz:SMSN'), iconFallback: '📱',
    color: '#1428A0', accentGrad: 'linear-gradient(90deg,#1428A0,#3b82f6)', iconBg: 'rgba(59,130,246,.15)',
    binance: { symbol: 'SAMSUNGUSDT', tradeUrl: 'https://www.binance.com/en/futures/SAMSUNGUSDT' },
    hl: { coin: 'xyz:SMSN', tradeUrl: 'https://app.hyperliquid.xyz/trade/xyz:SMSN' },
    krxTicker: '005930.KS'
  },
  {
    symbol: 'SKHYNIX', name: 'SK하이닉스', icon: HL_LOGO('xyz:SKHX'), iconFallback: '💾',
    color: '#E4003A', accentGrad: 'linear-gradient(90deg,#E4003A,#ef4444)', iconBg: 'rgba(239,68,68,.15)',
    binance: { symbol: 'SKHYNIXUSDT', tradeUrl: 'https://www.binance.com/en/futures/SKHYNIXUSDT' },
    hl: { coin: 'xyz:SKHX', tradeUrl: 'https://app.hyperliquid.xyz/trade/xyz:SKHX' },
    krxTicker: '000660.KS'
  }
];

// ────────────────────────────────────────────────
//  APIS & CONSTANTS
// ────────────────────────────────────────────────
const HL_API       = 'https://api.hyperliquid.xyz/info';
const BNF_BASE     = 'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=';
const REFRESH_MS   = 15000;
const MAX_HIST     = 30;

// ────────────────────────────────────────────────
//  STATE MANAGEMENT
// ────────────────────────────────────────────────
let usdKrw = null;
const prevBnf = {}, prevHl = {};
const bnfPx = {}, hlPx = {};
const priceHistory = {};

// Chart Modal State
let chartSymbol = null;
let chartRange  = 30;
let chartCandles = [];
let isKrxChart = false;
let krxSymbol = null;
let krxName = null;

// ────────────────────────────────────────────────
//  FORMATTING HELPERS
// ────────────────────────────────────────────────
function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtKRW(usd) {
  if (!usdKrw || usd == null) return null;
  return '₩' + Math.round(usd * usdKrw).toLocaleString('ko-KR');
}

function fmtDate(ts) {
  const d = new Date(ts);
  return (d.getMonth()+1) + '/' + d.getDate();
}

function fmtDateFull(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
}

// ────────────────────────────────────────────────
//  SPARKLINE DRAWER (HTML5 CANVAS)
// ────────────────────────────────────────────────
function addHistory(symbol, price) {
  if (!priceHistory[symbol]) priceHistory[symbol] = [];
  priceHistory[symbol].push(price);
  if (priceHistory[symbol].length > MAX_HIST) priceHistory[symbol].shift();
}

function drawSparkline(symbol) {
  const canvas = document.getElementById(`spark-${symbol}`);
  if (!canvas) return;
  const pts = priceHistory[symbol];
  if (!pts || pts.length < 2) return;
  
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth || 340, h = canvas.offsetHeight || 48;
  canvas.width = w * dpr; 
  canvas.height = h * dpr;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = (max - min) || (min * 0.001) || 1;
  const isUp = pts[pts.length - 1] >= pts[0];
  
  const lineCol = isUp ? '#10b981' : '#ef4444';
  const fillCol = isUp ? 'rgba(16,185,129,' : 'rgba(239,68,68,';
  
  const padX = 6, padY = 6;
  const xStep = (w - padX * 2) / (pts.length - 1);
  const coords = pts.map((p, i) => ({
    x: padX + i * xStep,
    y: padY + (1 - (p - min) / range) * (h - padY * 2)
  }));
  
  // Fill gradient below path
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fillCol + '0.15)');
  grad.addColorStop(1, fillCol + '0.01)');
  
  ctx.beginPath();
  ctx.moveTo(coords[0].x, h);
  ctx.lineTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i++) {
    const mx = (coords[i - 1].x + coords[i].x) / 2;
    const my = (coords[i - 1].y + coords[i].y) / 2;
    ctx.quadraticCurveTo(coords[i - 1].x, coords[i - 1].y, mx, my);
  }
  ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
  ctx.lineTo(coords[coords.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  
  // Draw line
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 1; i < coords.length; i++) {
    const mx = (coords[i - 1].x + coords[i].x) / 2;
    const my = (coords[i - 1].y + coords[i].y) / 2;
    ctx.quadraticCurveTo(coords[i - 1].x, coords[i - 1].y, mx, my);
  }
  ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  
  // Endpoint dot
  const last = coords[coords.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = lineCol;
  ctx.fill();
}

// ────────────────────────────────────────────────
//  DELTA FLOATING POPUP
// ────────────────────────────────────────────────
function showDelta(symbol, deltaKrw, isUp) {
  if (!deltaKrw || Math.abs(deltaKrw) < 1) return;
  const card = document.getElementById(`card-${symbol}`);
  if (!card) return;
  
  const popup = document.createElement('span');
  popup.className = `delta-popup ${isUp ? 'up' : 'down'}`;
  popup.textContent = (isUp ? '+' : '-') + '₩' + Math.round(Math.abs(deltaKrw)).toLocaleString('ko-KR');
  popup.style.left = '16px'; 
  popup.style.top = '100px';
  
  card.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

// ────────────────────────────────────────────────
//  DYNAMIC CARD GENERATOR
// ────────────────────────────────────────────────
function buildCard(m) {
  return `
    <div class="card loading" id="card-${m.symbol}">
      <div class="card-accent" style="background:${m.accentGrad}"></div>
      
      <div class="card-header">
        <div class="card-symbol-wrap">
          <div class="card-icon" style="background:${m.iconBg}">
            <img src="${m.icon}" alt="${m.symbol}" onerror="this.parentElement.textContent='${m.iconFallback}'">
          </div>
          <div class="card-info">
            <div class="card-symbol">${m.symbol}</div>
            <div class="card-name">${m.name}</div>
          </div>
        </div>
        <div class="card-badge-wrap">
          <span class="card-badge">PERP</span>
          <button class="chart-icon-btn" onclick="event.stopPropagation(); openChart('${m.symbol}')" title="차트보기">📈</button>
        </div>
      </div>

      <div class="sparkline-wrap" onclick="openChart('${m.symbol}')" title="차트 보기">
        <canvas id="spark-${m.symbol}"></canvas>
        <span class="sparkline-label">차트 클릭</span>
      </div>

      <div class="main-price-wrap">
        <div class="main-price skeleton" id="price-${m.symbol}">—</div>
        <div class="main-price-sub">
          <span class="main-usd skeleton" id="main-usd-${m.symbol}"></span>
          <span class="change-badge neutral skeleton" id="main-chg-${m.symbol}"></span>
        </div>
        <div class="price-source-label">
          <span class="binance-dot"></span>Binance Futures · ${m.binance.symbol}
        </div>
      </div>

      <div class="dex-compare">
        <div class="dex-col">
          <span class="dex-source-label">
            <span class="dex-dot" style="background:#a855f7"></span>Hyperliquid
          </span>
          <div class="dex-price-val" id="hl-dex-${m.symbol}">조회 중...</div>
          <div class="dex-chg neutral" id="hl-dex-chg-${m.symbol}">—</div>
        </div>
        <div class="dex-divider"></div>
        <div class="dex-col" style="text-align: right; align-items: flex-end;">
          <span class="dex-source-label">스프레드</span>
          <div class="dex-price-val" id="spread-val-${m.symbol}">—</div>
          <div class="dex-chg neutral" id="spread-pct-${m.symbol}">—</div>
        </div>
      </div>

      <div class="card-stats">
        <div class="stat-item">
          <span class="stat-label">24H 최고</span>
          <span class="stat-value" id="high-${m.symbol}">—</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24H 최저</span>
          <span class="stat-value" id="low-${m.symbol}">—</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24H 거래량</span>
          <span class="stat-value" id="vol-${m.symbol}">—</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">24H 시가</span>
          <span class="stat-value" id="open-${m.symbol}">—</span>
        </div>
      </div>

      <div class="card-actions">
        <a href="${m.binance.tradeUrl}" target="_blank" rel="noopener" class="trade-btn binance-btn" onclick="event.stopPropagation()">Binance</a>
        <a href="${m.hl.tradeUrl}" target="_blank" rel="noopener" class="trade-btn hl-btn" onclick="event.stopPropagation()">Hyperliquid</a>
        <button class="trade-btn news-btn" onclick="event.stopPropagation(); openNews('${m.symbol}')">📰 뉴스</button>
      </div>
    </div>`;
}

// ────────────────────────────────────────────────
//  PRICE UPDATER FUNCTIONS
// ────────────────────────────────────────────────
function updateBinanceMain(m, d) {
  const price  = parseFloat(d.lastPrice);
  const open   = parseFloat(d.openPrice);
  const high   = parseFloat(d.highPrice);
  const low    = parseFloat(d.lowPrice);
  const chgPct = parseFloat(d.priceChangePercent);

  bnfPx[m.symbol] = price;
  const prev = prevBnf[m.symbol];
  const isUp   = prev !== undefined && price > prev;
  const isDown = prev !== undefined && price < prev;
  const deltaKrw = (prev !== undefined && usdKrw) ? (price-prev)*usdKrw : 0;
  prevBnf[m.symbol] = price;

  // Add to history and draw sparkline
  addHistory(m.symbol, price);
  requestAnimationFrame(() => drawSparkline(m.symbol));

  const card = document.getElementById(`card-${m.symbol}`);
  if (!card) return;
  card.classList.remove('loading');
  
  // Glow animation trigger
  card.classList.remove('flash-up', 'flash-down');
  void card.offsetWidth; // Trigger reflow
  if (isUp) card.classList.add('flash-up');
  else if (isDown) card.classList.add('flash-down');

  // Set prices
  const priceEl = document.getElementById(`price-${m.symbol}`);
  if (priceEl) {
    priceEl.classList.remove('skeleton', 'up', 'down');
    priceEl.textContent = fmtKRW(price) ?? ('$' + fmt(price));
    if (isUp) priceEl.classList.add('up');
    else if (isDown) priceEl.classList.add('down');
  }
  
  if (isUp || isDown) {
    showDelta(m.symbol, deltaKrw, isUp);
  }

  // USD + Change badge
  const usdEl = document.getElementById(`main-usd-${m.symbol}`);
  if (usdEl) {
    usdEl.classList.remove('skeleton');
    usdEl.textContent = '$' + fmt(price);
  }
  
  const chgEl = document.getElementById(`main-chg-${m.symbol}`);
  if (chgEl) {
    chgEl.classList.remove('skeleton', 'up', 'down', 'neutral');
    if (chgPct > 0) {
      chgEl.classList.add('up');
      chgEl.textContent = '▲ +' + chgPct.toFixed(2) + '%';
    } else if (chgPct < 0) {
      chgEl.classList.add('down');
      chgEl.textContent = '▼ ' + Math.abs(chgPct).toFixed(2) + '%';
    } else {
      chgEl.classList.add('neutral');
      chgEl.textContent = '0.00%';
    }
  }

  // Stats
  const h = document.getElementById(`high-${m.symbol}`);
  const l = document.getElementById(`low-${m.symbol}`);
  const v = document.getElementById(`vol-${m.symbol}`);
  const o = document.getElementById(`open-${m.symbol}`);
  if (h) h.textContent = fmtKRW(high) ?? ('$' + fmt(high));
  if (l) l.textContent = fmtKRW(low)  ?? ('$' + fmt(low));
  if (v) v.textContent = '$' + fmt(volArrSum(d.volume, price)); // Quote volume in USD
  if (o) o.textContent = fmtKRW(open) ?? ('$' + fmt(open));

  updateSpreadAndDEX(m);
}

function volArrSum(baseVol, price) {
  const v = parseFloat(baseVol) || 0;
  return v * price;
}

function updateHLCol(m, d) {
  if (d.price == null) return;
  hlPx[m.symbol] = d.price;
  prevHl[m.symbol] = d.price;

  const dexPriceEl = document.getElementById(`hl-dex-${m.symbol}`);
  if (dexPriceEl) {
    dexPriceEl.style.opacity = '1';
    dexPriceEl.textContent = fmtKRW(d.price) ?? ('$' + fmt(d.price));
  }
  
  const dexChgEl = document.getElementById(`hl-dex-chg-${m.symbol}`);
  if (dexChgEl) {
    dexChgEl.className = 'dex-chg';
    if (d.change > 0) {
      dexChgEl.classList.add('up');
      dexChgEl.textContent = '▲ +' + d.change.toFixed(2) + '%';
    } else if (d.change < 0) {
      dexChgEl.classList.add('down');
      dexChgEl.textContent = '▼ ' + Math.abs(d.change).toFixed(2) + '%';
    } else {
      dexChgEl.classList.add('neutral');
      dexChgEl.textContent = '—';
    }
  }

  updateSpreadAndDEX(m);
}

function updateSpreadAndDEX(m) {
  const bnf = bnfPx[m.symbol];
  const hl = hlPx[m.symbol];
  if (!bnf || !hl) return;

  const diff = Math.abs(bnf - hl);
  const pct = (diff / Math.min(bnf, hl)) * 100;

  const valEl = document.getElementById(`spread-val-${m.symbol}`);
  const pctEl = document.getElementById(`spread-pct-${m.symbol}`);

  if (valEl) {
    valEl.textContent = fmtKRW(diff) ?? ('$' + fmt(diff));
  }
  
  if (pctEl) {
    pctEl.className = 'dex-chg';
    if (pct < 0.2) {
      pctEl.classList.add('up');
      pctEl.textContent = `${pct.toFixed(2)}% (안정)`;
    } else if (pct < 0.8) {
      pctEl.classList.add('neutral');
      pctEl.textContent = `${pct.toFixed(2)}%`;
    } else {
      pctEl.classList.add('down');
      pctEl.textContent = `${pct.toFixed(2)}% (괴리)`;
    }
  }
}

// ────────────────────────────────────────────────
//  PUBLIC API FETCH CALLS
// ────────────────────────────────────────────────
async function fetchBinance(symbol) {
  const res = await fetch(BNF_BASE + symbol);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  return await res.json();
}

async function fetchHLMarket(coin) {
  const now = Date.now(), yesterday = now - 86400000;
  const [bookData, candleData] = await Promise.all([
    fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'l2Book', coin })
    }).then(r => r.json()),
    fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: '1h', startTime: yesterday, endTime: now } })
    }).then(r => r.json())
  ]);

  let price = null;
  const bids = bookData?.levels?.[0], asks = bookData?.levels?.[1];
  if (bids?.length && asks?.length) price = (parseFloat(bids[0].px) + parseFloat(asks[0].px)) / 2;
  else if (bids?.length) price = parseFloat(bids[0].px);

  let change = 0, high24h = null, low24h = null, vol24h = 0;
  if (Array.isArray(candleData) && candleData.length > 0) {
    const open24h = parseFloat(candleData[0].o);
    high24h = Math.max(...candleData.map(c => parseFloat(c.h)));
    low24h = Math.min(...candleData.map(c => parseFloat(c.l)));
    if (price && open24h) change = ((price - open24h) / open24h) * 100;
    candleData.forEach(c => { vol24h += parseFloat(c.v) * parseFloat(c.c); });
  }
  return { price, change, high24h, low24h, vol24h };
}

async function fetchHLCandles(coin, days) {
  const now = Date.now();
  const start = now - days * 86400000;
  const res = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: '1d', startTime: start, endTime: now } })
  });
  return res.json();
}

// ────────────────────────────────────────────────
//  REFRESH SYSTEM
// ────────────────────────────────────────────────
async function refreshAll() {
  // Fetch USD/KRW exchange rate from backend
  try {
    const res = await fetch('/api/usd-krw');
    const json = await res.json();
    if (json.ok) {
      usdKrw = json.rate;
      const rateEl = document.getElementById('headerExchangeRate');
      if (rateEl) {
        rateEl.textContent = `환율: ₩${fmt(usdKrw, 0)}`;
      }
    }
  } catch (e) {
    console.error('Exchange rate fetch error:', e.message);
  }

  // Fetch stock tickers in parallel
  await Promise.all(MARKETS.map(async (m) => {
    // 1. Fetch Binance
    try {
      const bnfData = await fetchBinance(m.binance.symbol);
      updateBinanceMain(m, bnfData);
    } catch (e) {
      console.warn(`Error updating Binance ${m.symbol}:`, e.message);
    }

    // 2. Fetch Hyperliquid (with corporate firewall fail-safe fallback)
    try {
      const hlData = await fetchHLMarket(m.hl.coin);
      updateHLCol(m, hlData);
    } catch (e) {
      console.warn(`Hyperliquid fetch blocked by firewall for ${m.symbol}, applying backup values.`, e.message);
      
      // Graceful fallback to Binance price to keep UI operational
      if (bnfPx[m.symbol]) {
        const fallbackPrice = bnfPx[m.symbol];
        hlPx[m.symbol] = fallbackPrice;
        
        const dexPriceEl = document.getElementById(`hl-dex-${m.symbol}`);
        if (dexPriceEl) {
          dexPriceEl.style.opacity = '0.6';
          dexPriceEl.textContent = fmtKRW(fallbackPrice) ?? ('$' + fmt(fallbackPrice));
        }
        
        const dexChgEl = document.getElementById(`hl-dex-chg-${m.symbol}`);
        if (dexChgEl) {
          dexChgEl.className = 'dex-chg neutral';
          dexChgEl.textContent = '방화벽 차단됨';
        }
        
        updateSpreadAndDEX(m);
      }
    }
  }));

  const lastUpdateEl = document.getElementById('lastUpdate');
  if (lastUpdateEl) {
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastUpdateEl.textContent = '업데이트: ' + timeStr;
  }
}

// ────────────────────────────────────────────────
//  KRX REAL-TIME SYNC
// ────────────────────────────────────────────────
async function loadKRX() {
  const grid = document.getElementById('krxGrid');
  const status = document.getElementById('krxStatus');
  const stTxt = document.getElementById('krxStatusText');
  if (!grid) return;

  try {
    const res = await fetch(`/api/krx?_=${Date.now()}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    const stocks = json.data;
    const isOpen = stocks.some(s => s.state === 'REGULAR');

    status.className = 'krx-status ' + (isOpen ? 'open' : 'closed');
    if (stTxt) stTxt.textContent = isOpen ? '장 중 (09:00~15:30)' : '장 마감';

    grid.innerHTML = stocks.map(s => {
      const isUp = s.change > 0;
      const isDown = s.change < 0;
      const priceClass = isUp ? 'up' : isDown ? 'down' : '';
      const chgClass = isUp ? 'up' : isDown ? 'down' : 'flat';
      const arrow = isUp ? '▲' : isDown ? '▼' : '';
      const chgStr = s.change != null
        ? `${arrow} ${Math.abs(s.change).toLocaleString('ko-KR')} (${isUp ? '+' : ''}${s.changePct.toFixed(2)}%)`
        : '—';
      const ticker = s.symbol.replace('.KS', '');

      return `
        <div class="krx-item" onclick="openKRXChart('${s.symbol}','${s.name}')">
          <div class="krx-item-left">
            <span class="krx-name">${s.name}</span>
            <span class="krx-ticker">${ticker}</span>
          </div>
          <div class="krx-item-right">
            <span class="krx-price ${priceClass}">₩${s.price.toLocaleString('ko-KR')}</span>
            <span class="krx-change ${chgClass}">${chgStr}</span>
            <span class="krx-vol">거래량 ${fmtKRXVol(s.volume)}</span>
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    grid.innerHTML = `<div class="krx-error" style="padding:16px;text-align:center;color:#ef4444;font-size:12px;">현물 데이터를 불러오지 못했습니다 (${e.message})</div>`;
  }
}

function fmtKRXVol(v) {
  if (!v) return '—';
  if (v >= 1e6) return (v/1e6).toFixed(1)+'백만주';
  if (v >= 1e4) return (v/1e4).toFixed(0)+'만주';
  return v.toLocaleString('ko-KR')+'주';
}

// ────────────────────────────────────────────────
//  HISTORICAL CHART MODAL SYSTEM
// ────────────────────────────────────────────────
function openChart(symbol) {
  const m = MARKETS.find(x => x.symbol === symbol);
  if (!m) return;

  isKrxChart = false;
  chartSymbol = symbol;
  chartRange = 30;

  // Header settings
  document.getElementById('modalIcon').innerHTML = `<img src="${m.icon}" alt="${m.symbol}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" onerror="this.parentElement.textContent='${m.iconFallback}'">`;
  document.getElementById('modalIcon').style.background = m.iconBg;
  document.getElementById('modalTitle').textContent = `${m.symbol} · ${m.name}`;
  document.getElementById('modalSub').textContent = `Hyperliquid xyz 선물 · ${m.hl.coin}`;
  document.getElementById('chartSourceSpan').textContent = 'Hyperliquid';
  
  // Set tab buttons target
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', [7, 30, 90][i] === 30);
    b.onclick = () => setChartRange([7, 30, 90][i]);
  });

  document.getElementById('chartModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  loadChartData();
}

function openKRXChart(symbol, name) {
  isKrxChart = true;
  krxSymbol = symbol;
  krxName = name;
  chartRange = 30;

  const m = MARKETS.find(x => x.krxTicker === symbol);
  const iconHtml = m 
    ? `<img src="${m.icon}" alt="${name}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" onerror="this.parentElement.textContent='${m.iconFallback}'">`
    : '📊';
  const iconBg = m ? m.iconBg : 'rgba(120, 120, 120, 0.15)';

  document.getElementById('modalIcon').innerHTML = iconHtml;
  document.getElementById('modalIcon').style.background = iconBg;
  document.getElementById('modalTitle').textContent = `${name} · 현물`;
  document.getElementById('modalSub').textContent = `한국거래소(KRX) 주식 · Yahoo Finance`;
  document.getElementById('chartSourceSpan').textContent = 'Yahoo Finance';

  // Set tab buttons target
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', [7, 30, 90][i] === 30);
    b.onclick = () => setChartRange([7, 30, 90][i]);
  });

  document.getElementById('chartModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  loadChartData();
}

function closeChart() {
  document.getElementById('chartModal').style.display = 'none';
  document.body.style.overflow = '';
  chartSymbol = null;
  chartCandles = [];
}

function onModalOverlayClick(e) {
  if (e.target.id === 'chartModal') closeChart();
}

function setChartRange(days) {
  chartRange = days;
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', [7, 30, 90][i] === days));
  loadChartData();
}

async function loadChartData() {
  const canvas = document.getElementById('chartCanvas');
  const loading = document.getElementById('chartLoading');
  const summary = document.getElementById('chartSummary');
  
  canvas.style.opacity = '0';
  loading.style.display = 'flex';
  summary.innerHTML = '';

  try {
    let candles = [];
    if (isKrxChart) {
      const res = await fetch(`/api/krx-candles?symbol=${krxSymbol}&range=${chartRange}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      candles = json.candles;
    } else {
      const m = MARKETS.find(x => x.symbol === chartSymbol);
      if (!m) return;
      
      try {
        const data = await fetchHLCandles(m.hl.coin, chartRange + 2);
        if (!Array.isArray(data)) throw new Error('Data empty');
        candles = data.slice(-chartRange).map(c => ({
          t: c.t,
          o: parseFloat(c.o),
          h: parseFloat(c.h),
          l: parseFloat(c.l),
          c: parseFloat(c.c),
          v: parseFloat(c.v)
        }));
      } catch (hlErr) {
        console.warn('Hyperliquid candle fetch failed due to firewall, using KOSPI candles fallback.', hlErr.message);
        
        // Load Yahoo Finance KOSPI candles as fallback
        const res = await fetch(`/api/krx-candles?symbol=${m.krxTicker}&range=${chartRange}`);
        const json = await res.json();
        if (!json.ok) throw new Error('DEX 차트 차단 및 현물 대체 차트 로드 실패');
        candles = json.candles;
        document.getElementById('chartSourceSpan').textContent = 'Yahoo Finance (방화벽 대체)';
      }
    }

    chartCandles = candles;
    loading.style.display = 'none';
    canvas.style.opacity = '1';

    renderChartSummary(chartCandles);
    renderChart(chartCandles);

    const updateTimeEl = document.getElementById('chartUpdateTime');
    if (updateTimeEl) {
      updateTimeEl.textContent = '차트 갱신: ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {
    loading.innerHTML = `<span style="color:#ef4444;font-size:12px;">데이터 로드에 실패했습니다 (${e.message})</span>`;
  }
}

function renderChartSummary(candles) {
  if (!candles.length) return;
  const first = candles[0], last = candles[candles.length - 1];
  const open = first.o;
  const close = last.c;
  const high = Math.max(...candles.map(c => c.h));
  const low = Math.min(...candles.map(c => c.l));
  const chg = ((close - open) / open) * 100;
  const isUp = chg >= 0;

  const displayClose = (isKrxChart || document.getElementById('chartSourceSpan').textContent.includes('Yahoo')) ? `₩${Math.round(close).toLocaleString('ko-KR')}` : (fmtKRW(close) ?? ('$' + fmt(close)));
  const displayHigh = (isKrxChart || document.getElementById('chartSourceSpan').textContent.includes('Yahoo')) ? `₩${Math.round(high).toLocaleString('ko-KR')}` : (fmtKRW(high) ?? ('$' + fmt(high)));
  const displayLow = (isKrxChart || document.getElementById('chartSourceSpan').textContent.includes('Yahoo')) ? `₩${Math.round(low).toLocaleString('ko-KR')}` : (fmtKRW(low) ?? ('$' + fmt(low)));

  document.getElementById('chartSummary').innerHTML = `
    <div class="summary-item">
      <span class="stat-label">현재 가격</span>
      <span class="summary-val ${isUp ? 'up' : 'down'}">${displayClose}</span>
    </div>
    <div class="summary-item">
      <span class="stat-label">${chartRange}D 변동률</span>
      <span class="summary-val ${isUp ? 'up' : 'down'}">${isUp ? '▲ +' : '▼ '}${Math.abs(chg).toFixed(2)}%</span>
    </div>
    <div class="summary-item">
      <span class="stat-label">기간 최고가</span>
      <span class="summary-val">${displayHigh}</span>
    </div>
    <div class="summary-item">
      <span class="stat-label">기간 최저가</span>
      <span class="summary-val">${displayLow}</span>
    </div>`;
}

function renderChart(candles) {
  const canvas = document.getElementById('chartCanvas');
  if (!canvas || !candles.length) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volArr = candles.map(c => c.v);

  const padL = 48, padR = 12, padT = 10, padB = 30, volH = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB - volH - 6;

  const minP = Math.min(...lows) * 0.998;
  const maxP = Math.max(...highs) * 1.002;
  const rangeP = maxP - minP;
  const maxVol = Math.max(...volArr);

  const n = candles.length;
  const xStep = chartW / (n - 1 || 1);

  const usingKRW = isKrxChart || document.getElementById('chartSourceSpan').textContent.includes('Yahoo');

  function px(price) { return padT + (1 - (price - minP) / rangeP) * chartH; }
  function xi(i) { return padL + i * xStep; }

  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;

  // Grid Lines
  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const y = padT + (g / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    const price = maxP - (g / gridLines) * rangeP;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px Outfit, system-ui';
    ctx.textAlign = 'right';
    
    const priceStr = usingKRW 
      ? Math.round(price).toLocaleString('ko-KR') 
      : fmt(price, price > 100 ? 0 : 2);
    ctx.fillText((usingKRW ? '₩' : '$') + priceStr, padL - 6, y + 3.5);
  }

  // Volume Bars
  const volY0 = padT + chartH + 6;
  volArr.forEach((v, i) => {
    if (!maxVol) return;
    const barH = (v / maxVol) * volH;
    const isUp = candles[i].c >= candles[i].o;
    ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    const bw = Math.max(2, xStep * 0.5);
    ctx.fillRect(xi(i) - bw / 2, volY0 + volH - barH, bw, barH);
  });

  // Price line color
  const isUpOverall = closes[closes.length - 1] >= closes[0];
  const lineCol = isUpOverall ? '#10b981' : '#ef4444';
  const fillCol = isUpOverall ? 'rgba(16,185,129,' : 'rgba(239,68,68,';

  // Area Fill
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, fillCol + '0.15)');
  grad.addColorStop(1, fillCol + '0.01)');

  ctx.beginPath();
  ctx.moveTo(xi(0), padT + chartH);
  ctx.lineTo(xi(0), px(closes[0]));
  for (let i = 1; i < n; i++) {
    const mx = (xi(i - 1) + xi(i)) / 2;
    ctx.bezierCurveTo(mx, px(closes[i - 1]), mx, px(closes[i]), xi(i), px(closes[i]));
  }
  ctx.lineTo(xi(n - 1), padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Price Line
  ctx.beginPath();
  ctx.moveTo(xi(0), px(closes[0]));
  for (let i = 1; i < n; i++) {
    const mx = (xi(i - 1) + xi(i)) / 2;
    ctx.bezierCurveTo(mx, px(closes[i - 1]), mx, px(closes[i]), xi(i), px(closes[i]));
  }
  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Highlight Last Dot
  ctx.beginPath();
  ctx.arc(xi(n - 1), px(closes[n - 1]), 4.5, 0, Math.PI * 2);
  ctx.fillStyle = lineCol;
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Date Labels
  ctx.fillStyle = '#9ca3af';
  ctx.font = '9px Outfit, system-ui';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(n / 6));
  candles.forEach((c, i) => {
    if (i % labelStep === 0 || i === n - 1) {
      ctx.fillText(fmtDate(c.t), xi(i), H - padB + 12);
    }
  });

  // Crosshair & Hover details
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round((mx - padL) / xStep);
    if (idx < 0 || idx >= n) {
      document.getElementById('chartTooltip').style.display = 'none';
      return;
    }

    const c = candles[idx];
    document.getElementById('ttDate').textContent = fmtDateFull(c.t);
    
    const pref = usingKRW ? '₩' : '$';
    const formatter = usingKRW ? (val => Math.round(val).toLocaleString('ko-KR')) : (val => fmt(val));

    document.getElementById('ttClose').textContent = pref + formatter(c.c);
    document.getElementById('ttHigh').textContent  = pref + formatter(c.h);
    document.getElementById('ttLow').textContent   = pref + formatter(c.l);
    document.getElementById('ttVol').textContent   = Math.round(c.v).toLocaleString('ko-KR');

    const tooltip = document.getElementById('chartTooltip');
    tooltip.style.display = 'block';
    const tw = tooltip.offsetWidth;
    let tx = xi(idx) + 12;
    if (tx + tw > W - padR) tx = xi(idx) - tw - 12;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = (px(c.c) - 20) + 'px';

    // Redraw and show vertical lines
    renderChart(candles);
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xi(idx), padT);
    ctx.lineTo(xi(idx), padT + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(xi(idx), px(c.c), 6, 0, Math.PI * 2);
    ctx.fillStyle = lineCol;
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  canvas.onmouseleave = () => {
    document.getElementById('chartTooltip').style.display = 'none';
    renderChart(candles);
  };
}

// ────────────────────────────────────────────────
//  NEWS POPUP & COMPACT LIST SYSTEM
// ────────────────────────────────────────────────
const STOCK_NEWS_QUERY = {
  SAMSUNG: '삼성전자 주가 KOSPI',
  SKHYNIX: 'SK하이닉스 반도체 주가'
};

function openNews(symbol) {
  const m = MARKETS.find(x => x.symbol === symbol);
  if (!m) return;

  document.getElementById('newsModalIcon').innerHTML = `<img src="${m.icon}" alt="${m.symbol}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" onerror="this.parentElement.textContent='${m.iconFallback}'">`;
  document.getElementById('newsModalIcon').style.background = m.iconBg;
  document.getElementById('newsModalName').textContent = `${m.symbol} · ${m.name}`;
  document.getElementById('newsModalSub').textContent = '최신 뉴스 (최근 7일)';
  document.getElementById('newsModalList').innerHTML = `<div class="news-modal-loading"><div class="spinner"></div> 실시간 기사 수집 중...</div>`;

  document.getElementById('newsModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  loadStockNews(symbol);
}

function closeNews() {
  document.getElementById('newsModal').style.display = 'none';
  document.body.style.overflow = '';
}

function onNewsOverlayClick(e) {
  if (e.target.id === 'newsModal') closeNews();
}

async function loadStockNews(symbol) {
  const listEl = document.getElementById('newsModalList');
  if (!listEl) return;

  try {
    const query = STOCK_NEWS_QUERY[symbol] || symbol;
    const rssUrl = encodeURIComponent(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko&tbs=qdr:w`);
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    const data = await res.json();

    if (data.status !== 'ok' || !data.items?.length) throw new Error('No items');

    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    const fresh = data.items
      .map(item => ({ ...item, _ts: new Date(item.pubDate + ' UTC').getTime() }))
      .filter(item => (now - item._ts) <= maxAge && !isNaN(item._ts))
      .sort((a, b) => b._ts - a._ts);

    if (!fresh.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary);font-size:12px;">최근 7일 간 보도된 뉴스가 없습니다.</div>';
      return;
    }

    listEl.innerHTML = fresh.map((item, i) => {
      const ageMs = now - item._ts;
      const timeLabel = formatNewsAge(ageMs);
      const source = cleanSource(item.title, item.author);
      const title = cleanTitle(item.title);

      return `
        <a class="news-item" href="${item.link}" target="_blank" rel="noopener">
          <span class="news-num">${i + 1}</span>
          <div class="news-content">
            <div class="news-headline">${title}</div>
            <div class="news-meta">
              <span class="news-source">${source}</span>
              <span>·</span>
              <span class="news-time">${timeLabel}</span>
            </div>
          </div>
        </a>`;
    }).join('');

  } catch (e) {
    listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#ef4444;font-size:12px;">뉴스 정보를 가져오지 못했습니다.</div>`;
  }
}

// Global KOSPI News
async function loadNews() {
  const listEl = document.getElementById('newsList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="news-loading"><div class="spinner"></div> 증시 속보 수집 중...</div>';

  try {
    const rss = encodeURIComponent('https://news.google.com/rss/search?q=코스피+증시+삼성전자+SK하이닉스&hl=ko&gl=KR&ceid=KR:ko&tbs=qdr:w');
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rss}`);
    const data = await res.json();

    if (data.status !== 'ok' || !data.items?.length) throw new Error('No items');

    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    const fresh = data.items
      .map(item => ({ ...item, _ts: new Date(item.pubDate + ' UTC').getTime() }))
      .filter(item => (now - item._ts) <= maxAge && !isNaN(item._ts))
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 10);

    if (!fresh.length) {
      listEl.innerHTML = '<div class="news-loading">최근 관련 뉴스가 없습니다.</div>';
      return;
    }

    listEl.innerHTML = fresh.map((item, i) => {
      const ageMs = now - item._ts;
      const timeLabel = formatNewsAge(ageMs);
      const source = cleanSource(item.title, item.author);
      const title = cleanTitle(item.title);

      return `
        <a class="news-item" href="${item.link}" target="_blank" rel="noopener">
          <span class="news-num">${i + 1}</span>
          <div class="news-content">
            <div class="news-headline">${title}</div>
            <div class="news-meta">
              <span class="news-source">${source}</span>
              <span>·</span>
              <span class="news-time">${timeLabel}</span>
            </div>
          </div>
        </a>`;
    }).join('');

  } catch (e) {
    listEl.innerHTML = '<div class="news-loading" style="color:#ef4444">뉴스 갱신에 실패했습니다.</div>';
  }
}

function formatNewsAge(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function cleanSource(title, author) {
  if (author && author.trim()) return author.trim();
  const m = title.match(/ - (.+)$/);
  return m ? m[1].trim() : '언론사';
}

function cleanTitle(title) {
  return title.replace(/<[^>]*>/g, '').replace(/ - .+$/, '').trim();
}

// Escape key listener for modal closing
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeChart();
    closeNews();
  }
});

// ────────────────────────────────────────────────
//  APPLICATION INITIALIZATION
// ────────────────────────────────────────────────
const grid = document.getElementById('cardsGrid');
if (grid) {
  grid.innerHTML = MARKETS.map(buildCard).join('');
}

// Initial Sync
loadKRX();
loadNews();
refreshAll();

// Set interval loops
setInterval(loadKRX, 60 * 1000);     // Sync KRX once every minute
setInterval(loadNews, 5 * 60 * 1000);   // Fetch global KOSPI news every 5 minutes
setInterval(refreshAll, REFRESH_MS); // Update futures prices every 15 seconds
