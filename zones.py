#!/usr/bin/python3

import pandas, requests, sys, os, shutil, argparse, re
from datetime import datetime, timedelta, timezone
from termcolor import colored
sys.dont_write_bytecode = True

# ==============================================================================
# GENERAL CONFIGURATION
# ==============================================================================
UTC_OFFSET = 8 # e.g., 8 for GMT+8 (Malaysia/Singapore), 4 for GMT+4 (Dubai)

# DISPLAY
MONDAY = True
PREV_DAY = True
ASIA_SESSION = True
LONDON_SESSION = False
SYDNEY_SESSION = False
MIDNIGHT_PRICE = True
CURRENT_PRICE  = False

# COLOR
titlecolor    = 'white'
symbolcolor   = 'cyan'
mondaycolor   = 'blue'
prevdaycolor  = 'white'
asiacolor     = 'red'
londoncolor   = 'green'
sydneycolor   = 'magenta'
midnightcolor = 'light_cyan'
currentpricecolor = 'light_cyan'

# Match ANSI escape sequences like "\x1b[31m" or with multiple params
# (e.g. "\x1b[1;32m"). This ensures visible_len correctly measures text width.
ANSI_RE = re.compile(r'\x1b\[[0-9;]*m')

# Initialize session for performance
TZ = timezone(timedelta(hours=UTC_OFFSET))
session = requests.Session()
HL_INFO_URL = "https://api.hyperliquid.xyz/info"
INTERVAL_MS = {"1m": 60_000, "1d": 86_400_000}

def to_exchange_symbol(symbol, hyper=False):
    s = symbol.upper()
    if hyper:
        for suffix in ("USDT", "USDC"):
            if s.endswith(suffix):
                return s[:-len(suffix)]
        return s
    if not s.endswith(("USDT", "USDC")):
        return f"{s}USDT"
    return s

def get_hl_klines(coin, interval, limit=100, startTime=None, endTime=None):
    if endTime is None:
        endTime = int(datetime.now(timezone.utc).timestamp() * 1000)
    if startTime is None:
        startTime = endTime - INTERVAL_MS.get(interval, 60_000) * limit
    payload = {
        "type": "candleSnapshot",
        "req": {"coin": coin, "interval": interval, "startTime": startTime, "endTime": endTime},
    }
    r = session.post(HL_INFO_URL, json=payload, timeout=5)
    r.raise_for_status()
    data = r.json()
    result = [[x["t"], float(x["o"]), float(x["h"]), float(x["l"]), float(x["c"]), float(x["v"])] for x in data]
    cols = ["timestamp", "open", "high", "low", "close", "volume"]
    df = pandas.DataFrame(result, columns=cols)
    if len(df) > limit:
        df = df.iloc[-limit:].reset_index(drop=True)
    return df

def get_klines(pair, interval, limit=100, startTime=None, endTime=None, hyper=False):
    if hyper:
        return get_hl_klines(pair, interval, limit=limit, startTime=startTime, endTime=endTime)
    url = "https://fapi.binance.com/fapi/v1/klines"
    params = {"symbol": pair, "interval": interval, "limit": limit}
    if startTime is not None:
        params["startTime"] = startTime
    if endTime is not None:
        params["endTime"] = endTime
    r = session.get(url, params=params, timeout=5)
    r.raise_for_status()
    data = r.json()
    # Extract timestamp, open, high, low, close, volume
    result = [[x[0], float(x[1]), float(x[2]), float(x[3]), float(x[4]), float(x[5])] for x in data]
    cols = ["timestamp", "open", "high", "low", "close", "volume"]
    df = pandas.DataFrame(result, columns=cols)
    return df

def format_price(price):
    if price is None: return "N/A"
    p = float(price)
    if p >= 10000: return f"{int(p)}"
    if p >= 1000: return f"{p:.1f}"
    if p >= 10: return f"{p:.2f}"
    # Return original string if it's a very small number or other
    return str(price).rstrip('0').rstrip('.') if '.' in str(price) else str(price)

def clear_pycache():
    for root, dirs, _ in os.walk('.'):
        if '__pycache__' in dirs:
            pycache_path = os.path.join(root, '__pycache__')
            try: shutil.rmtree(pycache_path)
            except: os._exit(0)

def get_session_levels(df, date, start_hour, end_hour):
    """Filters klines for a specific date and hour range (MYT)."""
    # Convert timestamp to Local Time if not already converted
    if 'dt' not in df.columns:
        df['dt'] = pandas.to_datetime(df['timestamp'], unit='ms', utc=True).dt.tz_convert(TZ)

    dt_hours = df['dt'].dt.hour + df['dt'].dt.minute / 60.0

    mask = (df['dt'].dt.date == date) & (dt_hours >= start_hour) & (dt_hours < end_hour)
    session_df = df[mask]

    if session_df.empty:
        return None, None

    return session_df['high'].max(), session_df['low'].min()

def visible_len(text):
    return len(ANSI_RE.sub('', text or ''))

def pad_line(text, width):
    return (text or '') + ' ' * max(0, width - visible_len(text or ''))

def print_horizontal(columns, col_width=32, gap='  '):
    max_rows = max(len(c) for c in columns)
    padded = [c + [''] * (max_rows - len(c)) for c in columns]
    for row in range(max_rows):
        print(gap.join(pad_line(padded[i][row], col_width) for i in range(len(padded))))

def format_header(SYMBOL, hyper=False):
    venue = "Hyperliquid" if hyper else "Binance Futures"
    return f"{colored(venue, titlecolor, attrs=['bold'])} {colored(SYMBOL, symbolcolor, attrs=['bold'])}"

def build_symbol_lines(SYMBOL, show_london=True, show_asia_mid=True, show_opens=True, show_header=True, show_time=True, spaced_layout=False, show_london_mid=True, history_date=None, hyper=False):
    active_levels = []
    lines = []

    if spaced_layout:
        lines.append("")

    if show_header:
        lines.append(format_header(SYMBOL, hyper=hyper))
        lines.append("")

    # 1. Previous 1D Levels & Monday Open
    if history_date is not None:
        dt_end = datetime.combine(history_date, datetime.max.time()).replace(tzinfo=TZ)
        end_ms = int(dt_end.timestamp() * 1000)
        start_ms = end_ms - INTERVAL_MS["1d"] * 10
        df_1d = get_klines(SYMBOL, "1d", limit=10, startTime=start_ms, endTime=end_ms, hyper=hyper)
    else:
        df_1d = get_klines(SYMBOL, "1d", limit=10, hyper=hyper)
    df_1d['dt'] = pandas.to_datetime(df_1d['timestamp'], unit='ms', utc=True)
    prev_1d = df_1d.iloc[-2]
    h1d, l1d = prev_1d['high'], prev_1d['low']
    active_levels.append(('Prev 1D High', h1d))
    active_levels.append(('Prev 1D Low', l1d))

    monday_candle = df_1d[df_1d['dt'].dt.weekday == 0]
    monday_open = monday_candle.iloc[-1]['open'] if not monday_candle.empty else None

    # 2. Fetch Data for Time & Session Logic
    if history_date is not None:
        dt_start = datetime.combine(history_date, datetime.min.time()).replace(tzinfo=TZ)
        start_ms = int(dt_start.timestamp() * 1000)
        dt_end = datetime.combine(history_date, datetime.max.time()).replace(tzinfo=TZ)
        end_ms = int(dt_end.timestamp() * 1000)
        df_1m = get_klines(SYMBOL, "1m", limit=1500, startTime=start_ms, endTime=end_ms, hyper=hyper)
    else:
        df_1m = get_klines(SYMBOL, "1m", limit=1500, hyper=hyper)
    df_1m['dt'] = pandas.to_datetime(df_1m['timestamp'], unit='ms', utc=True).dt.tz_convert(TZ)

    if history_date is not None:
        today = history_date
        now_local = datetime.combine(history_date, datetime.max.time()).replace(tzinfo=TZ)
    else:
        last_candle_ms = df_1m.iloc[-1]['timestamp']
        now_local = datetime.fromtimestamp(last_candle_ms / 1000.0, tz=timezone.utc).astimezone(TZ)
        today = now_local.date()

    # DST & Reset Logic
    # US DST: 2nd Sunday March to 1st Sunday November
    us_dst_start = datetime(today.year, 3, 14) - timedelta(days=(datetime(today.year, 3, 14).weekday() + 1) % 7)
    us_dst_end = datetime(today.year, 11, 7) - timedelta(days=(datetime(today.year, 11, 7).weekday() + 1) % 7)
    is_us_dst = us_dst_start.date() <= today < us_dst_end.date()
    us_shift = 0 if is_us_dst else 1

    # UK DST: Last Sunday March to Last Sunday October
    uk_dst_start = datetime(today.year, 3, 31) - timedelta(days=(datetime(today.year, 3, 31).weekday() + 1) % 7)
    uk_dst_end = datetime(today.year, 10, 31) - timedelta(days=(datetime(today.year, 10, 31).weekday() + 1) % 7)
    is_uk_dst = uk_dst_start.date() <= today < uk_dst_end.date()
    uk_shift = 0 if is_uk_dst else 1

    # AU DST: 1st Sunday October to 1st Sunday April (Southern Hemisphere)
    au_dst_end_date = (datetime(today.year, 4, 7) - timedelta(days=(datetime(today.year, 4, 7).weekday() + 1) % 7)).date()
    au_dst_start_date = (datetime(today.year, 10, 7) - timedelta(days=(datetime(today.year, 10, 7).weekday() + 1) % 7)).date()
    is_au_dst = today < au_dst_end_date or today >= au_dst_start_date
    au_shift = 0 if is_au_dst else 1

    if history_date is None:
        # Use US shift for the day reset (following NY Daily Close)
        reset_hour = 5 + us_shift
        if now_local.hour < reset_hour:
            today = (now_local - timedelta(days=1)).date()

    # Dynamic Sydney Session End
    syd_start = 4 + au_shift

    now_decimal = now_local.hour + now_local.minute / 60.0

    if syd_start <= now_decimal < 7.0:
        dyn_syd_end = float(now_local.hour + 1)
    elif 7.0 <= now_decimal < 7.5:
        dyn_syd_end = 7.5
    elif 7.5 <= now_decimal < 7.75:
        dyn_syd_end = 7.75
    else:
        dyn_syd_end = 7.75

    sh_dyn, sl_dyn = get_session_levels(df_1m, today, syd_start, dyn_syd_end)

    # Asia Session (08:00 - 12:00)
    ah_dyn, al_dyn = get_session_levels(df_1m, today, 8, 12)

    if MONDAY:
        if lines and lines[-1] != "": lines.append("")
        if today.weekday() in (0, 1): # Monday or Tuesday
            title_text = " Weekend Range "
            line = f"{title_text:=^30}"
            lines.append(colored(line, mondaycolor, attrs=['bold']))
            sat_candles = df_1d[df_1d['dt'].dt.weekday == 5]
            sun_candles = df_1d[df_1d['dt'].dt.weekday == 6]
            if sat_candles.empty or sun_candles.empty:
                lines.append(f"Weekend High : {colored('N/A', mondaycolor, attrs=['bold'])}")
                lines.append(f"Weekend Low  : {colored('N/A', mondaycolor, attrs=['bold'])}")
            else:
                sat_last = sat_candles.iloc[-1]
                sun_last = sun_candles.iloc[-1]
                weekend_high = max(sat_last['high'], sun_last['high'])
                weekend_low = min(sat_last['low'], sun_last['low'])
                lines.append(f"Weekend High : {colored(format_price(weekend_high), mondaycolor, attrs=['bold'])}")
                lines.append(f"Weekend Low  : {colored(format_price(weekend_low), mondaycolor, attrs=['bold'])}")
        else:
            title_text = " Monday Range "
            line = f"{title_text:=^30}"
            lines.append(colored(line, mondaycolor, attrs=['bold']))
            if monday_candle.empty:
                lines.append(f"Monday High : {colored('N/A', mondaycolor, attrs=['bold'])}")
                lines.append(f"Monday Open : {colored('N/A', mondaycolor, attrs=['bold'])}")
                lines.append(f"Monday Low  : {colored('N/A', mondaycolor, attrs=['bold'])}")
            else:
                monday_high = monday_candle.iloc[-1]['high']
                monday_low = monday_candle.iloc[-1]['low']
                active_levels.append(('Monday Open', monday_open))
                lines.append(f"Monday High : {colored(format_price(monday_high), mondaycolor, attrs=['bold'])}")
                lines.append(f"Monday Open : {colored(format_price(monday_open), mondaycolor, attrs=['bold'])}")
                lines.append(f"Monday Low  : {colored(format_price(monday_low), mondaycolor, attrs=['bold'])}")

    if PREV_DAY:
        if lines and lines[-1] != "": lines.append("")
        title_text = f" Prev 1D "
        line = f"{title_text:=^30}"
        lines.append(colored(line, prevdaycolor, attrs=['bold']))
        mid_1d = (h1d + l1d) / 2

        # Calculate H-M (High + Mid) / 2 with +1 adjustment if sum is odd integer
        sum_hm = h1d + mid_1d
        if float(sum_hm).is_integer() and int(sum_hm) % 2 != 0:
            sum_hm += 1
        hm_1d = sum_hm / 2

        # Calculate L-M (Low + Mid) / 2 with -1 adjustment if sum is odd integer
        sum_lm = l1d + mid_1d
        if float(sum_lm).is_integer() and int(sum_lm) % 2 != 0:
            sum_lm -= 1
        lm_1d = sum_lm / 2

        gap_1d = hm_1d - mid_1d

        lines.append(f"Prev 1D High : {colored(format_price(h1d), prevdaycolor, attrs=['bold'])}")
        lines.append(f"Prev 1D 75%  : {colored(format_price(hm_1d), prevdaycolor, attrs=['bold'])}")
        lines.append(f"Prev 1D Mid  : {colored(format_price(mid_1d), prevdaycolor, attrs=['bold'])}")
        lines.append(f"Prev 1D 25%  : {colored(format_price(lm_1d), prevdaycolor, attrs=['bold'])}")
        lines.append(f"Prev 1D Low  : {colored(format_price(l1d), prevdaycolor, attrs=['bold'])}")
        # Calculate gap using displayed level precision
        gap_1d = float(format_price(hm_1d)) - float(format_price(mid_1d))
        gap_val = round(abs(gap_1d), 4)
        if h1d >= 10000:
            gap_str = str(int(round(gap_val)))
        elif h1d >= 1000:
            gap_str = f"{gap_val:.1f}"
        elif h1d >= 10:
            gap_str = f"{gap_val:.2f}"
        else:
            gap_str = format_price(gap_val)
        lines.append(f"   Each Gap  :   {colored(gap_str, 'yellow', attrs=['bold'])}")

    if SYDNEY_SESSION:
        if lines and lines[-1] != "": lines.append("")

        def format_hhmm(decimal_hour):
            h = int(decimal_hour)
            m = int(round((decimal_hour - h) * 60))
            return f"{h:02d}{m:02d}"

        time_range = f"{format_hhmm(syd_start)}-{format_hhmm(dyn_syd_end)}"

        title_text = " Sydney Session "
        line = f"{title_text:=^30}"
        lines.append(colored(line, sydneycolor, attrs=['bold']))

        if sh_dyn is not None:
            active_levels.append(('Sydney High', sh_dyn))
            active_levels.append(('Sydney Low', sl_dyn))
            lines.append(f"{time_range} High : {colored(format_price(sh_dyn), sydneycolor, attrs=['bold'])}")
            lines.append(f"{time_range} Low  : {colored(format_price(sl_dyn), sydneycolor, attrs=['bold'])}")
        else:
            lines.append(f"{time_range} High : N/A")
            lines.append(f"{time_range} Low  : N/A")

    if ASIA_SESSION:
        if lines and lines[-1] != "": lines.append("")
        ah_start = 8
        asia_end = 12

        title_text = " Asia Session "
        line = f"{title_text:=^30}"
        lines.append(colored(line, asiacolor, attrs=['bold']))

        # Asia Session (0800-1200)
        time_range = f"{ah_start:02d}00-{asia_end:02d}00"
        if ah_dyn is not None:
            active_levels.append(('Asia High', ah_dyn))
            active_levels.append(('Asia Low', al_dyn))
            lines.append(f"{time_range} High : {colored(format_price(ah_dyn), asiacolor, attrs=['bold'])}")
            lines.append(f"{time_range} Low  : {colored(format_price(al_dyn), asiacolor, attrs=['bold'])}")
        else:
            lines.append(f"{time_range} High : N/A")
            lines.append(f"{time_range} Low  : N/A")

    if LONDON_SESSION and show_london:
        if lines and lines[-1] != "": lines.append("")
        lh_start = 14 + uk_shift

        start_time_london = datetime.combine(today, datetime.min.time()).replace(hour=lh_start, tzinfo=TZ)
        end_london = start_time_london + timedelta(hours=6)

        mask_london = (df_1m['dt'] >= start_time_london) & (df_1m['dt'] < end_london)

        time_range_london = f"{lh_start:02d}00-{lh_start+6:02d}00"

        title_text = " London Session "
        line = f"{title_text:=^30}"
        lines.append(colored(line, londoncolor, attrs=['bold']))

        df_london = df_1m[mask_london]
        if not df_london.empty:
            if now_local < end_london:
                lines.append(f"{time_range_london} High : N/A")
                lines.append(f"{time_range_london} Low  : N/A")
            else:
                lh, ll = df_london['high'].max(), df_london['low'].min()
                active_levels.append(('London High', lh))
                active_levels.append(('London Low', ll))
                lines.append(f"{time_range_london} High : {colored(format_price(lh), londoncolor, attrs=['bold'])}")
                lines.append(f"{time_range_london} Low  : {colored(format_price(ll), londoncolor, attrs=['bold'])}")
        else:
            lines.append(f"{time_range_london} High : N/A")
            lines.append(f"{time_range_london} Low  : N/A")

    if MIDNIGHT_PRICE:
        if lines and lines[-1] != "": lines.append("")
        midnight_hour = 12 + us_shift
        midnight_dt = datetime.combine(today, datetime.min.time()).replace(hour=midnight_hour, tzinfo=TZ)

        if now_local < midnight_dt:
            lines.append("Midnight Open: N/A")
        else:
            df_after = df_1m[df_1m['dt'] >= midnight_dt]
            if not df_after.empty:
                midnight_open = df_after.iloc[0]['open']
                lines.append(f"Midnight Open: {colored(format_price(midnight_open), midnightcolor, attrs=['bold'])}")
            else:
                lines.append("Midnight Open: N/A")

    if CURRENT_PRICE:
        if lines and lines[-1] != "": lines.append("")
        last_candle = df_1m.iloc[-1]
        cur_price = last_candle['close']
        cur_time = now_local.strftime("%H:%M")

        price_str = colored(format_price(cur_price), currentpricecolor, attrs=['bold'])
        if show_time:
            lines.append(f"Current At : {price_str} @ {cur_time}")
        else:
            lines.append(f"Current At : {price_str}")
    return lines

def print_symbol(SYMBOL, show_london=True, show_asia_mid=True, show_opens=True, history_date=None, hyper=False):
    for i, line in enumerate(build_symbol_lines(SYMBOL, show_london, show_asia_mid, show_opens, history_date=history_date, hyper=hyper)):
        print(f"\n{line}" if i == 0 else line)

def print_all_symbols(symbols, history_date=None, hyper=False):
    columns = [
        build_symbol_lines(
            sym,
            show_london=True,
            show_asia_mid=False,
            show_opens=True,
            show_header=False,
            show_time=False,
            spaced_layout=True,
            show_london_mid=False,
            history_date=history_date,
            hyper=hyper,
        )
        for sym in symbols
    ]
    col_width = max(max(visible_len(line) for line in col) for col in columns)
    col_width = max(col_width, 30)
    print_horizontal(columns, col_width=col_width, gap='      ')

def main():
    global PREV_DAY, ASIA_SESSION, LONDON_SESSION

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--all', '-all', '-a', dest='all', action='store_true')
    parser.add_argument('--symbol', '--pair', dest='symbol', default=None)
    parser.add_argument('--btc', '-btc', '--btcusdt', '-btcusdt', dest='btc', action='store_true')
    parser.add_argument('--eth', '-eth', '--ethusdt', '-ethusdt', dest='eth', action='store_true')
    parser.add_argument('--sol', '-sol', '--solusdt', '-solusdt', dest='sol', action='store_true')
    parser.add_argument('--usdc', '-usdc', '--btcusdc', '-btcusdc', dest='btcusdc', action='store_true')
    parser.add_argument('--ethusdc', '-ethusdc', dest='ethusdc', action='store_true')
    parser.add_argument('--solusdc', '-solusdc', dest='solusdc', action='store_true')
    parser.add_argument('--hyperliquid', '--hyper', '-hyper', '-hyperliquid', dest='hyper', action='store_true')
    parser.add_argument('--history', dest='history', action='store_true')
    parser.add_argument('--monday', '-mon', '--mon', dest='monday', action='store_true')
    parser.add_argument('--tuesday', '-tue', '--tue', dest='tuesday', action='store_true')
    parser.add_argument('--wednesday', '-wed', '--wed', dest='wednesday', action='store_true')
    parser.add_argument('--thursday', '-thu', '--thu', dest='thursday', action='store_true')
    parser.add_argument('--friday', '-fri', '--fri', dest='friday', action='store_true')
    args, _ = parser.parse_known_args()

    weekday_map = {
        'monday': 0,
        'tuesday': 1,
        'wednesday': 2,
        'thursday': 3,
        'friday': 4
    }

    selected_weekday = None
    for flag, wd in weekday_map.items():
        if getattr(args, flag, False):
            selected_weekday = wd
            break

    history_date = None
    if selected_weekday is not None:
        now_local = datetime.now(timezone.utc).astimezone(TZ)
        today_local = now_local.date()

        # DST & Reset Logic to match trading day
        us_dst_start = datetime(today_local.year, 3, 14) - timedelta(days=(datetime(today_local.year, 3, 14).weekday() + 1) % 7)
        us_dst_end = datetime(today_local.year, 11, 7) - timedelta(days=(datetime(today_local.year, 11, 7).weekday() + 1) % 7)
        is_us_dst = us_dst_start.date() <= today_local < us_dst_end.date()
        us_shift = 0 if is_us_dst else 1

        reset_hour = 5 + us_shift
        if now_local.hour < reset_hour:
            today_local = (now_local - timedelta(days=1)).date()

        diff = today_local.weekday() - selected_weekday
        if diff < 0:
            diff += 7
        history_date = today_local - timedelta(days=diff)
        print(f"History {history_date.strftime('%Y-%m-%d %A')}\n")
    elif args.history:
        try:
            val = input("[i] ENTER YYMMDD ").strip()
            history_date = datetime.strptime(val, "%y%m%d").date()
            print(f"History {history_date.strftime('%Y-%m-%d %A')}\n")
        except Exception as e:
            print(f"Invalid date format: {e}")
            clear_pycache()
            return

    try:
        hyper = args.hyper
        if args.all:
            symbols = ['BTC', 'ETH', 'SOL'] if hyper else ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
            print_all_symbols(symbols, history_date=history_date, hyper=hyper)
        else:
            if args.btcusdc: SYMBOL = 'BTCUSDC'
            elif args.ethusdc: SYMBOL = 'ETHUSDC'
            elif args.solusdc: SYMBOL = 'SOLUSDC'
            elif args.eth: SYMBOL = 'ETHUSDT'
            elif args.sol: SYMBOL = 'SOLUSDT'
            elif args.btc: SYMBOL = 'BTCUSDT'
            elif args.symbol: SYMBOL = args.symbol.upper()
            else: SYMBOL = 'BTCUSDT'
            SYMBOL = to_exchange_symbol(SYMBOL, hyper=hyper)
            print_symbol(SYMBOL, show_london=True, history_date=history_date, hyper=hyper)

    except KeyboardInterrupt: print("\n^C Aborted.")
    except Exception as e: print(f"Error: {e}")
    finally: clear_pycache()

if __name__ == "__main__":
    main()
