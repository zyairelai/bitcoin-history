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

// Initialize Both Top and Bottom Charts
function initCharts() {
  const containerTop = document.getElementById('chart-container-top');
  const containerBottom = document.getElementById('chart-container-bottom');

  chartTop = LightweightCharts.createChart(containerTop, createChartOptions(containerTop));
  chartBottom = LightweightCharts.createChart(containerBottom, createChartOptions(containerBottom));

  // EMA Line Series (Added first so candles render on top)
  ema10Top = chartTop.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema20Top = chartTop.addLineSeries({ color: '#4caf50', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema50Top = chartTop.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema200Top = chartTop.addLineSeries({ color: '#e91e63', lineWidth: 3.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

  // Top Chart Candlestick Series (NAS100 / BTC)
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
      precision: 2,
      minMove: 0.01,
    },
  });

  // Bottom Chart Series
  ema10Bottom = chartBottom.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema20Bottom = chartBottom.addLineSeries({ color: '#4caf50', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema50Bottom = chartBottom.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema200Bottom = chartBottom.addLineSeries({ color: '#e91e63', lineWidth: 3.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

  seriesBottom = chartBottom.addCandlestickSeries({
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

  canvasBottom = document.getElementById('session-canvas-bottom');
  ctxBottom = canvasBottom.getContext('2d');

  // Synchronize Time Scales (Panning & Zooming) Bidirectionally
  chartTop.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (isSyncingRange || !range || !isDualLayout) return;
    isSyncingRange = true;
    chartBottom.timeScale().setVisibleLogicalRange(range);
    updateAllSessionCanvases();
    isSyncingRange = false;
  });

  chartBottom.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (isSyncingRange || !range || !isDualLayout) return;
    isSyncingRange = true;
    chartTop.timeScale().setVisibleLogicalRange(range);
    updateAllSessionCanvases();
    isSyncingRange = false;
  });

  // Synchronize Crosshair vertical movement across both charts
  let isSyncingCrosshair = false;

  chartTop.subscribeCrosshairMove(param => {
    if (isSyncingCrosshair || !isDualLayout) return;
    isSyncingCrosshair = true;
    if (param && param.time) {
      chartBottom.setCrosshairPosition(NaN, param.time, seriesBottom);
    } else {
      chartBottom.clearCrosshairPosition();
    }
    isSyncingCrosshair = false;
  });

  chartBottom.subscribeCrosshairMove(param => {
    if (isSyncingCrosshair || !isDualLayout) return;
    isSyncingCrosshair = true;
    if (param && param.time) {
      chartTop.setCrosshairPosition(NaN, param.time, seriesTop);
    } else {
      chartTop.clearCrosshairPosition();
    }
    isSyncingCrosshair = false;
  });

  // Redraw overlays on visible range change & logical zoom/pan
  const triggerOverlayRedraw = () => updateAllSessionCanvases();
  chartTop.timeScale().subscribeVisibleTimeRangeChange(triggerOverlayRedraw);
  chartTop.timeScale().subscribeVisibleLogicalRangeChange(triggerOverlayRedraw);
  chartBottom.timeScale().subscribeVisibleTimeRangeChange(triggerOverlayRedraw);
  chartBottom.timeScale().subscribeVisibleLogicalRangeChange(triggerOverlayRedraw);

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

  [containerTop, containerBottom].forEach(cnt => {
    if (!cnt) return;
    cnt.addEventListener('mousedown', onInteractionStart);
    cnt.addEventListener('wheel', triggerOverlayRedraw, { passive: true });
    cnt.addEventListener('mouseup', onInteractionEnd);
    cnt.addEventListener('mouseleave', onInteractionEnd);
    cnt.addEventListener('touchstart', onInteractionStart, { passive: true });
    cnt.addEventListener('touchend', onInteractionEnd);
  });

  // Chart double-click handler to switch selectedDate to clicked day in multi-day (1W/3D/2D) views
  const handleChartDoubleClick = (chartObj, container, e) => {
    if (!chartObj || !container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX < 0 || mouseX > rect.width) return;

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

  containerTop.addEventListener('dblclick', (e) => handleChartDoubleClick(chartTop, containerTop, e));
  containerBottom.addEventListener('dblclick', (e) => handleChartDoubleClick(chartBottom, containerBottom, e));

  // Auto resize handling
  window.addEventListener('resize', () => {
    resizeCharts();
  });
}

function resizeCharts() {
  const containerTop = document.getElementById('chart-container-top');
  const containerBottom = document.getElementById('chart-container-bottom');

  if (chartTop && containerTop) {
    chartTop.applyOptions({ width: containerTop.clientWidth, height: containerTop.clientHeight });
  }
  if (chartBottom && containerBottom) {
    chartBottom.applyOptions({ width: containerBottom.clientWidth, height: containerBottom.clientHeight });
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

// Render Chart Data on Both Top and Bottom Charts
function renderChartData() {
  if (!rawKlineData || rawKlineData.length === 0) return;

  const { startSec, endSec } = calculateDisplayTimeBounds(selectedDate, daysMode, showSession);

  const badgeTop = document.getElementById('badge-top');
  const badgeBottom = document.getElementById('badge-bottom');

  if (badgeTop) badgeTop.textContent = 'BTCUSDT (Binance)';
  if (badgeBottom) badgeBottom.textContent = 'BTCUSDT (Binance)';

  // Visible candle subset
  const activeData = rawKlineData.filter(item => item.time >= startSec && item.time <= endSec);
  const haCandles = convertToHeikinAshi(activeData);

  if (isDualLayout) {
    // Top chart: Raw Candlesticks, Bottom chart: Heikin-Ashi
    seriesTop.setData(activeData);
    seriesBottom.setData(haCandles);
  } else {
    // Single chart: Dynamic based on isHeikinAshi toggle
    seriesTop.setData(isHeikinAshi ? haCandles : activeData);
  }

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

  if (isDualLayout) {
    ema10Bottom.setData(ema10);
    ema20Bottom.setData(ema20);
    ema50Bottom.setData(ema50);
    ema200Bottom.setData(ema200);
  }

  updateAllPriceLines();

  // Fit scale edge-to-edge without extra blank space
  if (chartTop) chartTop.timeScale().fitContent();
  if (chartBottom && isDualLayout) chartBottom.timeScale().fitContent();

  // Update Stepper Button Disabled States
  datePrevBtn.disabled = !getAdjacentWeekday(selectedDate, -1);
  dateNextBtn.disabled = !getAdjacentWeekday(selectedDate, 1);
}
