// Main Entry Point & Event Listener Setup

function initEventListeners() {
  const chartTypeToggleBtn = document.getElementById('chart-type-toggle');

  // Toggle Candlestick vs Heikin-Ashi mode in single view
  if (chartTypeToggleBtn) {
    chartTypeToggleBtn.addEventListener('click', () => {
      isHeikinAshi = !isHeikinAshi;
      chartTypeToggleBtn.classList.toggle('active', isHeikinAshi);
      renderChartData();
    });
  }

  // Layout Toggle Button Event (Single vs Dual Split View)
  layoutToggleBtn.addEventListener('click', () => {
    isDualLayout = !isDualLayout;
    layoutToggleBtn.classList.toggle('active', isDualLayout);

    if (isDualLayout) {
      panelBottom.classList.remove('hidden');
      if (chartBottom) {
        chartBottom.applyOptions({
          timeScale: { visible: false }
        });
      }
    } else {
      panelBottom.classList.add('hidden');
    }

    renderChartData();

    // Force chart resize & sync range immediately
    setTimeout(() => {
      resizeCharts();
      if (isDualLayout && chartTop) {
        const range = chartTop.timeScale().getVisibleLogicalRange();
        if (range) {
          chartBottom.timeScale().setVisibleLogicalRange(range);
        }
      }
    }, 50);
  });

  // Level Checkbox Event Listeners
  toggle25_75Input.addEventListener('change', (e) => {
    showFibb = e.target.checked;
    updateAllPriceLines();
  });

  toggleAsia8_12Input.addEventListener('change', (e) => {
    showAsia1 = e.target.checked;
    updateAllPriceLines();
  });

  toggleAsia8_14Input.addEventListener('change', (e) => {
    showAsia2 = e.target.checked;
    updateAllPriceLines();
  });

  toggleExtendInput.addEventListener('change', (e) => {
    showExtend = e.target.checked;
    updateAllPriceLines();
  });

  toggleSessionInput.addEventListener('change', (e) => {
    showSession = e.target.checked;
    renderChartData();
    if (chartTop) chartTop.timeScale().fitContent();
    if (chartBottom && isDualLayout) chartBottom.timeScale().fitContent();
  });

  toggleADEInput.addEventListener('change', (e) => {
    showADE = e.target.checked;
    updateAllSessionCanvases();
  });

  toggleLondonInput.addEventListener('change', (e) => {
    showLondonGroup = e.target.checked;
    updateAllSessionCanvases();
  });

  toggleNYInput.addEventListener('change', (e) => {
    showNYGroup = e.target.checked;
    updateAllSessionCanvases();
  });

  // Timeframe Selection
  timeframeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.tf-btn');
    if (!btn) return;

    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentInterval = btn.dataset.tf;
    fetchKlines();
  });

  // Days Mode Range Dropdown Selection (1D, 2D, 3D, 1W)
  if (daysModeSelect) {
    daysModeSelect.addEventListener('change', (e) => {
      daysMode = e.target.value;
      fetchKlines();
    });
  }

  // Timezone Dropup Selection (UTC+8 vs UTC)
  if (timezoneSelect) {
    timezoneSelect.addEventListener('change', (e) => {
      selectedTimezone = e.target.value;
      // Re-apply options so lightweight charts re-evaluates tickMarkFormatter and timeFormatter
      if (chartTop) {
        chartTop.applyOptions(createChartOptions(document.getElementById('chart-container-top')));
      }
      if (chartBottom) {
        chartBottom.applyOptions(createChartOptions(document.getElementById('chart-container-bottom')));
      }
      renderChartData();
    });
  }

  initCalendarListeners();
  initPlaybackListeners();
}

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  const defaultDate = getLatestPastWeekday();
  setSelectedDate(defaultDate);
  
  const dObj = new Date(defaultDate + 'T00:00:00');
  currentCalYear = dObj.getFullYear();
  currentCalMonth = dObj.getMonth();

  initCharts();
  initEventListeners();
  fetchKlines();
});
