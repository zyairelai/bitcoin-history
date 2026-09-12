// Clear existing Prev 1D & Session Price Lines / Markers for both charts
function clearPriceLines(linesArray, targetSeries) {
  linesArray.forEach(line => {
    try {
      targetSeries.removePriceLine(line);
    } catch (e) {
      // Ignore if already removed
    }
  });
  linesArray.length = 0;
}

// Compute & Draw Prev 1D, 0800-1200 / Asia 2, Extend Lines for a specific chart series
function drawPriceLinesForSeries(targetSeries, linesArray) {
  clearPriceLines(linesArray, targetSeries);

  const [y, m, d] = selectedDate.split('-').map(Number);
  const targetDayStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);

  const selectedDateObj = new Date(Date.UTC(y, m - 1, d));
  const isMonday = selectedDateObj.getUTCDay() === 1;

  let prevDayCandles = [];

  if (isMonday) {
    // On Monday, PREV 1D High/Low includes both Saturday and Sunday (48h weekend window)
    const satStartSec = targetDayStartSec - (48 * 3600);
    const sunEndSec = targetDayStartSec - 1;
    prevDayCandles = rawKlineData.filter(item => item.time >= satStartSec && item.time <= sunEndSec);
  } else {
    const prevWeekdayStr = getPreviousWeekdayDateStr(selectedDate);
    const [py, pm, pd] = prevWeekdayStr.split('-').map(Number);
    const prevDayStartSec = Math.floor(Date.UTC(py, pm - 1, pd, 0, 0, 0) / 1000) - (8 * 3600);
    const prevDayEndSec = prevDayStartSec + (24 * 3600) - 1;
    prevDayCandles = rawKlineData.filter(item => item.time >= prevDayStartSec && item.time <= prevDayEndSec);
  }

  if (prevDayCandles.length > 0) {
    let prevHigh = -Infinity;
    let prevLow = Infinity;

    prevDayCandles.forEach(c => {
      if (c.high > prevHigh) prevHigh = c.high;
      if (c.low < prevLow) prevLow = c.low;
    });

    const prevMid = (prevHigh + prevLow) / 2;

    // Follow zones.py exact calculations with integer parity adjustments
    let sumHM = prevHigh + prevMid;
    if (Number.isInteger(sumHM) && sumHM % 2 !== 0) {
      sumHM += 1;
    }
    const prev75 = sumHM / 2;

    let sumLM = prevLow + prevMid;
    if (Number.isInteger(sumLM) && sumLM % 2 !== 0) {
      sumLM -= 1;
    }
    const prev25 = sumLM / 2;

    const lineSpecs = [
      { price: prevHigh, color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2, enabled: true },
      { price: prev75,   color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Dotted, lineWidth: 2, enabled: showFibb },
      { price: prevMid,  color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Dashed, lineWidth: 2, enabled: true },
      { price: prev25,   color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Dotted, lineWidth: 2, enabled: showFibb },
      { price: prevLow,  color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2, enabled: true },
    ];

    lineSpecs.forEach(spec => {
      if (spec.enabled) {
        const pl = targetSeries.createPriceLine({
          price: spec.price,
          color: spec.color,
          lineWidth: spec.lineWidth,
          lineStyle: spec.lineStyle,
          axisLabelVisible: false,
          title: '',
        });
        linesArray.push(pl);
      }
    });

    if (showExtend) {
      const gap25 = prevMid - prev25;
      const extendAbove = prevHigh + gap25;
      const extendBelow = prevLow - gap25;

      const plAbove = targetSeries.createPriceLine({
        price: extendAbove,
        color: '#ffeb3b',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAbove);

      const plBelow = targetSeries.createPriceLine({
        price: extendBelow,
        color: '#ffeb3b',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plBelow);
    }
  }

  // 0800-1200 Asia Session
  if (showAsia1) {
    const asia1StartSec = targetDayStartSec + (8 * 3600);
    const asia1EndSec = targetDayStartSec + (12 * 3600);

    const candlesAsia1 = rawKlineData.filter(item => item.time >= asia1StartSec && item.time < asia1EndSec);
    if (candlesAsia1.length > 0) {
      let highAsia1 = -Infinity;
      let lowAsia1 = Infinity;

      candlesAsia1.forEach(c => {
        if (c.high > highAsia1) highAsia1 = c.high;
        if (c.low < lowAsia1) lowAsia1 = c.low;
      });

      const plAsia1High = targetSeries.createPriceLine({
        price: highAsia1,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia1High);

      const plAsia1Low = targetSeries.createPriceLine({
        price: lowAsia1,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia1Low);
    }
  }

  // Asia Session 2: 0800-1400 (Summer) or 0800-1500 (Winter DST shift)
  if (showAsia2) {
    const ukShift = isUKSummerTime(selectedDate) ? 0 : 1;
    const asia2StartSec = targetDayStartSec + (8 * 3600);
    const asia2EndSec = targetDayStartSec + ((14 + ukShift) * 3600);

    const candlesAsia2 = rawKlineData.filter(item => item.time >= asia2StartSec && item.time < asia2EndSec);
    if (candlesAsia2.length > 0) {
      let highAsia2 = -Infinity;
      let lowAsia2 = Infinity;

      candlesAsia2.forEach(c => {
        if (c.high > highAsia2) highAsia2 = c.high;
        if (c.low < lowAsia2) lowAsia2 = c.low;
      });

      const plAsia2High = targetSeries.createPriceLine({
        price: highAsia2,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia2High);

      const plAsia2Low = targetSeries.createPriceLine({
        price: lowAsia2,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia2Low);
    }
  }
}

function updateAllPriceLines() {
  drawPriceLinesForSeries(seriesTop, priceLinesTop);
  if (isDualLayout) {
    drawPriceLinesForSeries(seriesBottom, priceLinesBottom);
  }
  updateAllSessionCanvases();
}
