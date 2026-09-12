// Draw ultra-thin crisp 1px vertical session lines AND session color boxes on a specific overlay canvas
function drawOverlayCanvas(targetCanvas, targetCtx, targetChart, targetSeries) {
  if (!targetCanvas || !targetCtx || !targetChart || !targetSeries) return;

  const container = targetCanvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  targetCanvas.width = container.clientWidth * dpr;
  targetCanvas.height = container.clientHeight * dpr;

  targetCtx.scale(dpr, dpr);
  targetCtx.clearRect(0, 0, container.clientWidth, container.clientHeight);

  if (!rawKlineData || rawKlineData.length === 0) return;

  const [y, m, d] = selectedDate.split('-').map(Number);
  const targetDayStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);
  const targetDayEndSec = targetDayStartSec + (24 * 3600) - 1;

  const dayCandles = rawKlineData.filter(item => item.time >= targetDayStartSec && item.time <= targetDayEndSec);
  if (dayCandles.length === 0) return;

  // Dynamic DST Shifts
  const ukShift = isUKSummerTime(selectedDate) ? 0 : 1; // London shift
  const usShift = isUSSummerTime(selectedDate) ? 0 : 1; // US/NQ shift

  // 1. Draw Colored Session Shading Boxes with High/Low Bounds & Label
  const sessionBoxConfigs = [];

  // ADE Macro Boxing: Asia (08:00 - 14:00), London (15:00 - 19:00), NewYork (20:00 - 23:45)
  if (showADE) {
    sessionBoxConfigs.push({
      title: 'Asia',
      startOffsetSec: 8 * 3600,                       // 08:00 UTC+8
      endOffsetSec: (14 + ukShift) * 3600,             // 14:00 (Summer) or 15:00 (Winter) UTC+8
      fillColor: 'rgba(239, 83, 80, 0.15)',            // Red Shading
      borderColor: 'rgba(239, 83, 80, 0.4)',
      textColor: '#ef5350',
    });
    sessionBoxConfigs.push({
      title: 'London',
      startOffsetSec: (15 + ukShift) * 3600,           // 15:00 (Summer) or 16:00 (Winter) UTC+8
      endOffsetSec: (19 + ukShift) * 3600,             // 19:00 (Summer) or 20:00 (Winter) UTC+8
      fillColor: 'rgba(76, 175, 80, 0.15)',            // Green Shading
      borderColor: 'rgba(76, 175, 80, 0.4)',
      textColor: '#4caf50',
    });
    sessionBoxConfigs.push({
      title: 'NewYork',
      startOffsetSec: (20 + usShift) * 3600,           // 20:00 (Summer) or 21:00 (Winter) UTC+8
      endOffsetSec: (23 + usShift) * 3600 + 2700,      // 23:45 (Summer) or 00:45 (Winter) UTC+8
      fillColor: 'rgba(255, 235, 59, 0.15)',           // Yellow Shading
      borderColor: 'rgba(255, 235, 59, 0.4)',
      textColor: '#ffeb3b',
    });
  }

  // London Sub-Sessions Group (Frankfurt, London, NQ)
  if (showLondonGroup) {
    sessionBoxConfigs.push({
      title: 'Frankfurt',
      startOffsetSec: (12 + ukShift) * 3600,              // 12:00 UTC+8
      endOffsetSec: (14 + ukShift) * 3600 + 1800,         // 14:30 UTC+8
      fillColor: 'rgba(255, 179, 0, 0.15)',   // Amber Gold
      borderColor: 'rgba(255, 179, 0, 0.4)',
      textColor: '#ffb300',
    });
    sessionBoxConfigs.push({
      title: 'London',
      startOffsetSec: (15 + ukShift) * 3600,              // 15:00 UTC+8
      endOffsetSec: (17 + ukShift) * 3600,               // 17:00 UTC+8
      fillColor: 'rgba(76, 175, 80, 0.15)',   // Emerald Green
      borderColor: 'rgba(76, 175, 80, 0.4)',
      textColor: '#4caf50',
    });
    sessionBoxConfigs.push({
      title: 'NQ',
      startOffsetSec: (17 + usShift) * 3600 + 1800,        // 17:30 UTC+8
      endOffsetSec: (19 + usShift) * 3600,               // 19:00 UTC+8
      fillColor: 'rgba(239, 83, 80, 0.15)',   // Red / Coral
      borderColor: 'rgba(239, 83, 80, 0.4)',
      textColor: '#ef5350',
    });
  }

  // NY Sub-Sessions Group (Pre Market, New York)
  if (showNYGroup) {
    sessionBoxConfigs.push({
      title: 'Pre Market',
      startOffsetSec: (20 + usShift) * 3600 + 1800,        // 20:30 UTC+8
      endOffsetSec: (21 + usShift) * 3600,               // 21:00 UTC+8
      fillColor: 'rgba(41, 98, 255, 0.15)',   // Royal Blue
      borderColor: 'rgba(41, 98, 255, 0.4)',
      textColor: '#2962ff',
    });
    sessionBoxConfigs.push({
      title: 'New York',
      startOffsetSec: (21 + usShift) * 3600 + 1800,        // 21:30 UTC+8
      endOffsetSec: (23 + usShift) * 3600 + 1800,        // 23:30 UTC+8
      fillColor: 'rgba(156, 39, 176, 0.15)',  // Purple
      borderColor: 'rgba(156, 39, 176, 0.4)',
      textColor: '#ab47bc',
    });
  }

  sessionBoxConfigs.forEach(config => {
    const sessionStartSec = targetDayStartSec + config.startOffsetSec;
    const sessionEndSec = targetDayStartSec + config.endOffsetSec;

    const sessionCandles = dayCandles.filter(c => c.time >= sessionStartSec && c.time <= sessionEndSec);
    if (sessionCandles.length === 0) return;

    let sHigh = -Infinity;
    let sLow = Infinity;

    sessionCandles.forEach(c => {
      if (c.high > sHigh) sHigh = c.high;
      if (c.low < sLow) sLow = c.low;
    });

    const firstTime = sessionCandles[0].time;
    const lastTime = sessionCandles[sessionCandles.length - 1].time;

    const x1 = targetChart.timeScale().timeToCoordinate(firstTime);
    const x2 = targetChart.timeScale().timeToCoordinate(lastTime);
    const y1 = targetSeries.priceToCoordinate(sHigh);
    const y2 = targetSeries.priceToCoordinate(sLow);

    if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
      const left = Math.min(x1, x2) - 4;
      const right = Math.max(x1, x2) + 4;
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      const width = right - left;
      const height = bottom - top;

      if (width > 0 && height > 0) {
        // Filled session box background
        targetCtx.fillStyle = config.fillColor;
        targetCtx.fillRect(left, top, width, height);

        // Optional subtle border frame
        targetCtx.strokeStyle = config.borderColor;
        targetCtx.lineWidth = 1;
        targetCtx.strokeRect(left, top, width, height);

        // Label text below box
        targetCtx.fillStyle = config.textColor;
        targetCtx.font = '600 12px Inter, sans-serif';
        targetCtx.textAlign = 'left';
        targetCtx.textBaseline = 'top';
        targetCtx.fillText(config.title, left + 6, bottom + 6);
      }
    }
  });
}

function updateAllSessionCanvases() {
  drawOverlayCanvas(canvasTop, ctxTop, chartTop, seriesTop);
  if (isDualLayout) {
    drawOverlayCanvas(canvasBottom, ctxBottom, chartBottom, seriesBottom);
  }
}
