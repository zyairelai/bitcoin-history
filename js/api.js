// Fetch Binance Kline REST Data (UTC+8 timezone bounds)
async function fetchKlines() {
  setLoading(true);
  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const selectedDateObj = new Date(Date.UTC(y, m - 1, d));
    const targetStartTime = Date.UTC(y, m - 1, d, 0, 0, 0) - (8 * 3600 * 1000);
    
    // Determine end time depending on daysMode
    let rangeEndTimeMs = targetStartTime + (24 * 60 * 60 * 1000) - 1;
    if (daysMode === '2D') {
      // Start 1 day prior
    } else if (daysMode === '3D') {
      // Start 2 days prior
    } else if (daysMode === '1W') {
      // End on Friday of the week
      const dayOfWeek = selectedDateObj.getUTCDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      rangeEndTimeMs = targetStartTime + (daysUntilFriday * 24 * 3600 * 1000) + (24 * 3600 * 1000) - 1;
    }

    const targetEndTime = rangeEndTimeMs;

    let intervalMinutes = 5;
    if (currentInterval === '1m') intervalMinutes = 1;
    else if (currentInterval === '3m') intervalMinutes = 3;
    else if (currentInterval === '5m') intervalMinutes = 5;
    else if (currentInterval === '15m') intervalMinutes = 15;
    else if (currentInterval === '1h') intervalMinutes = 60;

    // Fetch lookback: include extra 10 days for week view & EMA calculation buffer
    const fetchLookbackMs = (10 * 24 * 60 * 60 * 1000) + (250 * intervalMinutes * 60 * 1000);
    const fullFetchStart = targetStartTime - fetchLookbackMs;

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

        rawKlineData.push({ time, open, high, low, close });
      });

      const lastCloseTime = rawData[rawData.length - 1][6];
      if (lastCloseTime >= targetEndTime || rawData.length < 1000) {
        break;
      }
      currentFetchStart = lastCloseTime + 1;
    }

    // Preserve visible range across timeframe change
    const visibleRangeTop = chartTop ? chartTop.timeScale().getVisibleLogicalRange() : null;

    renderChartData();

    if (chartTop) chartTop.timeScale().fitContent();
    if (chartBottom && isDualLayout) chartBottom.timeScale().fitContent();

    if (statusDot) statusDot.className = 'status-dot online';
    if (statusText) statusText.textContent = `Historical Data Loaded (${selectedDate} ${currentInterval} UTC+8)`;

  } catch (err) {
    console.error(err);
    if (statusDot) statusDot.className = 'status-dot offline';
    if (statusText) statusText.textContent = 'Fetch Error';
  } finally {
    setLoading(false);
  }
}
