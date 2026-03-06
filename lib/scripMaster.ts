// Fetches and caches the Dhan scrip master CSV dynamically.
// Filters for equity stocks (segment E, instrument EQUITY, type ES).
// Cached in globalThis for 24 hours (HMR-safe).

const SCRIP_MASTER_URL = 'https://images.dhan.co/api-data/api-scrip-master.csv';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface ScripInfo {
  securityId: string;
  tradingSymbol: string;
  customName: string;   // Human-readable name from CSV
  exchange: 'NSE' | 'BSE';
  series: string;
  tickSize: number;
}

interface ScripCache {
  nse: ScripInfo[];
  bse: ScripInfo[];
  nseMap: Map<string, ScripInfo>;  // keyed by securityId
  bseMap: Map<string, ScripInfo>;
  timestamp: number;
}

const g = globalThis as typeof globalThis & { __scripCache?: ScripCache };

function parseLine(line: string): ScripInfo | null {
  // CSV columns:
  // 0: SEM_EXM_EXCH_ID, 1: SEM_SEGMENT, 2: SEM_SMST_SECURITY_ID,
  // 3: SEM_INSTRUMENT_NAME, 4: SEM_EXPIRY_CODE, 5: SEM_TRADING_SYMBOL,
  // 6: SEM_LOT_UNITS, 7: SEM_CUSTOM_SYMBOL, 8: SEM_EXPIRY_DATE,
  // 9: SEM_STRIKE_PRICE, 10: SEM_OPTION_TYPE, 11: SEM_TICK_SIZE,
  // 12: SEM_EXPIRY_FLAG, 13: SEM_EXCH_INSTRUMENT_TYPE, 14: SEM_SERIES,
  // 15: SM_SYMBOL_NAME
  const cols = line.split(',');
  if (cols.length < 16) return null;

  const exchange = cols[0];
  const segment = cols[1];
  const instrumentName = cols[3];
  const instrumentType = cols[13];
  const series = cols[14];

  // Only equity stocks: segment E, instrument EQUITY, type ES (equity stock)
  // NSE uses series EQ, BSE uses various (A, B, T, NT, NS, etc.)
  if (segment !== 'E' || instrumentName !== 'EQUITY' || instrumentType !== 'ES') return null;
  if (exchange !== 'NSE' && exchange !== 'BSE') return null;
  // For NSE, only take EQ series (regular equity)
  if (exchange === 'NSE' && series !== 'EQ') return null;

  return {
    securityId: cols[2],
    tradingSymbol: cols[5],
    customName: cols[7] || cols[15] || cols[5],
    exchange: exchange as 'NSE' | 'BSE',
    series,
    tickSize: parseFloat(cols[11]) || 1,
  };
}

async function fetchAndParse(): Promise<ScripCache> {
  console.log('[ScripMaster] Fetching scrip master CSV...');
  const res = await fetch(SCRIP_MASTER_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch scrip master: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.split('\n');

  const nse: ScripInfo[] = [];
  const bse: ScripInfo[] = [];
  const nseMap = new Map<string, ScripInfo>();
  const bseMap = new Map<string, ScripInfo>();

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const info = parseLine(line);
    if (!info) continue;

    if (info.exchange === 'NSE') {
      nse.push(info);
      nseMap.set(info.securityId, info);
    } else {
      bse.push(info);
      bseMap.set(info.securityId, info);
    }
  }

  console.log(`[ScripMaster] Loaded ${nse.length} NSE + ${bse.length} BSE equity stocks`);

  return { nse, bse, nseMap, bseMap, timestamp: Date.now() };
}

export async function getScripMaster(): Promise<ScripCache> {
  if (g.__scripCache && Date.now() - g.__scripCache.timestamp < CACHE_TTL) {
    return g.__scripCache;
  }
  const cache = await fetchAndParse();
  g.__scripCache = cache;
  return cache;
}
