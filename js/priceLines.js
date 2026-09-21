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
async function drawPriceLinesForSeries(targetSeries, linesArray, dataSource = rawKlineData) {
  clearPriceLines(linesArray, targetSeries);
  if (!dataSource || dataSource.length === 0) return;

  const [y, m, d] = selectedDate.split('-').map(Number);
  const targetUtcStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
  const targetDayStartSec = targetUtcStartSec - (8 * 3600);

  const selectedDateObj = new Date(Date.UTC(y, m - 1, d));
  const isMonday = selectedDateObj.getUTCDay() === 1;

  // Compute & Draw PW (Previous Week / Weekly) High & Low solid purple lines using 1W Binance Kline
  if (showPW) {
    const dayOfWeek = selectedDateObj.getUTCDay(); // 0:Sun, 1:Mon, 2:Tue...
    const diffToMon = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const currentWeekMonUtcSec = targetUtcStartSec - (diffToMon * 86400);
    const prevWeekStartUtcSec = currentWeekMonUtcSec - (7 * 86400);
    const prevWeekEndUtcSec = currentWeekMonUtcSec - 1;

    // Pull 1W Binance kline directly
    const pwKline = await fetchDirectKline(currentSymbol, '1w', prevWeekStartUtcSec * 1000, prevWeekEndUtcSec * 1000);

    let pwHigh = -Infinity;
    let pwLow = Infinity;

    if (pwKline) {
      pwHigh = pwKline.high;
      pwLow = pwKline.low;
    } else {
      const prevWeekCandles = dataSource.filter(item => item.time >= prevWeekStartUtcSec && item.time <= prevWeekEndUtcSec);
      prevWeekCandles.forEach(c => {
        if (c.high > pwHigh) pwHigh = c.high;
        if (c.low < pwLow) pwLow = c.low;
      });
    }

    if (pwHigh !== -Infinity && pwLow !== Infinity) {
      const pwSpecs = [
        { price: pwHigh, color: '#ab47bc', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2 },
        { price: pwLow,  color: '#ab47bc', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2 },
      ];

      pwSpecs.forEach(spec => {
        const pl = targetSeries.createPriceLine({
          price: spec.price,
          color: spec.color,
          lineWidth: spec.lineWidth,
          lineStyle: spec.lineStyle,
          axisLabelVisible: false,
          title: '',
        });
        linesArray.push(pl);
        activePriceLines.push(spec.price);
      });
    }
  }

  // Compute & Draw Current Week Monday High & Low lines using 1D Binance Kline (only if selected date is Mon-Fri)
  if (showMonday) {
    const dayOfWeek = selectedDateObj.getUTCDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const diffToMon = dayOfWeek - 1;
      const currentWeekMonUtcSec = targetUtcStartSec - (diffToMon * 86400);
      const currentWeekMonEndUtcSec = currentWeekMonUtcSec + 86400 - 1;

      // Pull 1D Binance kline for Monday directly
      const mondayKline = await fetchDirectKline(currentSymbol, '1d', currentWeekMonUtcSec * 1000, currentWeekMonEndUtcSec * 1000);

      let monHigh = -Infinity;
      let monLow = Infinity;

      if (mondayKline) {
        monHigh = mondayKline.high;
        monLow = mondayKline.low;
      } else {
        const mondayCandles = dataSource.filter(item => item.time >= currentWeekMonUtcSec && item.time <= currentWeekMonEndUtcSec);
        mondayCandles.forEach(c => {
          if (c.high > monHigh) monHigh = c.high;
          if (c.low < monLow) monLow = c.low;
        });
      }

      if (monHigh !== -Infinity && monLow !== Infinity) {
        const mondaySpecs = [
          { price: monHigh, color: '#29b6f6', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2 },
          { price: monLow,  color: '#29b6f6', lineStyle: LightweightCharts.LineStyle.Solid, lineWidth: 2 },
        ];

        mondaySpecs.forEach(spec => {
          const pl = targetSeries.createPriceLine({
            price: spec.price,
            color: spec.color,
            lineWidth: spec.lineWidth,
            lineStyle: spec.lineStyle,
            axisLabelVisible: false,
            title: '',
          });
          linesArray.push(pl);
          activePriceLines.push(spec.price);
        });
      }
    }
  }

  let prevHigh = -Infinity;
  let prevLow = Infinity;

  if (isMonday) {
    // On Monday, PREV 1D High/Low (Weekend Range) is Sat 00:00 UTC to Sun 23:59 UTC
    const satStartUtcSec = targetUtcStartSec - (48 * 3600);
    const sunEndUtcSec = targetUtcStartSec - 1;

    const satKline = await fetchDirectKline(currentSymbol, '1d', satStartUtcSec * 1000, (satStartUtcSec + 86400 - 1) * 1000);
    const sunKline = await fetchDirectKline(currentSymbol, '1d', (targetUtcStartSec - 86400) * 1000, sunEndUtcSec * 1000);

    if (satKline && sunKline) {
      prevHigh = Math.max(satKline.high, sunKline.high);
      prevLow = Math.min(satKline.low, sunKline.low);
    } else {
      const prevDayCandles = dataSource.filter(item => item.time >= satStartUtcSec && item.time <= sunEndUtcSec);
      prevDayCandles.forEach(c => {
        if (c.high > prevHigh) prevHigh = c.high;
        if (c.low < prevLow) prevLow = c.low;
      });
    }
  } else {
    // Previous UTC day (00:00:00 UTC to 23:59:59 UTC) via 1D Binance Kline
    const prevDayStartUtcSec = targetUtcStartSec - (24 * 3600);
    const prevDayEndUtcSec = targetUtcStartSec - 1;

    const prevDayKline = await fetchDirectKline(currentSymbol, '1d', prevDayStartUtcSec * 1000, prevDayEndUtcSec * 1000);

    if (prevDayKline) {
      prevHigh = prevDayKline.high;
      prevLow = prevDayKline.low;
    } else {
      const prevDayCandles = dataSource.filter(item => item.time >= prevDayStartUtcSec && item.time <= prevDayEndUtcSec);
      prevDayCandles.forEach(c => {
        if (c.high > prevHigh) prevHigh = c.high;
        if (c.low < prevLow) prevLow = c.low;
      });
    }
  }

  if (prevHigh !== -Infinity && prevLow !== Infinity) {
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
        activePriceLines.push(spec.price);
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
      activePriceLines.push(extendAbove);

      const plBelow = targetSeries.createPriceLine({
        price: extendBelow,
        color: '#ffeb3b',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plBelow);
      activePriceLines.push(extendBelow);
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
      activePriceLines.push(extendFibbAbove);

      const plBelow = targetSeries.createPriceLine({
        price: extendFibbBelow,
        color: '#ffeb3b',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plBelow);
      activePriceLines.push(extendFibbBelow);
    }
  }

  // Asia Session: 0800-1400 (Summer) or 0800-1500 (Winter DST shift)
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
      activePriceLines.push(highAsia2);

      const plAsia2Low = targetSeries.createPriceLine({
        price: lowAsia2,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia2Low);
      activePriceLines.push(lowAsia2);
    }
  }

  // Session 1500-2000 (15:00 - 20:00 UTC+8)
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
      activePriceLines.push(high15_20);

      const pl15_20Low = targetSeries.createPriceLine({
        price: low15_20,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(pl15_20Low);
      activePriceLines.push(low15_20);
    }
  }

  // Session 0800-2000 (08:00 - 20:00 UTC+8)
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
      activePriceLines.push(highAsia3);

      const plAsia3Low = targetSeries.createPriceLine({
        price: lowAsia3,
        color: '#ef5350',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(plAsia3Low);
      activePriceLines.push(lowAsia3);
    }
  }

  // Session 2000-0400 (20:00 UTC+8 previous day to 04:00 UTC+8 selected day)
  if (showSession2000_0400) {
    const start2000_0400 = targetDayStartSec - (4 * 3600); // 20:00 UTC+8 previous day
    const end2000_0400 = targetDayStartSec + (4 * 3600);   // 04:00 UTC+8 selected day

    const candles2000_0400 = dataSource.filter(item => item.time >= start2000_0400 && item.time < end2000_0400);
    if (candles2000_0400.length > 0) {
      let high2000_0400 = -Infinity;
      let low2000_0400 = Infinity;

      candles2000_0400.forEach(c => {
        if (c.high > high2000_0400) high2000_0400 = c.high;
        if (c.low < low2000_0400) low2000_0400 = c.low;
      });

      const pl2000_0400High = targetSeries.createPriceLine({
        price: high2000_0400,
        color: '#26a69a',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(pl2000_0400High);
      activePriceLines.push(high2000_0400);

      const pl2000_0400Low = targetSeries.createPriceLine({
        price: low2000_0400,
        color: '#26a69a',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
      linesArray.push(pl2000_0400Low);
      activePriceLines.push(low2000_0400);
    }
  }
}

async function updateAllPriceLines() {
  activePriceLines = [];
  await drawPriceLinesForSeries(seriesTop, priceLinesTop, rawKlineData);
  if (isDualLayout) {
    await drawPriceLinesForSeries(seriesBottom, priceLinesBottom, rawKlineData);
  }
  updateAllSessionCanvases();
}


