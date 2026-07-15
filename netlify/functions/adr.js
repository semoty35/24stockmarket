process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

exports.handler = async (event, context) => {
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/SKHY?interval=1d&range=1d`;
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
    const json = await response.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No metadata for SKHY');
    
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose || price;
    const change = price - prev;
    const changePct = prev !== 0 ? (change / prev) * 100 : 0;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ ok: true, price, prev, change, changePct })
    };
  } catch (error) {
    console.error('Netlify function error (/api/adr):', error.message);
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
