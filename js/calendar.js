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
  today.setHours(0,0,0,0);
  const minBoundDate = new Date(Date.UTC(2024, 0, 1));

  for (let i = 0; i < firstDayOfMonth; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell empty';
    calDaysGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'cal-day-cell';
    dayCell.textContent = day;

    const dateObj = new Date(currentCalYear, currentCalMonth, day);
    const dayOfWeek = dateObj.getDay();

    const dateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (dayOfWeek === 0 || dayOfWeek === 6 || dateObj >= today || dateObj < minBoundDate) {
      dayCell.classList.add('disabled');
      dayCell.setAttribute('title', 'Weekends, future dates, and dates before 2024-01-01 cannot be selected');
    } else {
      if (dateStr === selectedDate) {
        dayCell.classList.add('selected');
      }
      dayCell.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedDate(dateStr);
        calendarModal.classList.add('hidden');
        fetchKlines();
      });
    }

    calDaysGrid.appendChild(dayCell);
  }

  calPrevBtn.disabled = (currentCalYear === 2024 && currentCalMonth === 0);
  calNextBtn.disabled = (currentCalYear === today.getFullYear() && currentCalMonth === today.getMonth());
}

function setSelectedDate(dateStr) {
  selectedDate = dateStr;
  dateDisplayText.textContent = selectedDate;
  dateDaynameText.textContent = getDayName(selectedDate);
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
      setSelectedDate(prevDate);
      fetchKlines();
    }
  });

  dateNextBtn.addEventListener('click', () => {
    const nextDate = getAdjacentWeekday(selectedDate, 1);
    if (nextDate) {
      setSelectedDate(nextDate);
      fetchKlines();
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
