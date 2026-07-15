process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const STOCK_NAMES = {
  '005930.KS': { name: '삼성전자', nameEn: 'Samsung Electronics' },
  '000660.KS': { name: 'SK하이닉스', nameEn: 'SK Hynix' }
};

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

exports.handler = async (event, context) => {
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
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ ok: true, data, ts: Date.now() })
    };
  } catch (error) {
    console.error('Netlify function error (/api/krx):', error.message);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
