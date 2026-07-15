process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.handler = async (event, context) => {
  try {
    const { symbol, range = '30' } = event.queryStringParameters || {};
    if (!symbol) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Symbol is required' })
      };
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
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ok: true,
        symbol,
        name: 'EQUITY',
        currency: result.meta?.currency || 'KRW',
        candles
      })
    };
  } catch (error) {
    console.error('Netlify function error (/api/krx-candles):', error.message);
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
