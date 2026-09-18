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

  // Top Chart Series (Raw Candlesticks)
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

  ema10Top = chartTop.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema20Top = chartTop.addLineSeries({ color: '#4caf50', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema50Top = chartTop.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema200Top = chartTop.addLineSeries({ color: '#e91e63', lineWidth: 3.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

  // Bottom Chart Series (Heikin-Ashi)
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

  ema10Bottom = chartBottom.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema20Bottom = chartBottom.addLineSeries({ color: '#4caf50', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema50Bottom = chartBottom.addLineSeries({ color: '#ff9800', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  ema200Bottom = chartBottom.addLineSeries({ color: '#e91e63', lineWidth: 3.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

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

  // Redraw overlays on visible range change
  chartTop.timeScale().subscribeVisibleTimeRangeChange(() => updateAllSessionCanvases());
  chartBottom.timeScale().subscribeVisibleTimeRangeChange(() => updateAllSessionCanvases());

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

    const minBound = '2024-01-01';
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
  const targetDayEndSec = targetDayStartSec + (24 * 3600) - 1; // 23:59:59 UTC+8

  if (sessionOnly) {
    // If Session checkbox is checked, focus on selected date 05:00 to 23:59:59 UTC+8
    const startSec = targetDayStartSec + (5 * 3600);
    const endSec = targetDayStartSec + (24 * 3600) - 1;
    return { startSec, endSec };
  }

  if (mode === '1D') {
    return { startSec: targetDayStartSec, endSec: targetDayEndSec };
  }

  if (mode === '2D') {
    // Current day + 1 previous calendar day
    const startSec = targetDayStartSec - (24 * 3600);
    return { startSec, endSec: targetDayEndSec };
  }

  if (mode === '3D') {
    // Current day + 2 previous calendar days
    // If Monday selected, 3D includes Sun (1 day back) and Sat (2 days back)
    const startSec = targetDayStartSec - (2 * 24 * 3600);
    return { startSec, endSec: targetDayEndSec };
  }

  if (mode === '1W') {
    // Current week: previous Saturday all the way to current week's Friday 23:59:59
    const dayOfWeek = selectedDateObj.getUTCDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
    // Find Friday of current selected date's week
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const weekFridayStartSec = targetDayStartSec + (daysUntilFriday * 24 * 3600);
    const weekFridayEndSec = weekFridayStartSec + (24 * 3600) - 1;

    // Previous Saturday is 6 days prior to Friday (Friday - 6 days)
    const prevSatStartSec = weekFridayStartSec - (6 * 24 * 3600);

    return { startSec: prevSatStartSec, endSec: weekFridayEndSec };
  }

  return { startSec: targetDayStartSec, endSec: targetDayEndSec };
}

// Render Chart Data on Both Top and Bottom Charts
function renderChartData() {
  if (!rawKlineData || rawKlineData.length === 0) return;

  const { startSec, endSec } = calculateDisplayTimeBounds(selectedDate, daysMode, showSession);

  let dayRawCandles = rawKlineData.filter(item => item.time >= startSec && item.time <= endSec);

  // Preserve full day subset before slicing for playback
  const fullSessionCandles = dayRawCandles;

  // If in Playback Mode, cut off day candles at playbackIndex
  if (isPlaybackMode && fullSessionCandles.length > 0) {
    if (playbackIndex === -1) {
      // Find 12:00 UTC+8 candle index within fullSessionCandles for the selected date
      const [y, m, d] = selectedDate.split('-').map(Number);
      const targetDayStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);
      const sec1200 = targetDayStartSec + (12 * 3600);
      const idx1200 = fullSessionCandles.findIndex(c => c.time >= sec1200);
      playbackIndex = idx1200 !== -1 ? idx1200 : Math.floor(fullSessionCandles.length / 2);
    }
    // Clamp playbackIndex within bounds
    playbackIndex = Math.max(0, Math.min(fullSessionCandles.length - 1, playbackIndex));
    dayRawCandles = fullSessionCandles.slice(0, playbackIndex + 1);
  }

  const dayHACandles = convertToHeikinAshi(dayRawCandles);

  if (isDualLayout) {
    // In Dual layout mode:
    // Default (isHeikinAshi is TRUE): Top is Raw Candlesticks, Bottom is Heikin-Ashi
    // Switched (isHeikinAshi is FALSE): Top is Heikin-Ashi, Bottom is Raw Candlesticks
    seriesTop.setData(isHeikinAshi ? dayRawCandles : dayHACandles);
    seriesBottom.setData(isHeikinAshi ? dayHACandles : dayRawCandles);
  } else {
    // In Single layout mode: Top chart toggles between Heikin-Ashi (default true) and Raw Candlesticks (false)
    seriesTop.setData(isHeikinAshi ? dayHACandles : dayRawCandles);
  }

  // Calculate EMAs across raw data for both charts
  const minTime = dayRawCandles.length > 0 ? dayRawCandles[0].time : startSec;
  const maxTime = dayRawCandles.length > 0 ? dayRawCandles[dayRawCandles.length - 1].time : endSec;

  const fullEma10 = calculateEMA(rawKlineData, 10).filter(item => item.time >= minTime && item.time <= maxTime);
  const fullEma20 = calculateEMA(rawKlineData, 20).filter(item => item.time >= minTime && item.time <= maxTime);
  const fullEma50 = calculateEMA(rawKlineData, 50).filter(item => item.time >= minTime && item.time <= maxTime);
  const fullEma200 = calculateEMA(rawKlineData, 200).filter(item => item.time >= minTime && item.time <= maxTime);

  ema10Top.setData(fullEma10);
  ema20Top.setData(fullEma20);
  ema50Top.setData(fullEma50);
  ema200Top.setData(fullEma200);

  ema10Bottom.setData(fullEma10);
  ema20Bottom.setData(fullEma20);
  ema50Bottom.setData(fullEma50);
  ema200Bottom.setData(fullEma200);

  updateAllPriceLines();

  // Update Stepper Button Disabled States
  datePrevBtn.disabled = !getAdjacentWeekday(selectedDate, -1);
  dateNextBtn.disabled = !getAdjacentWeekday(selectedDate, 1);
}
