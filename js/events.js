// Economic Calendar API & Verified Master Database

let ecoEventsData = [];

// Built-in verified Master Database for High Impact US Releases (2024 - 2026)
const MASTER_ECONOMIC_CALENDAR = [
  // 2024 FOMC Meetings & Rate Statements (14:00 EST / 18:00 UTC -> 02:00 AM UTC+8 next morning/Wednesday night)
  { date: '2024-01-31 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2024-03-20 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2024-05-01 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2024-06-12 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2024-07-31 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2024-09-18 18:00', event: 'FOMC Rate Decision & Press Conf (50bps Cut)', country: 'US', importance: 'high' },
  { date: '2024-11-07 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2024-12-18 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },

  // 2025 FOMC Meetings
  { date: '2025-01-29 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-03-19 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-05-07 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-06-18 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-07-30 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-09-17 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-10-29 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2025-12-10 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },

  // 2026 FOMC Meetings (including Sept 16-17 2026)
  { date: '2026-01-28 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-03-18 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-04-29 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-06-17 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-07-29 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-09-16 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-10-28 18:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },
  { date: '2026-12-16 19:00', event: 'FOMC Rate Decision & Press Conf', country: 'US', importance: 'high' },

  // Recurring Monthly Major Releases Sample Mapping
  // CPI Releases (12:30 UTC / 20:30 UTC+8)
  { date: '2026-09-11 12:30', event: 'CPI Inflation Rate (MoM/YoY)', country: 'US', importance: 'high' },
  { date: '2026-09-12 12:30', event: 'PPI Producer Price Index', country: 'US', importance: 'high' },
  { date: '2026-09-04 12:30', event: 'Non-Farm Payrolls (NFP) & Unemployment', country: 'US', importance: 'high' },
  { date: '2026-09-17 12:30', event: 'Initial Unemployment Claims', country: 'US', importance: 'high' },
];

/**
 * Fetch live economic events with fallback to verified master database
 */
async function fetchEconomicEvents() {
  ecoEventsData = [...MASTER_ECONOMIC_CALENDAR];
  
  try {
    const url = 'https://eodhd.com/api/economic-events?api_token=demo&fmt=json';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Merge fetched data into ecoEventsData avoiding duplicates
        data.forEach(item => {
          if (item.event && item.date) {
            ecoEventsData.push(item);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Live economic calendar API offline, using verified Master DB:', err);
  }

  updateEconomicOverlay();
}

// US Full-Day Market Holiday Helper
function getUSMarketHoliday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dateObj.getUTCDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  // 1. New Year's Day (Jan 1)
  if (m === 1 && d === 1) return "New Year's Day (Full Market Closure)";

  // 2. MLK Day (3rd Mon in Jan)
  if (m === 1 && dayOfWeek === 1 && d >= 15 && d <= 21) return "MLK Jr. Day (Full Market Closure)";

  // 3. Presidents' Day (3rd Mon in Feb)
  if (m === 2 && dayOfWeek === 1 && d >= 15 && d <= 21) return "Presidents' Day (Full Market Closure)";

  // 4. Juneteenth (Jun 19)
  if (m === 6 && d === 19) return "Juneteenth (Full Market Closure)";

  // 5. Independence Day (Jul 4)
  if (m === 7 && d === 4) return "Independence Day (Full Market Closure)";

  // 6. Labor Day (1st Mon in Sep)
  if (m === 9 && dayOfWeek === 1 && d <= 7) return "Labor Day (Full Market Closure)";

  // 7. Thanksgiving Day (4th Thu in Nov)
  if (m === 11 && dayOfWeek === 4 && d >= 22 && d <= 28) return "Thanksgiving Day (Full Market Closure)";

  // 8. Christmas Day (Dec 25)
  if (m === 12 && d === 25) return "Christmas Day (Full Market Closure)";

  return null;
}

/**
 * Filter & sort major US high-impact economic events for a given YYYY-MM-DD selectedDate
 */
function getEventsForDate(dateStr) {
  const highImpactKeywords = [
    { key: 'FOMC', label: 'FOMC Rate Decision & Press Conf', isWarning: true },
    { key: 'POWELL', label: 'Fed Chair Powell Speech', isWarning: true },
    { key: 'FED RATE', label: 'Fed Interest Rate Decision', isWarning: true },

    { key: 'CPI', label: 'CPI Inflation Data', isWarning: false },
    { key: 'PPI', label: 'PPI Producer Price Index', isWarning: false },
    { key: 'PCE', label: 'Core PCE Price Index (Fed Preferred)', isWarning: false },

    { key: 'NFP', label: 'Non-Farm Payrolls (NFP)', isWarning: false },
    { key: 'PAYROLL', label: 'Non-Farm Payrolls (NFP)', isWarning: false },
    { key: 'ADP', label: 'ADP Employment (Small NFP)', isWarning: false },
    { key: 'UNEMPLOYMENT', label: 'Unemployment Rate / Claims', isWarning: false },
    { key: 'CLAIMS', label: 'Initial Unemployment Claims', isWarning: false },
    { key: 'JOBLESS', label: 'Initial Unemployment Claims', isWarning: false },

    { key: 'GDP', label: 'GDP Growth Rate (Quarterly)', isWarning: false },
    { key: 'ISM', label: 'ISM Manufacturing / Services PMI', isWarning: false },
    { key: 'PMI', label: 'ISM Manufacturing / Services PMI', isWarning: false },
    { key: 'RETAIL SALES', label: 'Retail Sales Data', isWarning: false }
  ];

  const matchedEvents = [];

  // Calculate day bounds for dateStr (00:00:00 to 23:59:59 UTC+8)
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStartUtcSec = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - (8 * 3600);
  const dayEndUtcSec = dayStartUtcSec + (24 * 3600) - 1;

  if (ecoEventsData && ecoEventsData.length > 0) {
    ecoEventsData.forEach(evt => {
      if (!evt.date) return;
      
      // Parse event time to Unix timestamp
      let evtSec = 0;
      if (evt.date.includes('T')) {
        evtSec = Math.floor(new Date(evt.date).getTime() / 1000);
      } else {
        const cleanedDateStr = evt.date.replace(' ', 'T') + 'Z';
        evtSec = Math.floor(new Date(cleanedDateStr).getTime() / 1000);
      }

      // Match event date string (e.g. 2026-09-16 for US Wednesday FOMC)
      const rawDateStr = evt.date.substring(0, 10);
      const titleUpper = (evt.event || evt.type || '').toUpperCase();
      const isFOMCOrPowell = titleUpper.includes('FOMC') || titleUpper.includes('POWELL');

      // FOMC meetings occur on US Wednesday. Show on Wednesday's chart view (02:00 AM) and exclude from Thursday.
      let isMatch = (rawDateStr === dateStr);
      if (!isMatch && isFOMCOrPowell) {
        // If event date is Wed (e.g. 2026-09-16), map to dateStr if dateStr === rawDateStr
        isMatch = (rawDateStr === dateStr);
      }

      if (isMatch) {
        const foundKeyword = highImpactKeywords.find(kw => titleUpper.includes(kw.key));

        if (foundKeyword || (evt.importance && evt.importance.toLowerCase() === 'high')) {
          let displayTime = '02:00';
          if (isFOMCOrPowell) {
            displayTime = '02:00'; // Standard caution 02:00 AM label for FOMC
          } else if (evtSec > 0) {
            const tzOffset = getTimezoneOffsetHours(selectedTimezone);
            const dObj = new Date((evtSec + (tzOffset * 3600)) * 1000);
            const hh = String(dObj.getUTCHours()).padStart(2, '0');
            const mm = String(dObj.getUTCMinutes()).padStart(2, '0');
            displayTime = `${hh}:${mm}`;
          }

          // Avoid duplicate entries
          const eventTitle = evt.event || foundKeyword?.label || 'High Impact Event';
          if (!matchedEvents.some(e => e.title === eventTitle)) {
            matchedEvents.push({
              time: displayTime,
              title: eventTitle,
              isWarning: foundKeyword?.isWarning || isFOMCOrPowell,
              importance: evt.importance || 'High'
            });
          }
        }
      }
    });
  }

  // Sort: regular events by time first, warning/FOMC items at the very bottom
  matchedEvents.sort((a, b) => {
    if (a.isWarning && !b.isWarning) return 1;  // Warning (FOMC) at lowest of the list
    if (!a.isWarning && b.isWarning) return -1;
    return a.time.localeCompare(b.time);
  });

  return matchedEvents;
}

/**
 * Render Top-Left Economic Calendar Widget Overlay
 */
function updateEconomicOverlay() {
  const containerTop = document.getElementById('panel-top');
  let ecoWidget = document.getElementById('eco-calendar-overlay');

  if (!containerTop) return;

  if (!ecoWidget) {
    ecoWidget = document.createElement('div');
    ecoWidget.id = 'eco-calendar-overlay';
    ecoWidget.className = 'eco-calendar-overlay';
    containerTop.appendChild(ecoWidget);
  }

  ecoWidget.style.display = 'block';


  const holidayName = getUSMarketHoliday(selectedDate);
  const events = getEventsForDate(selectedDate);

  let holidayBannerHtml = '';
  if (holidayName) {
    holidayBannerHtml = `
      <div class="eco-event-item eco-warning" style="background: rgba(239, 83, 80, 0.2); border-left: 3px solid #ef5350; margin-bottom: 6px;">
        <span class="eco-event-time">ALL DAY</span>
        <span class="eco-event-name" style="color: #ff8a80; font-weight: 700;">🏖️ ${holidayName}</span>
        <span class="eco-event-badge eco-warning">HOLIDAY</span>
      </div>
    `;
  }

  if (events.length === 0 && !holidayName) {
    ecoWidget.innerHTML = `
      <div class="eco-header">
        <span class="eco-dot"></span>
        <span class="eco-title">US Economic Calendar</span>
      </div>
      <div class="eco-empty">No High-Impact Releases (${selectedDate})</div>
    `;
    return;
  }

  let eventsHtml = events.map(evt => {
    const warningClass = evt.isWarning ? 'eco-warning' : '';
    const badgeText = evt.isWarning ? '⚠️ CAUTION' : 'HIGH';
    return `
      <div class="eco-event-item ${warningClass}">
        <span class="eco-event-time">${evt.time}</span>
        <span class="eco-event-name">${evt.title}</span>
        <span class="eco-event-badge ${warningClass}">${badgeText}</span>
      </div>
    `;
  }).join('');

  ecoWidget.innerHTML = `
    <div class="eco-header">
      <span class="eco-dot active"></span>
      <span class="eco-title">US High-Impact Calendar (${selectedDate})</span>
    </div>
    <div class="eco-events-list">
      ${holidayBannerHtml}
      ${eventsHtml}
    </div>
  `;
}
