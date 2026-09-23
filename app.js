// Main Entry Point & Event Listener Setup

function updateChartTypeBtnUI() {
  const chartTypeToggleBtn = document.getElementById('chart-type-toggle');
  if (!chartTypeToggleBtn) return;

  chartTypeToggleBtn.classList.toggle('active', isHeikinAshi);

  const candlestickSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="9" y1="2" x2="9" y2="6"></line>
    <line x1="9" y1="20" x2="9" y2="22"></line>
    <rect x="6" y="6" width="6" height="14" rx="1"></rect>
    <line x1="17" y1="4" x2="17" y2="8"></line>
    <line x1="17" y1="16" x2="17" y2="20"></line>
    <rect x="14" y="8" width="6" height="8" rx="1"></rect>
  </svg>`;

  const heikinAshiSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="9" y1="2" x2="9" y2="6"></line>
    <line x1="9" y1="18" x2="9" y2="22"></line>
    <rect x="6" y="6" width="6" height="12" rx="1"></rect>
    <line x1="17" y1="2" x2="17" y2="10"></line>
    <line x1="17" y1="14" x2="17" y2="22"></line>
    <rect x="14" y="10" width="6" height="4" rx="1"></rect>
  </svg>`;

  if (isHeikinAshi) {
    chartTypeToggleBtn.innerHTML = candlestickSvg;
    chartTypeToggleBtn.title = "Heikin-Ashi Mode (Click for Candlesticks)";
  } else {
    chartTypeToggleBtn.innerHTML = heikinAshiSvg;
    chartTypeToggleBtn.title = "Candlestick Mode (Click for Heikin-Ashi)";
  }
}

function initEventListeners() {
  const chartTypeToggleBtn = document.getElementById('chart-type-toggle');

  // Toggle Candlestick vs Heikin-Ashi mode
  if (chartTypeToggleBtn) {
    chartTypeToggleBtn.addEventListener('click', () => {
      isHeikinAshi = !isHeikinAshi;
      updateChartTypeBtnUI();
      
      // Preserve visible zoom level / range before rendering
      const currentRangeTop = chartTop ? chartTop.timeScale().getVisibleLogicalRange() : null;

      renderChartData(true);

      if (chartTop && currentRangeTop) {
        chartTop.timeScale().setVisibleLogicalRange(currentRangeTop);
      }
    });
  }



  const handleLevelToggle = (e) => {
    const input = e.target;
    const btn = input.closest('.toggle-btn');
    if (btn) btn.classList.toggle('active', input.checked);

    if (input.id === 'toggle-pw') showPW = input.checked;
    if (input.id === 'toggle-monday') showMonday = input.checked;
    if (input.id === 'toggle-pdhlm') showPDHLM = input.checked;
    if (input.id === 'toggle-asia-8-14') showAsia2 = input.checked;
    if (input.id === 'toggle-session-15-20') showSession15_20 = input.checked;
    if (input.id === 'toggle-asia-8-20') showAsia3 = input.checked;
    if (input.id === 'toggle-session-2000-0400') showSession2000_0400 = input.checked;
    
    // Pass the ID of the freshly toggled button so priceLines.js can check for exact overlaps
    if (input.checked) {
      updateAllPriceLines(input.id);
    } else {
      updateAllPriceLines();
    }
  };

  if (togglePWInput) togglePWInput.addEventListener('change', handleLevelToggle);
  if (toggleMondayInput) toggleMondayInput.addEventListener('change', handleLevelToggle);
  if (togglePDHLMInput) togglePDHLMInput.addEventListener('change', handleLevelToggle);
  if (toggleAsia8_14Input) toggleAsia8_14Input.addEventListener('change', handleLevelToggle);
  if (toggleSession15_20Input) toggleSession15_20Input.addEventListener('change', handleLevelToggle);
  if (toggleAsia8_20Input) toggleAsia8_20Input.addEventListener('change', handleLevelToggle);
  if (toggleSession2000_0400Input) toggleSession2000_0400Input.addEventListener('change', handleLevelToggle);

  if (toggle25_75Input) {
    toggle25_75Input.addEventListener('change', (e) => {
      showFibb = e.target.checked;
      updateAllPriceLines();
    });
  }

  if (toggleExtendInput) {
    toggleExtendInput.addEventListener('change', (e) => {
      showExtend = e.target.checked;
      updateAllPriceLines();
    });
  }

  if (toggleExtendFibbInput) {
    toggleExtendFibbInput.addEventListener('change', (e) => {
      showExtendFibb = e.target.checked;
      updateAllPriceLines();
    });
  }

  // Setup active pressed state sync for all button toggle labels
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    const input = btn.querySelector('input[type="checkbox"]');
    if (input) {
      btn.classList.toggle('active', input.checked);
      input.addEventListener('change', () => {
        btn.classList.toggle('active', input.checked);
      });
    }
  });

  toggleSessionInput.addEventListener('change', (e) => {
    showSession = e.target.checked;
    renderChartData();
    if (chartTop) chartTop.timeScale().fitContent();
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

  // Timezone Dropup Selection (UTC+8 vs UTC)
  if (timezoneSelect) {
    timezoneSelect.addEventListener('change', (e) => {
      selectedTimezone = e.target.value;
      // Re-apply options so lightweight charts re-evaluates tickMarkFormatter and timeFormatter
      if (chartTop) {
        chartTop.applyOptions(createChartOptions(document.getElementById('chart-container-top')));
      }
      renderChartData();
    });
  }

  initCalendarListeners();
  initPlaybackListeners();

  // Custom Context Menu Refresh Click & Global Dismiss
  const contextMenu = document.getElementById('custom-context-menu');
  const contextRefreshBtn = document.getElementById('context-refresh-btn');

  if (contextRefreshBtn) {
    contextRefreshBtn.addEventListener('click', async () => {
      if (contextMenu) contextMenu.classList.add('hidden');
      await fetchKlines(true);
    });
  }

  document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.classList.contains('hidden')) {
      if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
      }
    }
  });

  document.addEventListener('scroll', () => {
    if (contextMenu) contextMenu.classList.add('hidden');
  }, true);
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
  updateChartTypeBtnUI();
  fetchKlines();
  fetchEconomicEvents();
});
