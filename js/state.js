// State Variables for Single Chart Layout
let chartTop = null;
let seriesTop = null;        // Chart Candlestick Series

let ema10Top = null, ema20Top = null, ema50Top = null, ema200Top = null;
let vwapSeries = null;       // VWAP Line Series

// Overlay HTML5 canvas context for chart
let canvasTop = null, ctxTop = null;

// Price Lines Array for Prev 1D & Asia High/Low Levels & Extend Levels
let priceLinesTop = [];
let activePriceLines = [];

let ws = null;

let currentSymbol = 'BTCUSDT';
let currentInterval = '15m';
let selectedDate = getLatestPastWeekday();
let rawKlineData = [];

// Candle Mode (false = Raw Candlesticks, true = Heikin Ashi)
let isHeikinAshi = true;



// Day Display Range Mode ('1D', '2D', '3D', '1W')
let daysMode = '1W';

// Display Timezone Offset ('UTC+8' or 'UTC')
let selectedTimezone = 'UTC+8';

// Level Toggles State
let showPW = true;
let showMonday = false;
let showPDHLM = true;
let showFibb = false;
let showAsia2 = false;
let showSession15_20 = false;
let showAsia3 = false;
let showSession2000_0400 = false;
let showExtend = false;
let showExtendFibb = false;
let showSession = false;

// Calendar Modal State
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

// DOM Elements
const dateDisplayText = document.getElementById('date-display-text');
const dateDaynameText = document.getElementById('date-dayname-text');
const dateBoxWrapper = document.getElementById('date-box-wrapper');
const datePrevBtn = document.getElementById('date-prev-day');
const dateNextBtn = document.getElementById('date-next-day');

const calendarModal = document.getElementById('calendar-modal');
const calTitle = document.getElementById('cal-month-year-title');
const calDaysGrid = document.getElementById('cal-days-grid');
const calPrevBtn = document.getElementById('cal-prev-month');
const calNextBtn = document.getElementById('cal-next-month');

const timeframeGroup = document.getElementById('timeframe-group');
const loadingOverlay = document.getElementById('loading-overlay');

const timezoneSelect = document.getElementById('timezone-select');

// Checkbox Toggles
const togglePWInput = document.getElementById('toggle-pw');
const toggleMondayInput = document.getElementById('toggle-monday');
const togglePDHLMInput = document.getElementById('toggle-pdhlm');
const toggle25_75Input = document.getElementById('toggle-25-75');
const toggleAsia8_14Input = document.getElementById('toggle-asia-8-14');
const toggleSession15_20Input = document.getElementById('toggle-session-15-20');
const toggleAsia8_20Input = document.getElementById('toggle-asia-8-20');
const toggleSession2000_0400Input = document.getElementById('toggle-session-2000-0400');
const toggleExtendInput = document.getElementById('toggle-extend');
const toggleExtendFibbInput = document.getElementById('toggle-extend-fibb');
const toggleSessionInput = document.getElementById('toggle-session');


const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
