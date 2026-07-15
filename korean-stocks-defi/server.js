process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Stock name map
const STOCK_NAMES = {
  '005930.KS': { name: '삼성전자', nameEn: 'Samsung Electronics' },
  '000660.KS': { name: 'SK하이닉스', nameEn: 'SK Hynix' }
};

// MIME Types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

// Helper: check if KRX is open (Mon-Fri 09:00 - 15:30 KST)
function getKrxMarketState() {
  const d = new Date();
  const kstOffset = 9 * 60; // 9 hours in minutes
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (kstOffset * 60000));
  
  const day = kst.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hour = kst.getHours();
  const minute = kst.getMinutes();
  
  if (day >= 1 && day <= 5) { // Mon-Fri
    const timeValue = hour * 100 + minute;
    if (timeValue >= 900 && timeValue <= 1530) {
      return 'REGULAR';
    }
  }
  return 'CLOSED';
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. API: Real-time KOSPI Stock Prices
  if (pathname === '/api/krx' && req.method === 'GET') {
    try {
      const symbols = ['005930.KS', '000660.KS'];
      const data = await Promise.all(symbols.map(async (symbol) => {
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        const response = await fetch(yahooUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
        const json = await response.json();
        const meta = json.chart?.result?.[0]?.meta;
        if (!meta) throw new Error(`No meta data for ${symbol}`);
        
        const price = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose || price;
        const change = price - prev;
        const changePct = prev !== 0 ? (change / prev) * 100 : 0;
        
        const info = STOCK_NAMES[symbol] || { name: meta.shortName, nameEn: meta.shortName };
        return {
          symbol: symbol,
          name: info.name,
          nameEn: info.nameEn,
          price: price,
          prev: prev,
          change: change,
          changePct: changePct,
          volume: meta.regularMarketVolume || 0,
          high: meta.regularMarketDayHigh || price,
          low: meta.regularMarketDayLow || price,
          state: getKrxMarketState(),
          currency: meta.currency || 'KRW'
        };
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, data, ts: Date.now() }));
    } catch (error) {
      console.error('Error in /api/krx proxy:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  // 2. API: KOSPI Stock Candles
  if (pathname === '/api/krx-candles' && req.method === 'GET') {
    try {
      const { symbol, range = '30' } = parsedUrl.query;
      if (!symbol) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Symbol is required' }));
        return;
      }
      
      const rangeStr = `${range}d`;
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${rangeStr}`;
      
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
      const json = await response.json();
      const result = json.chart?.result?.[0];
      if (!result) throw new Error('No data found for symbol');
      
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const open = quote.open || [];
      const high = quote.high || [];
      const low = quote.low || [];
      const close = quote.close || [];
      const volume = quote.volume || [];
      
      const candles = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (close[i] === null || close[i] === undefined || open[i] === null) continue;
        candles.push({
          t: timestamps[i] * 1000,
          o: open[i],
          h: high[i],
          l: low[i],
          c: close[i],
          v: volume[i] || 0
        });
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        symbol,
        name: 'EQUITY',
        currency: result.meta?.currency || 'KRW',
        candles
      }));
    } catch (error) {
      console.error('Error in /api/krx-candles proxy:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  // 3. API: USD/KRW Exchange Rate
  if (pathname === '/api/usd-krw' && req.method === 'GET') {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?interval=1d&range=1d`;
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
      const json = await response.json();
      const meta = json.chart?.result?.[0]?.meta;
      const rate = meta?.regularMarketPrice || 1350;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rate }));
    } catch (error) {
      console.error('Error in /api/usd-krw proxy:', error.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rate: 1350, fallback: true }));
    }
    return;
  }

  // 4. Static File Serving
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  relativePath = decodeURIComponent(relativePath);
  
  let filePath = path.join(PUBLIC_DIR, relativePath);
  
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Zero-dependency server is running on http://localhost:${PORT}`);
});
