function createChartOptions(container) {
  return {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: 'solid', color: '#0e1117' },
      textColor: '#787b86',
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color: '#787b86',
        width: 1,
        style: 1,
        labelBackgroundColor: '#2a2e39',
      },
      horzLine: {
        color: '#787b86',
        width: 1,
        style: 1,
        labelBackgroundColor: '#2a2e39',
      },
    },
    rightPriceScale: {
      borderColor: '#2a2e39',
      scaleMargins: {
        top: 0.08,
        bottom: 0.08,
      },
      autoScale: true,
      entireTextOnly: true,
      ticksVisible: true,
    },
    localization: {
      priceFormatter: (price) => Math.round(price).toString(),
      timeFormatter: (timestamp) => {
        return formatFullDateTime(timestamp, selectedTimezone);
      },
    },
    timeScale: {
      borderColor: '#2a2e39',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 0,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time) => {
        return formatTimeOnly(time, selectedTimezone);
      },
    },
    handleScale: {
      axisPressedMouseMove: { time: false, price: false },
      mouseWheel: true,
      pinch: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
  };
}

// Initialize Chart
function initCharts() {
  const containerTop = document.getElementById('chart-container-top');

  chartTop = LightweightCharts.createChart(containerTop, createChartOptions(containerTop));

  // EMA Line Series (Added first so candles render on top)
  ema10Top = chartTop.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema20Top = chartTop.addLineSeries({ color: '#4caf50', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema50Top = chartTop.addLineSeries({ color: '#ff9800', lineWidth: 2.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema200Top = chartTop.addLineSeries({ color: '#e91e63', lineWidth: 3.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

  // VWAP Line Series
  vwapSeries = chartTop.addLineSeries({
    color: '#ffffff',
    lineWidth: 3,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    visible: true,
  });

  // Chart Candlestick Series (NAS100 / BTC)
  seriesTop = chartTop.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: {
      type: 'price',
      precision: 0,
      minMove: 1,
    },
  });

  canvasTop = document.getElementById('session-canvas-top');
  ctxTop = canvasTop.getContext('2d');

  // Redraw overlays on visible range change & logical zoom/pan
  const triggerOverlayRedraw = () => updateAllSessionCanvases();
  chartTop.timeScale().subscribeVisibleTimeRangeChange(triggerOverlayRedraw);
  chartTop.timeScale().subscribeVisibleLogicalRangeChange(triggerOverlayRedraw);

  // Redraw canvas continuously during active mouse drag / zoom operations
  let isInteracting = false;
  const onInteractionStart = () => {
    if (!isInteracting) {
      isInteracting = true;
      const loop = () => {
        updateAllSessionCanvases();
        if (isInteracting) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  };
  const onInteractionEnd = () => {
    isInteracting = false;
    updateAllSessionCanvases();
  };

  containerTop.addEventListener('mousedown', onInteractionStart);
  containerTop.addEventListener('wheel', triggerOverlayRedraw, { passive: true });
  containerTop.addEventListener('mouseup', onInteractionEnd);
  containerTop.addEventListener('mouseleave', onInteractionEnd);
  containerTop.addEventListener('touchstart', onInteractionStart, { passive: true });
  containerTop.addEventListener('touchend', onInteractionEnd);

  // Chart double-click handler to copy price line digit to clipboard or switch selectedDate in multi-day view
  const handleChartDoubleClick = (chartObj, seriesObj, container, e) => {
    if (!chartObj || !seriesObj || !container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) return;

    // Check if double click is near any horizontal price line
    const clickPrice = seriesObj.coordinateToPrice(mouseY);
    if (clickPrice !== null && activePriceLines && activePriceLines.length > 0) {
      // Find closest active line price
      let closestLinePrice = null;
      let minPixelDiff = Infinity;

      activePriceLines.forEach(linePrice => {
        const lineY = seriesObj.priceToCoordinate(linePrice);
        if (lineY !== null) {
          const diff = Math.abs(lineY - mouseY);
          if (diff < minPixelDiff) {
            minPixelDiff = diff;
            closestLinePrice = linePrice;
          }
        }
      });

      // Tolerance window of 10 pixels for easy double-clicking on price line
      if (minPixelDiff <= 10 && closestLinePrice !== null) {
        showCopySuccessToast(closestLinePrice);
        return;
      }
    }

    let timeSec = chartObj.timeScale().coordinateToTime(mouseX);
    if (!timeSec) return;

    const offsetHours = getTimezoneOffsetHours(selectedTimezone);
    const dateObj = new Date((timeSec + (offsetHours * 3600)) * 1000);
    
    // Ignore weekend clicks (Sunday=0, Saturday=6)
    if (dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6) return;

    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    const clickedDateStr = `${y}-${m}-${d}`;

    const minBound = '2017-08-17';
    const maxBound = getLatestPastWeekday();
    if (clickedDateStr < minBound || clickedDateStr > maxBound) return;

    if (clickedDateStr !== selectedDate) {
      changeSelectedDate(clickedDateStr);
    }
  };

  containerTop.addEventListener('dblclick', (e) => handleChartDoubleClick(chartTop, seriesTop, containerTop, e));

  // Custom right-click context menu handling
  const handleChartContextMenu = (e) => {
    e.preventDefault();
    const menu = document.getElementById('custom-context-menu');
    if (!menu) return;

    let posX = e.clientX;
    let posY = e.clientY;

    // Prevent overflow outside viewport
    const menuWidth = 190;
    const menuHeight = 50;
    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 8;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 8;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.classList.remove('hidden');
  };

  containerTop.addEventListener('contextmenu', handleChartContextMenu);

  // Auto resize handling
  window.addEventListener('resize', () => {
    resizeCharts();
  });
}

function resizeCharts() {
  const containerTop = document.getElementById('chart-container-top');
  if (chartTop && containerTop) {
    chartTop.applyOptions({ width: containerTop.clientWidth, height: containerTop.clientHeight });
  }
  updateAllSessionCanvases();
}

// Show/Hide Loading
function setLoading(loading) {
  if (loading) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

/**
 * Helper to compute the visible time range start and end timestamps (seconds)
 * based on selectedDate, daysMode ('1D', '2D', '3D', '1W'), and showSession.
 */
function calculateDisplayTimeBounds(selectedDateStr, mode, sessionOnly) {
  const [y, m, d] = selectedDateStr.split('-').map(Number);
  const selectedDateObj = new Date(Date.UTC(y, m - 1, d));
  const targetDayStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600); // 00:00 UTC+8 in Unix sec
  const targetDayEndSec = targetDayStartSec + (29 * 3600) - 1; // 04:59:59 UTC+8 next morning (05:00 AM next day)

  if (mode === '1D' || sessionOnly) {
    // 05:00 UTC+8 today to 05:00 UTC+8 next morning (e.g. Fri 05:00 AM to Sat 05:00 AM)
    const startSec = targetDayStartSec + (5 * 3600);
    const endSec = targetDayStartSec + (29 * 3600) - 1;
    return { startSec, endSec };
  }

  if (mode === '2D') {
    // Current day + 1 previous calendar day starting 05:00
    const startSec = targetDayStartSec - (24 * 3600) + (5 * 3600);
    return { startSec, endSec: targetDayEndSec };
  }

  if (mode === '3D') {
    // Current day + 2 previous calendar days starting 05:00
    const startSec = targetDayStartSec - (2 * 24 * 3600) + (5 * 3600);
    return { startSec, endSec: targetDayEndSec };
  }

  if (mode === '1W') {
    // Current week: previous Saturday 05:00 to current week's Friday 05:00 next morning
    const dayOfWeek = selectedDateObj.getUTCDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const weekFridayStartSec = targetDayStartSec + (daysUntilFriday * 24 * 3600);
    const weekFridayEndSec = weekFridayStartSec + (29 * 3600) - 1;

    const prevSatStartSec = weekFridayStartSec - (6 * 24 * 3600) + (5 * 3600);

    return { startSec: prevSatStartSec, endSec: weekFridayEndSec };
  }

  return { startSec: targetDayStartSec + (5 * 3600), endSec: targetDayEndSec };
}

/**
 * Calculate VWAP for the given candle data.
 * Returns an array of { time, value } points.
 */
function calculateVWAP(candles) {
  if (!candles || candles.length === 0) return [];

  let cumulativeTPV = 0; // cumulative (typical price * volume)
  let cumulativeVol = 0;
  let currentDay = null;
  const result = [];

  // Session boundary: 05:00 UTC+8 = 21:00 UTC (previous calendar day)
  // Shift candle time back by 21h so that floor-dividing by 86400 aligns
  // the day boundary to 21:00 UTC (= 05:00 UTC+8) instead of 00:00 UTC.
  const SESSION_OFFSET_SEC = 21 * 3600; // 21 hours

  candles.forEach(c => {
    // Compute which "session day" this candle belongs to (resets at 05:00 UTC+8)
    const candleDay = Math.floor((c.time - SESSION_OFFSET_SEC) / 86400);

    if (currentDay !== candleDay) {
      // Insert a gap point 1 second before the new session's first candle
      // to break the connecting line from the previous session.
      if (currentDay !== null) {
        result.push({ time: c.time - 1 });
      }

      cumulativeTPV = 0;
      cumulativeVol = 0;
      currentDay = candleDay;
    }

    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 0;

    cumulativeTPV += typicalPrice * vol;
    cumulativeVol += vol;

    result.push({
      time: c.time,
      value: cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : typicalPrice,
    });
  });

  return result;
}

// Render Chart Data
async function renderChartData(skipFitContent = false) {
  if (!rawKlineData || rawKlineData.length === 0) return;

  const { startSec, endSec } = calculateDisplayTimeBounds(selectedDate, daysMode, showSession);

  const badgeTop = document.getElementById('badge-top');
  if (badgeTop) badgeTop.textContent = 'BTCUSDT (Binance)';

  // Visible candle subset
  const activeData = rawKlineData.filter(item => item.time >= startSec && item.time <= endSec);
  const haCandles = convertToHeikinAshi(activeData);

  // Single chart: Dynamic based on isHeikinAshi toggle
  seriesTop.setData(isHeikinAshi ? haCandles : activeData);

  // Fast lookup sets for valid timestamps
  const validTimes = new Set(activeData.map(d => d.time));

  // Calculate EMAs across full historical dataset
  const ema10 = calculateEMA(rawKlineData, 10).filter(item => validTimes.has(item.time));
  const ema20 = calculateEMA(rawKlineData, 20).filter(item => validTimes.has(item.time));
  const ema50 = calculateEMA(rawKlineData, 50).filter(item => validTimes.has(item.time));
  const ema200 = calculateEMA(rawKlineData, 200).filter(item => validTimes.has(item.time));

  ema10Top.setData(ema10);
  ema20Top.setData(ema20);
  ema50Top.setData(ema50);
  ema200Top.setData(ema200);

  // VWAP: compute and render
  if (activeData.length > 0) {
    const vwapData = calculateVWAP(activeData);
    vwapSeries.setData(vwapData);
  } else {
    vwapSeries.setData([]);
  }

  await updateAllPriceLines();

  // Fit scale edge-to-edge without extra blank space (unless skipFitContent is true)
  if (!skipFitContent) {
    if (chartTop) chartTop.timeScale().fitContent();
  }

  // Update Stepper Button Disabled States
  datePrevBtn.disabled = !getAdjacentWeekday(selectedDate, -1);
  dateNextBtn.disabled = !getAdjacentWeekday(selectedDate, 1);
}
