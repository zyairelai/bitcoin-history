// Keyboard Arrow Navigation (Arrow keys / Comma / Period shift chart visible range)
function handleChartArrowStep(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  const key = e.key;
  const code = e.code;

  if (
    key === 'ArrowRight' || key === 'ArrowLeft' ||
    code === 'ArrowRight' || code === 'ArrowLeft' ||
    key === '<' || key === '>' ||
    key === ',' || key === '.'
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'keyup') return;

    const targetChart = chartTop;
    if (!targetChart) return;

    const currentRange = targetChart.timeScale().getVisibleLogicalRange();
    if (!currentRange) return;

    const step = (key === 'ArrowRight' || code === 'ArrowRight' || key === '>' || key === '.') ? 1 : -1;
    const newRange = {
      from: currentRange.from + step,
      to: currentRange.to + step
    };

    if (chartTop) chartTop.timeScale().setVisibleLogicalRange(newRange);
  }
}

function initPlaybackListeners() {
  window.addEventListener('keydown', handleChartArrowStep, true);
}
