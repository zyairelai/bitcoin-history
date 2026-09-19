// Keyboard Arrow Navigation (< and > arrow keys shift chart by 1 candle in current timeframe)
function handleChartArrowStep(e) {
  // Ignore if user is typing in an input element
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'keyup') return; // Only process on keydown

    const targetChart = chartTop || chartBottom;
    if (!targetChart) return;

    const currentRange = targetChart.timeScale().getVisibleLogicalRange();
    if (!currentRange) return;

    const step = (e.key === 'ArrowRight' || e.code === 'ArrowRight') ? 1 : -1;
    const newRange = {
      from: currentRange.from + step,
      to: currentRange.to + step
    };

    if (chartTop) chartTop.timeScale().setVisibleLogicalRange(newRange);
    if (chartBottom && isDualLayout) chartBottom.timeScale().setVisibleLogicalRange(newRange);
  }
}

function initPlaybackListeners() {
  window.addEventListener('keydown', handleChartArrowStep, true);
  window.addEventListener('keyup', handleChartArrowStep, true);
}
