// Fetch Binance BTC Kline REST Data
async function fetchKlines(preserveView = false) {
  setLoading(true);
  if (ws) {
    ws.close();
    ws = null;
  }

  // Save current logical range if preserveView is enabled
  const currentRangeTop = (preserveView && chartTop) ? chartTop.timeScale().getVisibleLogicalRange() : null;

  try {
    const { startSec: displayStartSec, endSec: displayEndSec } = calculateDisplayTimeBounds(selectedDate, daysMode, false);
    const targetEndTime = displayEndSec * 1000;

    let intervalMinutes = 5;
    if (currentInterval === '1m') intervalMinutes = 1;
    else if (currentInterval === '3m') intervalMinutes = 3;
    else if (currentInterval === '5m') intervalMinutes = 5;
    else if (currentInterval === '15m') intervalMinutes = 15;
    else if (currentInterval === '1h') intervalMinutes = 60;
    else if (currentInterval === '4h') intervalMinutes = 240;

    // Fetch lookback: 350 candles or 14 days before display start to ensure 200 EMA & Previous Week (PW) are fully available
    const pwLookbackSec = 14 * 86400;
    const lookbackSec = Math.max(350 * intervalMinutes * 60, pwLookbackSec);
    const fullFetchStart = (displayStartSec - lookbackSec) * 1000;

    rawKlineData = [];
    let currentFetchStart = fullFetchStart;

    while (currentFetchStart < targetEndTime) {
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${currentSymbol}&interval=${currentInterval}&startTime=${currentFetchStart}&endTime=${targetEndTime}&limit=1000`; // Futures, matching zones.py
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Binance API error: ${res.statusText}`);
      }
      const rawData = await res.json();

      if (!rawData || rawData.length === 0) break;

      rawData.forEach(item => {
        const time = Math.floor(item[0] / 1000);
        const open = parseFloat(item[1]);
        const high = parseFloat(item[2]);
        const low = parseFloat(item[3]);
        const close = parseFloat(item[4]);
        const volume = parseFloat(item[5]);         // base asset volume (BTC)
        const quoteVolume = parseFloat(item[7]);    // quote asset volume (USDT)

        if (rawKlineData.length === 0 || rawKlineData[rawKlineData.length - 1].time < time) {
          rawKlineData.push({ time, open, high, low, close, volume, quoteVolume });
        }
      });

      const lastCloseTime = rawData[rawData.length - 1][6];
      if (lastCloseTime >= targetEndTime || rawData.length < 1000) {
        break;
      }
      currentFetchStart = lastCloseTime + 1;
    }

    renderChartData(preserveView);

    if (preserveView) {
      if (chartTop && currentRangeTop) {
        chartTop.timeScale().setVisibleLogicalRange(currentRangeTop);
      }
    } else {
      if (chartTop) chartTop.timeScale().fitContent();
    }

    if (statusDot) statusDot.className = 'status-dot online';
    if (statusText) statusText.textContent = `Data Loaded (${selectedDate} ${currentInterval} UTC+8)`;

  } catch (err) {
    console.error(err);
    if (statusDot) statusDot.className = 'status-dot offline';
    if (statusText) statusText.textContent = 'Fetch Error';
  } finally {
    setLoading(false);
  }
}

// Fetch a single target Kline candle directly from Binance API for exact timeframe matching
async function fetchDirectKline(symbol, interval, startTimeMs, endTimeMs) {
  try {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=5`; // Futures, matching zones.py
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;

    // Pick candle that overlaps with target start time or falls within range
    const item = data.find(c => c[0] <= startTimeMs + 1000 && c[6] >= startTimeMs - 1000) || data[0];
    return {
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4])
    };
  } catch (e) {
    console.error('fetchDirectKline error:', e);
    return null;
  }
}

