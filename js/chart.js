// Chart Options Builder
function createChartOptions(container) {
  return {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: 'solid', color: '#0e1117' },
      textColor: '#787b86',
      fontSize: 12,
      fontFamily: "'Inter', sans-serif",
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
        const date = new Date((timestamp + (8 * 3600)) * 1000);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
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
        const date = new Date((time + (8 * 3600)) * 1000);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      },
    },
    localization: {
      timeFormatter: (timestamp) => {
        const date = new Date((timestamp + (8 * 3600)) * 1000);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
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

// Render Chart Data on Both Top and Bottom Charts
function renderChartData() {
  if (!rawKlineData || rawKlineData.length === 0) return;

  const [y, m, d] = selectedDate.split('-').map(Number);
  const targetDayStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);
  const targetDayEndSec = targetDayStartSec + (24 * 3600) - 1;

  let dayRawCandles = rawKlineData.filter(item => item.time >= targetDayStartSec && item.time <= targetDayEndSec);

  // If SESSION toggle is enabled, hide candles before 05:00 (one candle before 05:00) and after 20:00 UTC+8
  if (showSession && dayRawCandles.length > 0) {
    const start0500Sec = targetDayStartSec + (5 * 3600);
    const end2000Sec = targetDayStartSec + (20 * 3600);

    const idx0500 = dayRawCandles.findIndex(c => c.time >= start0500Sec);
    const minTime = (idx0500 > 0) ? dayRawCandles[idx0500 - 1].time : start0500Sec;

    dayRawCandles = dayRawCandles.filter(c => c.time >= minTime && c.time <= end2000Sec);
  }

  // Preserve full day subset before slicing for playback
  const fullSessionCandles = dayRawCandles;

  // If in Playback Mode, cut off day candles at playbackIndex
  if (isPlaybackMode && fullSessionCandles.length > 0) {
    if (playbackIndex === -1) {
      // Find 12:00 UTC+8 candle index within fullSessionCandles
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
    // When isHeikinAshi is FALSE: Top is Raw Candlesticks, Bottom is Heikin-Ashi
    // When isHeikinAshi is TRUE: Top is Heikin-Ashi, Bottom is Raw Candlesticks
    seriesTop.setData(isHeikinAshi ? dayHACandles : dayRawCandles);
    seriesBottom.setData(isHeikinAshi ? dayRawCandles : dayHACandles);
  } else {
    // In Single layout mode: Top chart toggles between Raw and Heikin-Ashi based on isHeikinAshi flag
    seriesTop.setData(isHeikinAshi ? dayHACandles : dayRawCandles);
  }

  // Calculate EMAs across raw data for both charts
  const minTime = (showSession && dayRawCandles.length > 0) ? dayRawCandles[0].time : targetDayStartSec;
  const maxTime = dayRawCandles.length > 0 ? dayRawCandles[dayRawCandles.length - 1].time : targetDayEndSec;

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
