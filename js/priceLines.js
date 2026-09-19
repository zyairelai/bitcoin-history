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
function drawPriceLinesForSeries(targetSeries, linesArray, dataSource = rawKlineData) {
  clearPriceLines(linesArray, targetSeries);
  if (!dataSource || dataSource.length === 0) return;

  const [y, m, d] = selectedDate.split('-').map(Number);
  const targetUtcStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
  const targetDayStartSec = targetUtcStartSec - (8 * 3600);

  const selectedDateObj = new Date(Date.UTC(y, m - 1, d));
  const isMonday = selectedDateObj.getUTCDay() === 1;

  let prevDayCandles = [];

  if (isMonday) {
    // On Monday, PREV 1D High/Low (Weekend Range) is Sat 00:00 UTC to Sun 23:59 UTC
    const satStartUtcSec = targetUtcStartSec - (48 * 3600);
    const sunEndUtcSec = targetUtcStartSec - 1;
    prevDayCandles = dataSource.filter(item => item.time >= satStartUtcSec && item.time <= sunEndUtcSec);
  } else {
    // Previous UTC day (00:00:00 UTC to 23:59:59 UTC)
    const prevDayStartUtcSec = targetUtcStartSec - (24 * 3600);
    const prevDayEndUtcSec = targetUtcStartSec - 1;
    prevDayCandles = dataSource.filter(item => item.time >= prevDayStartUtcSec && item.time <= prevDayEndUtcSec);
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
      { price: prevHigh, color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2, enabled: showPDHLM },
      { price: prev75,   color: '#ffeb3b', lineStyle: LightweightCharts.LineStyle.Dotted, lineWidth: 2, enabled: showFibb },
      { price: prevMid,  color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Dashed, lineWidth: 2, enabled: showPDHLM },
      { price: prev25,   color: '#ffeb3b', lineStyle: LightweightCharts.LineStyle.Dotted, lineWidth: 2, enabled: showFibb },
      { price: prevLow,  color: '#ffffff', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2, enabled: showPDHLM },
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
      const range1d = prevHigh - prevLow;
      const midDist = range1d / 2;
      const extendAbove = prevHigh + midDist;
      const extendBelow = prevLow - midDist;

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

    if (showExtendFibb) {
      const range1d = prevHigh - prevLow;
      const quarterDist = range1d / 4;
      const extendFibbAbove = prevHigh + quarterDist;
      const extendFibbBelow = prevLow - quarterDist;

      const plAbove = targetSeries.createPriceLine({
        price: extendFibbAbove,
        color: '#ffeb3b',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAbove);

      const plBelow = targetSeries.createPriceLine({
        price: extendFibbBelow,
        color: '#ffeb3b',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dotted,
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

    const candlesAsia1 = dataSource.filter(item => item.time >= asia1StartSec && item.time < asia1EndSec);
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

    const candlesAsia2 = dataSource.filter(item => item.time >= asia2StartSec && item.time < asia2EndSec);
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

  // Session 1500-2000 (15:00 - 20:00 UTC+8) Solid Red Lines
  if (showSession15_20) {
    const start15_20 = targetDayStartSec + (15 * 3600);
    const end15_20 = targetDayStartSec + (20 * 3600);

    const candles15_20 = dataSource.filter(item => item.time >= start15_20 && item.time < end15_20);
    if (candles15_20.length > 0) {
      let high15_20 = -Infinity;
      let low15_20 = Infinity;

      candles15_20.forEach(c => {
        if (c.high > high15_20) high15_20 = c.high;
        if (c.low < low15_20) low15_20 = c.low;
      });

      const pl15_20High = targetSeries.createPriceLine({
        price: high15_20,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(pl15_20High);

      const pl15_20Low = targetSeries.createPriceLine({
        price: low15_20,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(pl15_20Low);
    }
  }

  // Session 0800-2000 (08:00 - 20:00 UTC+8) Solid Red Lines
  if (showAsia3) {
    const asia3StartSec = targetDayStartSec + (8 * 3600);
    const asia3EndSec = targetDayStartSec + (20 * 3600);

    const candlesAsia3 = dataSource.filter(item => item.time >= asia3StartSec && item.time < asia3EndSec);
    if (candlesAsia3.length > 0) {
      let highAsia3 = -Infinity;
      let lowAsia3 = Infinity;

      candlesAsia3.forEach(c => {
        if (c.high > highAsia3) highAsia3 = c.high;
        if (c.low < lowAsia3) lowAsia3 = c.low;
      });

      const plAsia3High = targetSeries.createPriceLine({
        price: highAsia3,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia3High);

      const plAsia3Low = targetSeries.createPriceLine({
        price: lowAsia3,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia3Low);
    }
  }
}

function updateAllPriceLines() {
  drawPriceLinesForSeries(seriesTop, priceLinesTop, rawKlineData);
  if (isDualLayout) {
    drawPriceLinesForSeries(seriesBottom, priceLinesBottom, rawKlineData);
  }
  updateAllSessionCanvases();
}
