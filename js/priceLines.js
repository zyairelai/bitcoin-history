// Clear existing Prev 1D & Session Price Lines for a series
function clearPriceLines(linesArray, targetSeries) {
  linesArray.forEach(line => {
    try { targetSeries.removePriceLine(line); } catch (e) {}
  });
  linesArray.length = 0;
}

/**
 * Helper: Create a price line and register it.
 */
function addPriceLine(targetSeries, linesArray, price, color, lineWidth, lineStyle) {
  const pl = targetSeries.createPriceLine({
    price,
    color,
    lineWidth,
    lineStyle,
    axisLabelVisible: false,
    title: '',
  });
  linesArray.push(pl);
  activePriceLines.push(price);
}

// Compute & Draw all price lines for a specific chart series.
// newToggleId: the ID of the toggle just turned ON (if any) — used for overlap dedup.
async function drawPriceLinesForSeries(targetSeries, linesArray, dataSource = rawKlineData, newToggleId = null) {
  clearPriceLines(linesArray, targetSeries);
  if (!dataSource || dataSource.length === 0) return;

  const [y, m, d] = selectedDate.split('-').map(Number);
  const targetUtcStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
  const targetDayStartSec = targetUtcStartSec - (8 * 3600);

  const selectedDateObj = new Date(Date.UTC(y, m - 1, d));
  const isMonday = selectedDateObj.getUTCDay() === 1;
  const ukShift = isUKSummerTime(selectedDate) ? 0 : 1;
  const usShift = isUSSummerTime(selectedDate) ? 0 : 1;

  // ─── Step 1: Compute all enabled group (high, low) pairs ─────────────────────

  // Previous Week (not in overlap group — always independent)
  let pwHigh = -Infinity, pwLow = Infinity;
  if (showPW) {
    const dayOfWeek = selectedDateObj.getUTCDay();
    const diffToMon = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const currentWeekMonUtcSec = targetUtcStartSec - (diffToMon * 86400);
    const prevWeekStartUtcSec = currentWeekMonUtcSec - (7 * 86400);
    const prevWeekEndUtcSec = currentWeekMonUtcSec - 1;

    const pwKline = await fetchDirectKline(currentSymbol, '1w', prevWeekStartUtcSec * 1000, prevWeekEndUtcSec * 1000);
    if (pwKline) {
      pwHigh = pwKline.high; pwLow = pwKline.low;
    } else {
      filterSessionCandles(dataSource, prevWeekStartUtcSec, prevWeekEndUtcSec, currentInterval).forEach(c => {
        if (c.high > pwHigh) pwHigh = c.high;
        if (c.low < pwLow) pwLow = c.low;
      });
    }
  }

  // PDHLM (Previous Day High / Low / Mid)
  let prevHigh = -Infinity, prevLow = Infinity;
  if (showPDHLM || showFibb || showExtend || showExtendFibb) {
    if (isMonday) {
      const satStartUtcSec = targetUtcStartSec - (48 * 3600);
      const sunEndUtcSec = targetUtcStartSec - 1;
      const satKline = await fetchDirectKline(currentSymbol, '1d', satStartUtcSec * 1000, (satStartUtcSec + 86400 - 1) * 1000);
      const sunKline = await fetchDirectKline(currentSymbol, '1d', (targetUtcStartSec - 86400) * 1000, sunEndUtcSec * 1000);
      if (satKline && sunKline) {
        prevHigh = Math.max(satKline.high, sunKline.high);
        prevLow = Math.min(satKline.low, sunKline.low);
      } else {
        filterSessionCandles(dataSource, satStartUtcSec, sunEndUtcSec, currentInterval).forEach(c => {
          if (c.high > prevHigh) prevHigh = c.high;
          if (c.low < prevLow) prevLow = c.low;
        });
      }
    } else {
      const prevDayStartUtcSec = targetUtcStartSec - (24 * 3600);
      const prevDayEndUtcSec = targetUtcStartSec - 1;
      const prevDayKline = await fetchDirectKline(currentSymbol, '1d', prevDayStartUtcSec * 1000, prevDayEndUtcSec * 1000);
      if (prevDayKline) {
        prevHigh = prevDayKline.high; prevLow = prevDayKline.low;
      } else {
        filterSessionCandles(dataSource, prevDayStartUtcSec, prevDayEndUtcSec, currentInterval).forEach(c => {
          if (c.high > prevHigh) prevHigh = c.high;
          if (c.low < prevLow) prevLow = c.low;
        });
      }
    }
  }

  // Monday High/Low
  let monHigh = -Infinity, monLow = Infinity;
  if (showMonday) {
    const dayOfWeek = selectedDateObj.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const diffToMon = dayOfWeek - 1;
      const currentWeekMonUtcSec = targetUtcStartSec - (diffToMon * 86400);
      const currentWeekMonEndUtcSec = currentWeekMonUtcSec + 86400 - 1;
      const mondayKline = await fetchDirectKline(currentSymbol, '1d', currentWeekMonUtcSec * 1000, currentWeekMonEndUtcSec * 1000);
      if (mondayKline) {
        monHigh = mondayKline.high; monLow = mondayKline.low;
      } else {
        filterSessionCandles(dataSource, currentWeekMonUtcSec, currentWeekMonEndUtcSec, currentInterval).forEach(c => {
          if (c.high > monHigh) monHigh = c.high;
          if (c.low < monLow) monLow = c.low;
        });
      }
    }
  }

  // 0800-1400
  let highAsia2 = -Infinity, lowAsia2 = Infinity;
  if (showAsia2) {
    const asia2StartSec = targetDayStartSec + (8 * 3600);
    const asia2EndSec = targetDayStartSec + ((14 + ukShift) * 3600);
    filterSessionCandles(dataSource, asia2StartSec, asia2EndSec - 1, currentInterval).forEach(c => {
      if (c.high > highAsia2) highAsia2 = c.high;
      if (c.low < lowAsia2) lowAsia2 = c.low;
    });
  }

  // 1500-2000
  let high15_20 = -Infinity, low15_20 = Infinity;
  if (showSession15_20) {
    const start15_20 = targetDayStartSec + (15 * 3600);
    const end15_20 = targetDayStartSec + (20 * 3600);
    filterSessionCandles(dataSource, start15_20, end15_20 - 1, currentInterval).forEach(c => {
      if (c.high > high15_20) high15_20 = c.high;
      if (c.low < low15_20) low15_20 = c.low;
    });
  }

  // 0800-2000
  let highAsia3 = -Infinity, lowAsia3 = Infinity;
  if (showAsia3) {
    const asia3StartSec = targetDayStartSec + (8 * 3600);
    const asia3EndSec = targetDayStartSec + (20 * 3600);
    filterSessionCandles(dataSource, asia3StartSec, asia3EndSec - 1, currentInterval).forEach(c => {
      if (c.high > highAsia3) highAsia3 = c.high;
      if (c.low < lowAsia3) lowAsia3 = c.low;
    });
  }

  // 2000-0400
  let high2000_0400 = -Infinity, low2000_0400 = Infinity;
  if (showSession2000_0400) {
    const start2000_0400 = targetDayStartSec - (4 * 3600);
    const end2000_0400 = targetDayStartSec + (4 * 3600);
    filterSessionCandles(dataSource, start2000_0400, end2000_0400 - 1, currentInterval).forEach(c => {
      if (c.high > high2000_0400) high2000_0400 = c.high;
      if (c.low < low2000_0400) low2000_0400 = c.low;
    });
  }

  // ─── Step 2: Overlap dedup ───────────────────────────────────────────────────
  // Groups that participate in overlap detection (high+low pairs)
  // Each entry: { id, enabled, high, low }
  const overlapGroups = [
    { id: 'toggle-monday',             enabled: showMonday,          high: monHigh,       low: monLow       },
    { id: 'toggle-pdhlm',              enabled: showPDHLM,           high: prevHigh,      low: prevLow      },
    { id: 'toggle-asia-8-14',          enabled: showAsia2,           high: highAsia2,     low: lowAsia2     },
    { id: 'toggle-session-15-20',      enabled: showSession15_20,    high: high15_20,     low: low15_20     },
    { id: 'toggle-asia-8-20',          enabled: showAsia3,           high: highAsia3,     low: lowAsia3     },
    { id: 'toggle-session-2000-0400',  enabled: showSession2000_0400,high: high2000_0400, low: low2000_0400 },
  ].filter(g => g.enabled && g.high !== -Infinity && g.low !== Infinity);

  // Set of IDs to suppress (old groups whose h+l are exactly matched by the new toggle)
  const suppressed = new Set();

  if (newToggleId) {
    const newGroup = overlapGroups.find(g => g.id === newToggleId);
    if (newGroup) {
      overlapGroups.forEach(g => {
        if (g.id !== newToggleId && g.high === newGroup.high && g.low === newGroup.low) {
          suppressed.add(g.id);
        }
      });
    }
  }

  // Helper to check if a group is suppressed
  const isActive = (id) => !suppressed.has(id);

  // ─── Step 3: Draw ────────────────────────────────────────────────────────────

  // Previous Week (always independent, never suppressed)
  if (showPW && pwHigh !== -Infinity && pwLow !== Infinity) {
    addPriceLine(targetSeries, linesArray, pwHigh, '#ab47bc', 2, LightweightCharts.LineStyle.Solid);
    addPriceLine(targetSeries, linesArray, pwLow,  '#ab47bc', 2, LightweightCharts.LineStyle.Solid);
  }

  // Monday
  if (showMonday && isActive('toggle-monday') && monHigh !== -Infinity && monLow !== Infinity) {
    addPriceLine(targetSeries, linesArray, monHigh, '#29b6f6', 2, LightweightCharts.LineStyle.Solid);
    addPriceLine(targetSeries, linesArray, monLow,  '#29b6f6', 2, LightweightCharts.LineStyle.Solid);
  }

  // PDHLM + Fibb + Extend
  if (prevHigh !== -Infinity && prevLow !== Infinity) {
    const prevMid = (prevHigh + prevLow) / 2;

    let sumHM = prevHigh + prevMid;
    if (Number.isInteger(sumHM) && sumHM % 2 !== 0) sumHM += 1;
    const prev75 = sumHM / 2;

    let sumLM = prevLow + prevMid;
    if (Number.isInteger(sumLM) && sumLM % 2 !== 0) sumLM -= 1;
    const prev25 = sumLM / 2;

    if (showPDHLM && isActive('toggle-pdhlm')) {
      addPriceLine(targetSeries, linesArray, prevHigh, '#ffffff', 2, LightweightCharts.LineStyle.Solid);
      addPriceLine(targetSeries, linesArray, prevMid,  '#ffffff', 2, LightweightCharts.LineStyle.Dashed);
      addPriceLine(targetSeries, linesArray, prevLow,  '#ffffff', 2, LightweightCharts.LineStyle.Solid);
    }
    if (showFibb) {
      addPriceLine(targetSeries, linesArray, prev75, '#ffeb3b', 2, LightweightCharts.LineStyle.Dotted);
      addPriceLine(targetSeries, linesArray, prev25, '#ffeb3b', 2, LightweightCharts.LineStyle.Dotted);
    }
    if (showExtend) {
      const midDist = (prevHigh - prevLow) / 2;
      addPriceLine(targetSeries, linesArray, prevHigh + midDist, '#ffeb3b', 2, LightweightCharts.LineStyle.Solid);
      addPriceLine(targetSeries, linesArray, prevLow  - midDist, '#ffeb3b', 2, LightweightCharts.LineStyle.Solid);
    }
    if (showExtendFibb) {
      const quarterDist = (prevHigh - prevLow) / 4;
      addPriceLine(targetSeries, linesArray, prevHigh + quarterDist, '#ffeb3b', 2, LightweightCharts.LineStyle.Dotted);
      addPriceLine(targetSeries, linesArray, prevLow  - quarterDist, '#ffeb3b', 2, LightweightCharts.LineStyle.Dotted);
    }
  }

  // 0800-1400
  if (showAsia2 && isActive('toggle-asia-8-14') && highAsia2 !== -Infinity && lowAsia2 !== Infinity) {
    addPriceLine(targetSeries, linesArray, highAsia2, '#ef5350', 2, LightweightCharts.LineStyle.Solid);
    addPriceLine(targetSeries, linesArray, lowAsia2,  '#ef5350', 2, LightweightCharts.LineStyle.Solid);
  }

  // 1500-2000
  if (showSession15_20 && isActive('toggle-session-15-20') && high15_20 !== -Infinity && low15_20 !== Infinity) {
    addPriceLine(targetSeries, linesArray, high15_20, '#4caf50', 2, LightweightCharts.LineStyle.Solid);
    addPriceLine(targetSeries, linesArray, low15_20,  '#4caf50', 2, LightweightCharts.LineStyle.Solid);
  }

  // 0800-2000
  if (showAsia3 && isActive('toggle-asia-8-20') && highAsia3 !== -Infinity && lowAsia3 !== Infinity) {
    addPriceLine(targetSeries, linesArray, highAsia3, '#ef5350', 2, LightweightCharts.LineStyle.Solid);
    addPriceLine(targetSeries, linesArray, lowAsia3,  '#ef5350', 2, LightweightCharts.LineStyle.Solid);
  }

  // 2000-0400
  if (showSession2000_0400 && isActive('toggle-session-2000-0400') && high2000_0400 !== -Infinity && low2000_0400 !== Infinity) {
    addPriceLine(targetSeries, linesArray, high2000_0400, '#26a69a', 2, LightweightCharts.LineStyle.Solid);
    addPriceLine(targetSeries, linesArray, low2000_0400,  '#26a69a', 2, LightweightCharts.LineStyle.Solid);
  }
}

async function updateAllPriceLines(newToggleId = null) {
  activePriceLines = [];
  await drawPriceLinesForSeries(seriesTop, priceLinesTop, rawKlineData, newToggleId);
  updateAllSessionCanvases();
}
