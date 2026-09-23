/* Custom Weekday-Only Calendar Modal Logic (Min bound: 2024-01-01) */

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function renderCalendar() {
  calTitle.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  calDaysGrid.innerHTML = '';

  const firstDayOfMonth = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const minBoundDate = new Date(Date.UTC(2017, 7, 17)); // 2017-08-17 (Binance BTCUSDT inception)

  for (let i = 0; i < firstDayOfMonth; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell empty';
    calDaysGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'cal-day-cell';
    dayCell.textContent = day;

    const dateObj = new Date(currentCalYear, currentCalMonth, day, 0, 0, 0);
    const dayOfWeek = dateObj.getDay();

    const dateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (dayOfWeek === 0 || dayOfWeek === 6 || dateObj > today || dateObj < minBoundDate) {
      dayCell.classList.add('disabled');
      dayCell.setAttribute('title', 'Weekends, future dates, and dates before 2017-08-17 cannot be selected');
    } else {
      if (dateStr === selectedDate) {
        dayCell.classList.add('selected');
      }
      dayCell.addEventListener('click', (e) => {
        e.stopPropagation();
        calendarModal.classList.add('hidden');
        changeSelectedDate(dateStr);
      });
    }

    calDaysGrid.appendChild(dayCell);
  }

  calPrevBtn.disabled = (currentCalYear === 2017 && currentCalMonth === 7);
  calNextBtn.disabled = (currentCalYear === today.getFullYear() && currentCalMonth === today.getMonth());
}

function setSelectedDate(dateStr) {
  selectedDate = dateStr;
  dateDisplayText.textContent = selectedDate;
  dateDaynameText.textContent = getDayName(selectedDate);
}

function changeSelectedDate(dateStr) {
  if (!dateStr || dateStr === selectedDate) return;
  const oldDate = selectedDate;
  setSelectedDate(dateStr);

  if (typeof updateEconomicOverlay === 'function') {
    updateEconomicOverlay();
  }

  if (rawKlineData && rawKlineData.length > 0 && isSameWeek(oldDate, dateStr)) {
    if (showSession) {
      renderChartData();
    } else {
      updateAllPriceLines();
    }
    datePrevBtn.disabled = !getAdjacentWeekday(selectedDate, -1);
    dateNextBtn.disabled = !getAdjacentWeekday(selectedDate, 1);
  } else {
    fetchKlines();
  }
}

function initCalendarListeners() {
  dateBoxWrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    calendarModal.classList.toggle('hidden');
    if (!calendarModal.classList.contains('hidden')) {
      const parts = selectedDate.split('-');
      currentCalYear = parseInt(parts[0], 10);
      currentCalMonth = parseInt(parts[1], 10) - 1;
      renderCalendar();

      // Position fixed modal directly below the date box
      const rect = dateBoxWrapper.getBoundingClientRect();
      const modalW = 250;
      let posLeft = rect.left + (rect.width / 2) - (modalW / 2);
      // Clamp so it doesn't overflow the right edge
      if (posLeft + modalW > window.innerWidth - 8) {
        posLeft = window.innerWidth - modalW - 8;
      }
      if (posLeft < 8) posLeft = 8;

      calendarModal.style.top = `${rect.bottom + 6}px`;
      calendarModal.style.left = `${posLeft}px`;
    }
  });

  document.addEventListener('click', (e) => {
    if (!calendarModal.contains(e.target) && !dateBoxWrapper.contains(e.target)) {
      calendarModal.classList.add('hidden');
    }
  });

  // Stepper Buttons (< and >)
  datePrevBtn.addEventListener('click', () => {
    const prevDate = getAdjacentWeekday(selectedDate, -1);
    if (prevDate) {
      changeSelectedDate(prevDate);
    }
  });

  dateNextBtn.addEventListener('click', () => {
    const nextDate = getAdjacentWeekday(selectedDate, 1);
    if (nextDate) {
      changeSelectedDate(nextDate);
    }
  });

  calPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentCalYear === 2024 && currentCalMonth === 0) return;
    currentCalMonth--;
    if (currentCalMonth < 0) {
      currentCalMonth = 11;
      currentCalYear--;
    }
    renderCalendar();
  });

  calNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentCalMonth++;
    if (currentCalMonth > 11) {
      currentCalMonth = 0;
      currentCalYear++;
    }
    renderCalendar();
  });
}
