// Fetch Binance BTC Kline REST Data
async function fetchKlines() {
  setLoading(true);
  if (ws) {
    ws.close();
    ws = null;
  }

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
      const url = `https://api.binance.com/api/v3/klines?symbol=${currentSymbol}&interval=${currentInterval}&startTime=${currentFetchStart}&endTime=${targetEndTime}&limit=1000`;
      
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

        if (rawKlineData.length === 0 || rawKlineData[rawKlineData.length - 1].time < time) {
          rawKlineData.push({ time, open, high, low, close });
        }
      });

      const lastCloseTime = rawData[rawData.length - 1][6];
      if (lastCloseTime >= targetEndTime || rawData.length < 1000) {
        break;
      }
      currentFetchStart = lastCloseTime + 1;
    }

    renderChartData();

    if (chartTop) chartTop.timeScale().fitContent();
    if (chartBottom && isDualLayout) chartBottom.timeScale().fitContent();

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
