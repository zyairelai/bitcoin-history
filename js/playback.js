// Keyboard Arrow Navigation for Playback (< and > arrows)
function handlePlaybackKey(e) {
  if (!isPlaybackMode) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    if (e.type === 'keyup') return; // Only process on keydown

    const { startSec, endSec } = calculateDisplayTimeBounds(selectedDate, daysMode, showSession);
    let dayCandles = rawKlineData.filter(item => item.time >= startSec && item.time <= endSec);

    if (dayCandles.length === 0) return;

    // Minimum index floor is 12:00 UTC+8 candle of selectedDate
    const [y, m, d] = selectedDate.split('-').map(Number);
    const targetDayStartSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);
    const sec1200 = targetDayStartSec + (12 * 3600);
    let minIdx = dayCandles.findIndex(c => c.time >= sec1200);
    if (minIdx === -1) minIdx = 0;

    let maxIdx = dayCandles.length - 1;

    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
      if (playbackIndex < maxIdx) {
        playbackIndex++;
        renderChartData();
      }
    } else if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
      if (playbackIndex > minIdx) {
        playbackIndex--;
        renderChartData();
      }
    }
  }
}

function initPlaybackListeners() {
  const playbackBtn = document.getElementById('playback-btn');
  if (playbackBtn) {
    playbackBtn.addEventListener('click', () => {
      isPlaybackMode = !isPlaybackMode;
      playbackBtn.classList.toggle('active', isPlaybackMode);

      if (isPlaybackMode) {
        playbackIndex = -1; // Reset to start from 12:00 UTC+8
      }

      renderChartData();
    });
  }

  window.addEventListener('keydown', handlePlaybackKey, true);
  window.addEventListener('keyup', handlePlaybackKey, true);
}
