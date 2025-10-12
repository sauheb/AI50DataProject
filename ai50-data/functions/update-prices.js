const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
  
  // Fetch static data from GitHub
  const staticDataUrl = 'https://raw.githubusercontent.com/sauheb/ai50-data/main/ai50-static.json';
  const staticResponse = await fetch(staticDataUrl);
  const staticData = await staticResponse.json();
  
  // Get all tickers from static data
  const tickers = staticData.map(stock => stock.ticker);
  
  // Add comparison tickers
  const allTickers = [...tickers, 'SPY', 'QQQ'];
  
  // Fetch prices for all stocks (limit to 5 for testing)
  const pricePromises = allTickers.slice(0, 5).map(async ticker => {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data['Global Quote']) {
      return {
        ticker: ticker,
        price: parseFloat(data['Global Quote']['05. price']).toFixed(2),
        change: data['Global Quote']['10. change percent']
      };
    }
    return null;
  });
  
  const prices = await Promise.all(pricePromises);
  const validPrices = prices.filter(p => p !== null);
  
  // Merge static data with live prices
  const liveData = staticData.map(stock => {
    const priceData = validPrices.find(p => p.ticker === stock.ticker);
    if (priceData) {
      return {
        ...stock,
        price: priceData.price,
        change: priceData.change
      };
    }
    return stock;
  });
  
  // Calculate AI50 index (simplified - just average of changes)
  const stockChanges = validPrices
    .filter(p => p.ticker !== 'SPY' && p.ticker !== 'QQQ')
    .map(p => parseFloat(p.change.replace('%', '')));
  
  const ai50Change = (stockChanges.reduce((a, b) => a + b, 0) / stockChanges.length).toFixed(2);
  
  // Get SPY and QQQ data
  const spyData = validPrices.find(p => p.ticker === 'SPY');
  const qqqData = validPrices.find(p => p.ticker === 'QQQ');
  
  const result = {
    lastUpdated: new Date().toISOString(),
    ai50Index: {
      today: ai50Change + '%'
    },
    comparisons: {
      sp500_today: spyData ? spyData.change : 'N/A',
      nasdaq_today: qqqData ? qqqData.change : 'N/A'
    },
    stocks: liveData
  };
  
  return {
    statusCode: 200,
    body: JSON.stringify(result, null, 2)
  };
};
