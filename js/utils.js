// Helper: Calculate latest available weekday (skipping weekends, including today)
function getLatestPastWeekday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: Get 3-letter day name (e.g., "Mon", "Tue", "Wed")
function getDayName(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return days[dateObj.getUTCDay()];
}

// Helper: Step date forward or backward skipping weekends, up to today, and >= 2024-01-01
function getAdjacentWeekday(currentDateStr, step) {
  const [yyyy, mm, dd] = currentDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  
  const minDate = new Date(Date.UTC(2024, 0, 1));
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let count = 0;
  while (count < 10) {
    date.setUTCDate(date.getUTCDate() + step);
    const dayOfWeek = date.getUTCDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      if (date >= minDate && date <= today) {
        const resY = date.getUTCFullYear();
        const resM = String(date.getUTCMonth() + 1).padStart(2, '0');
        const resD = String(date.getUTCDate()).padStart(2, '0');
        return `${resY}-${resM}-${resD}`;
      } else {
        return null;
      }
    }
    count++;
  }
  return null;
}

// Helper: Check if date is in US Daylight Saving Time (2nd Sunday of March to 1st Sunday of November)
function isUSSummerTime(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  
  // 2nd Sunday in March
  const mar14 = new Date(Date.UTC(y, 2, 14));
  const usDstStart = new Date(Date.UTC(y, 2, 14 - ((mar14.getUTCDay() + 1) % 7)));
  
  // 1st Sunday in November
  const nov7 = new Date(Date.UTC(y, 10, 7));
  const usDstEnd = new Date(Date.UTC(y, 10, 7 - ((nov7.getUTCDay() + 1) % 7)));

  return dateObj >= usDstStart && dateObj < usDstEnd;
}

// Helper: Check if date is in UK Daylight Saving Time (Last Sunday of March to Last Sunday of October)
function isUKSummerTime(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));

  // Last Sunday in March
  const mar31 = new Date(Date.UTC(y, 2, 31));
  const ukDstStart = new Date(Date.UTC(y, 2, 31 - ((mar31.getUTCDay() + 1) % 7)));

  // Last Sunday in October
  const oct31 = new Date(Date.UTC(y, 9, 31));
  const ukDstEnd = new Date(Date.UTC(y, 9, 31 - ((oct31.getUTCDay() + 1) % 7)));

  return dateObj >= ukDstStart && dateObj < ukDstEnd;
}

// Helper: Check if two YYYY-MM-DD date strings fall in the same Friday-ending trading week
function isSameWeek(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return false;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const dateObj1 = new Date(Date.UTC(y1, m1 - 1, d1));
  const dayOfWeek1 = dateObj1.getUTCDay();
  const daysUntilFri1 = (5 - dayOfWeek1 + 7) % 7;
  const friTime1 = Date.UTC(y1, m1 - 1, d1) + (daysUntilFri1 * 86400000);

  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const dateObj2 = new Date(Date.UTC(y2, m2 - 1, d2));
  const dayOfWeek2 = dateObj2.getUTCDay();
  const daysUntilFri2 = (5 - dayOfWeek2 + 7) % 7;
  const friTime2 = Date.UTC(y2, m2 - 1, d2) + (daysUntilFri2 * 86400000);

  return friTime1 === friTime2;
}

// Helper: Get previous weekday date string (e.g., Monday's previous weekday is Friday)
function getPreviousWeekdayDateStr(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));

  date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  const resY = date.getUTCFullYear();
  const resM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(date.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

// EMA Calculation Function across entire historical window
function calculateEMA(data, period) {
  const emaData = [];
  const k = 2 / (period + 1);
  let prevEma = null;

  for (let i = 0; i < data.length; i++) {
    const close = data[i].close;
    if (i < period - 1) {
      continue;
    }
    if (prevEma === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      prevEma = sum / period;
    } else {
      prevEma = close * k + prevEma * (1 - k);
    }
    emaData.push({ time: data[i].time, value: prevEma });
  }
  return emaData;
}

// Helper: Extract numeric UTC offset hours from string (e.g., "UTC+8" -> 8, "UTC-5" -> -5, "UTC" -> 0)
function getTimezoneOffsetHours(tzStr) {
  if (!tzStr || tzStr === 'UTC') return 0;
  const match = tzStr.match(/UTC([+-]\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Format timestamp into "Tue 8 Sep 2026 13:07" style based on selectedTimezone (used for crosshair hover tooltip)
 */
function formatFullDateTime(timestamp, tzStr) {
  const offsetHours = getTimezoneOffsetHours(tzStr);
  const date = new Date((timestamp + (offsetHours * 3600)) * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const dayName = days[date.getUTCDay()];
  const dayOfMonth = date.getUTCDate();
  const monthName = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${dayName} ${dayOfMonth} ${monthName} ${hours}:${minutes}`;
}

/**
 * Format timestamp into concise time string "HH:mm" (or "DD Sep HH:mm" for day boundaries) for standard clean axis ticks
 */
function formatTimeOnly(timestamp, tzStr) {
  const offsetHours = getTimezoneOffsetHours(tzStr);
  const date = new Date((timestamp + (offsetHours * 3600)) * 1000);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  // If 00:00 start of day tick mark, display day/month short code (e.g. 13 Sep)
  if (hours === '00' && minutes === '00') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayOfMonth = date.getUTCDate();
    const monthName = months[date.getUTCMonth()];
    return `${dayOfMonth} ${monthName}`;
  }

  return `${hours}:${minutes}`;
}

/**
 * Heikin-Ashi Candle Conversion
 */
function convertToHeikinAshi(data) {
  if (!data || data.length === 0) return [];
  const haData = [];

  for (let i = 0; i < data.length; i++) {
    const curr = data[i];
    const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
    let haOpen;

    if (i === 0) {
      haOpen = (curr.open + curr.close) / 2;
    } else {
      const prevHa = haData[i - 1];
      haOpen = (prevHa.open + prevHa.close) / 2;
    }

    const haHigh = Math.max(curr.high, haOpen, haClose);
    const haLow = Math.min(curr.low, haOpen, haClose);

    haData.push({
      time: curr.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });
  }

  return haData;
}
