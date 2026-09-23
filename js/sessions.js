// Draw ultra-thin crisp 1px vertical session lines AND session color boxes on a specific overlay canvas
function drawOverlayCanvas(targetCanvas, targetCtx, targetChart, targetSeries, dataSource = rawKlineData) {
  if (!targetCanvas || !targetCtx || !targetChart || !targetSeries) return;

  const container = targetCanvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  targetCanvas.width = container.clientWidth * dpr;
  targetCanvas.height = container.clientHeight * dpr;

  targetCtx.scale(dpr, dpr);
  targetCtx.clearRect(0, 0, container.clientWidth, container.clientHeight);

  if (!dataSource || dataSource.length === 0) return;

  const { startSec, endSec } = calculateDisplayTimeBounds(selectedDate, daysMode, showSession);
  const candlesInRange = dataSource.filter(item => item.time >= startSec && item.time <= endSec);
  if (candlesInRange.length === 0) return;

  // Determine all 00:00 UTC+8 day start seconds within [startSec, endSec]
  const dayStartSecs = [];
  let currDayStart = startSec;
  // Align currDayStart to 00:00 UTC+8 of its day
  const [y, m, d] = selectedDate.split('-').map(Number);
  const selDayStart = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);
  
  // Calculate day offset steps relative to selected date
  const minDayStart = selDayStart - (30 * 24 * 3600);
  for (let s = minDayStart; s <= endSec + 24 * 3600; s += 24 * 3600) {
    if (s + 24 * 3600 - 1 >= startSec && s <= endSec) {
      dayStartSecs.push(s);
    }
  }

  dayStartSecs.forEach(dayStartSec => {
    // Determine date string for DST checks
    const dateObj = new Date((dayStartSec + (8 * 3600)) * 1000);
    const dateY = dateObj.getUTCFullYear();
    const dateM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dateD = String(dateObj.getUTCDate()).padStart(2, '0');
    const dateStr = `${dateY}-${dateM}-${dateD}`;

    // Draw 00:00 midnight vertical separator line across full chart height for multi-day views
    const offsetHours = getTimezoneOffsetHours(selectedTimezone);
    const midnightTime = dayStartSec + (8 * 3600) - (offsetHours * 3600);
    const midX = targetChart.timeScale().timeToCoordinate(midnightTime);
    if (midX !== null) {
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.setLineDash([4, 4]);
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      targetCtx.lineWidth = 1;
      targetCtx.moveTo(midX, 0);
      targetCtx.lineTo(midX, container.clientHeight);
      targetCtx.stroke();
      targetCtx.restore();
    }

    const dayCandles = dataSource.filter(item => item.time >= dayStartSec && item.time <= dayStartSec + 24 * 3600 - 1);
    if (dayCandles.length === 0) return;

    // Skip highlighting session boxes for weekends (Saturday=6, Sunday=0)
    const dayOfWeek = dateObj.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    // Dynamic DST Shifts
    const ukShift = isUKSummerTime(dateStr) ? 0 : 1; // London shift
    const usShift = isUSSummerTime(dateStr) ? 0 : 1; // US/NQ shift

    // Draw Colored Session Shading Boxes with High/Low Bounds & Label
    const sessionBoxConfigs = [
      {
        title: 'Asia',
        startOffsetSec: 8 * 3600,                        // 08:00 UTC+8
        endOffsetSec: 12 * 3600,                         // 12:00 UTC+8
        fillColor: 'rgba(239, 83, 80, 0.15)',             // Red Shading
        borderColor: 'rgba(239, 83, 80, 0.4)',
        textColor: '#ef5350',
      },
      {
        title: 'London',
        startOffsetSec: 15 * 3600,                        // 15:00 UTC+8 (zones.py: get_session_levels 15-20, no shift)
        endOffsetSec: 20 * 3600,                          // 20:00 UTC+8
        fillColor: 'rgba(76, 175, 80, 0.15)',             // Green Shading
        borderColor: 'rgba(76, 175, 80, 0.4)',
        textColor: '#4caf50',
      },
      /*
      {
        title: 'Pre-Market',
        startOffsetSec: (20 + usShift) * 3600 + 1800,     // 20:30 UTC+8
        endOffsetSec: (21 + usShift) * 3600,              // 21:00 UTC+8
        fillColor: 'rgba(156, 39, 176, 0.15)',           // Purple Shading
        borderColor: 'rgba(156, 39, 176, 0.4)',
        textColor: '#ab47bc',
      },
      */
      {
        title: 'New York',
        startOffsetSec: (21 + usShift) * 3600 + 1800,     // 21:30 UTC+8
        endOffsetSec: (23 + usShift) * 3600 + 1800,       // 23:30 UTC+8
        fillColor: 'rgba(255, 235, 59, 0.15)',            // Yellow Shading
        borderColor: 'rgba(255, 235, 59, 0.4)',
        textColor: '#ffeb3b',
      }
    ];

    sessionBoxConfigs.forEach(config => {
      const sessionStartSec = dayStartSec + config.startOffsetSec;
      const sessionEndSec = dayStartSec + config.endOffsetSec;

      const sessionCandles = filterSessionCandles(dataSource, sessionStartSec, sessionEndSec, currentInterval);
      if (sessionCandles.length === 0) return;

      let sHigh = -Infinity;
      let sLow = Infinity;
      let sQuoteVolume = 0;

      sessionCandles.forEach(c => {
        if (c.high > sHigh) sHigh = c.high;
        if (c.low < sLow) sLow = c.low;
        sQuoteVolume += (c.quoteVolume || 0);
      });

      // Horizontal X bounds calculation using exact session candle timestamps
      const firstCandle = sessionCandles[0];
      const lastCandle = sessionCandles[sessionCandles.length - 1];

      let x1 = targetChart.timeScale().timeToCoordinate(firstCandle.time);
      let x2 = targetChart.timeScale().timeToCoordinate(lastCandle.time);

      const y1 = targetSeries.priceToCoordinate(sHigh);
      const y2 = targetSeries.priceToCoordinate(sLow);

      if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
        // Compute precise width per bar to align box flush with bar wicks
        let barSpacing = 4;
        if (sessionCandles.length > 1) {
          barSpacing = Math.abs(x2 - x1) / (sessionCandles.length - 1);
        }

        const leftRaw = Math.min(x1, x2) - (barSpacing / 2);
        const rightRaw = Math.max(x1, x2) + (barSpacing / 2);
        const topRaw = Math.min(y1, y2);
        const bottomRaw = Math.max(y1, y2);

        // Clamp coordinates within visible canvas viewport bounds
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        const left = Math.max(-1000, Math.min(containerW + 1000, leftRaw));
        const right = Math.max(-1000, Math.min(containerW + 1000, rightRaw));
        const top = Math.max(-1000, Math.min(containerH + 1000, topRaw));
        const bottom = Math.max(-1000, Math.min(containerH + 1000, bottomRaw));

        const width = right - left;
        const height = bottom - top;

        if (width > 0 && height > 0) {
          // Filled session box background
          targetCtx.fillStyle = config.fillColor;
          targetCtx.fillRect(left, top, width, height);

          // Subtle border frame
          targetCtx.strokeStyle = config.borderColor;
          targetCtx.lineWidth = 1;
          targetCtx.strokeRect(left, top, width, height);

          // Calculate price range (High - Low) rounded to integer (no decimal) with 'u' suffix
          const rangeDiff = Math.round(sHigh - sLow);
          const rangeLabel = `${config.title} · ${rangeDiff}u`;

          // Format volume in USD as human-readable shorthand (e.g. 123 Million, 1.3 Billion)
          let volLabel;
          if (sQuoteVolume >= 1e9) {
            volLabel = `${parseFloat((sQuoteVolume / 1e9).toFixed(1))} Billion`;
          } else if (sQuoteVolume >= 1e6) {
            volLabel = `${Math.round(sQuoteVolume / 1e6)} Million`;
          } else {
            volLabel = `${Math.round(sQuoteVolume / 1e3)}K`;
          }

          // Set font for labels
          targetCtx.font = '600 12px Inter, sans-serif';
          targetCtx.textAlign = 'center';

          const centerX = left + (width / 2);
          const labelBaseY = bottom + 6;

          // Range label (line 1)
          targetCtx.fillStyle = config.textColor;
          targetCtx.textBaseline = 'top';
          targetCtx.fillText(rangeLabel, centerX, labelBaseY);

          // Volume label (line 2) — same size, not bold, slightly dimmer
          targetCtx.font = '500 12px Inter, sans-serif';
          targetCtx.fillStyle = config.textColor + 'bb'; // 73% opacity
          targetCtx.fillText(volLabel, centerX, labelBaseY + 17);
        }
      }
    });
  });
}

function updateAllSessionCanvases() {
  drawOverlayCanvas(canvasTop, ctxTop, chartTop, seriesTop, rawKlineData);
}
