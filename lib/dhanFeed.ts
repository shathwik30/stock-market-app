import WebSocket from 'ws';
import { getScripMaster, ScripInfo } from './scripMaster';

// Subscription mode
const QUOTE_MODE = 17;

export interface LiveQuote {
  securityId: number;
  exchangeSegment: number;
  ltp: number;
  ltq: number;
  ltt: string;
  atp: number;
  volume: number;
  totalSellQty: number;
  totalBuyQty: number;
  open: number;
  close: number;
  high: number;
  low: number;
  prevClose: number;
  netChange: number;
  percentChange: number;
  companyName: string;
  symbol: string;
}

type Listener = (quotes: Map<number, LiveQuote>) => void;

class DhanFeedManager {
  private ws: WebSocket | null = null;
  private quotes = new Map<number, LiveQuote>();
  private prevCloses = new Map<number, number>();
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private securityIdToScrip = new Map<number, ScripInfo>();
  private scrips: ScripInfo[] = [];
  private scripsLoaded = false;

  constructor(
    private clientId: string,
    private accessToken: string,
    private exchange: 'NSE' | 'BSE' = 'NSE',
  ) {}

  private async loadScrips() {
    if (this.scripsLoaded) return;
    try {
      const master = await getScripMaster();
      this.scrips = this.exchange === 'BSE' ? master.bse : master.nse;
      this.securityIdToScrip.clear();
      for (const s of this.scrips) {
        this.securityIdToScrip.set(Number(s.securityId), s);
      }
      this.scripsLoaded = true;
      console.log(`[DhanFeed] Loaded ${this.scrips.length} scrips for ${this.exchange}`);
    } catch (err) {
      console.error('[DhanFeed] Failed to load scrips:', err);
    }
  }

  getQuotes(): Map<number, LiveQuote> {
    return this.quotes;
  }

  addListener(fn: Listener) {
    this.listeners.add(fn);
  }

  removeListener(fn: Listener) {
    this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      try { fn(this.quotes); } catch { /* ignore */ }
    }
  }

  private subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const segment = this.exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ';
    const instruments = this.scrips.map((s) => ({
      ExchangeSegment: segment,
      SecurityId: s.securityId,
    }));

    // Send in batches of 100 (Dhan limit)
    for (let i = 0; i < instruments.length; i += 100) {
      const batch = instruments.slice(i, i + 100);
      const msg = JSON.stringify({
        RequestCode: QUOTE_MODE,
        InstrumentCount: batch.length,
        InstrumentList: batch,
      });
      this.ws.send(msg);
    }
    console.log(`[DhanFeed] Subscribed to ${instruments.length} instruments (Quote mode)`);
  }

  private processQuotePacket(data: Buffer) {
    if (data.length < 50) return;
    const securityId = data.readUInt32LE(4);
    const ltp = Number(data.readFloatLE(8).toFixed(2));
    const ltq = data.readUInt16LE(12);
    const ltt = new Date(data.readUInt32LE(14) * 1000).toISOString();
    const atp = Number(data.readFloatLE(18).toFixed(2));
    const volume = data.readUInt32LE(22);
    const totalSellQty = data.readUInt32LE(26);
    const totalBuyQty = data.readUInt32LE(30);
    const open = Number(data.readFloatLE(34).toFixed(2));
    const close = Number(data.readFloatLE(38).toFixed(2));
    const high = Number(data.readFloatLE(42).toFixed(2));
    const low = Number(data.readFloatLE(46).toFixed(2));

    const prevClose = this.prevCloses.get(securityId) || close;
    const scrip = this.securityIdToScrip.get(securityId);

    this.quotes.set(securityId, {
      securityId,
      exchangeSegment: this.exchange === 'BSE' ? 4 : 1,
      ltp, ltq, ltt, atp, volume, totalSellQty, totalBuyQty,
      open, close, high, low,
      prevClose,
      netChange: Number((ltp - prevClose).toFixed(2)),
      percentChange: prevClose ? Number((((ltp - prevClose) / prevClose) * 100).toFixed(2)) : 0,
      companyName: scrip?.customName || `ID:${securityId}`,
      symbol: scrip?.tradingSymbol || '',
    });
  }

  private processTickerPacket(data: Buffer) {
    if (data.length < 16) return;
    const securityId = data.readUInt32LE(4);
    const ltp = Number(data.readFloatLE(8).toFixed(2));
    const existing = this.quotes.get(securityId);
    if (existing) {
      existing.ltp = ltp;
      existing.netChange = Number((ltp - existing.prevClose).toFixed(2));
      existing.percentChange = existing.prevClose
        ? Number((((ltp - existing.prevClose) / existing.prevClose) * 100).toFixed(2))
        : 0;
    }
  }

  private processPrevClosePacket(data: Buffer) {
    if (data.length < 16) return;
    const securityId = data.readUInt32LE(4);
    const prevClosePrice = Number(data.readFloatLE(8).toFixed(2));
    this.prevCloses.set(securityId, prevClosePrice);
    const existing = this.quotes.get(securityId);
    if (existing) {
      existing.prevClose = prevClosePrice;
      existing.netChange = Number((existing.ltp - prevClosePrice).toFixed(2));
      existing.percentChange = prevClosePrice
        ? Number((((existing.ltp - prevClosePrice) / prevClosePrice) * 100).toFixed(2))
        : 0;
    }
  }

  private processServerDisconnect(data: Buffer) {
    const errorCode = data.readUInt16LE(8);
    const msgs: Record<number, string> = {
      805: 'Connection limit exceeded',
      806: 'Data APIs not subscribed',
      807: 'Access token expired',
      808: 'Auth failed',
      809: 'Token invalid',
    };
    console.error(`[DhanFeed] Server disconnect: ${msgs[errorCode] || `Code ${errorCode}`}`);
  }

  private handleMessage(raw: Buffer | ArrayBuffer | Buffer[]) {
    const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    const code = data.readUInt8(0);
    switch (code) {
      case 2: this.processTickerPacket(data); break;
      case 4: this.processQuotePacket(data); break;
      case 6: this.processPrevClosePacket(data); break;
      case 7: console.log('[DhanFeed] Market status update'); break;
      case 50: this.processServerDisconnect(data); return;
    }
    this.notify();
  }

  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (!this.accessToken || !this.clientId) {
      console.error('[DhanFeed] Missing accessToken or clientId');
      return;
    }

    // Load scrips before connecting
    await this.loadScrips();

    const url = `wss://api-feed.dhan.co?version=2&token=${this.accessToken}&clientId=${this.clientId}&authType=2`;
    console.log('[DhanFeed] Connecting...');
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('[DhanFeed] Connected');
      this.connected = true;
      this.subscribeAll();
    });

    this.ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (err) => {
      console.error('[DhanFeed] Error:', err.message);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[DhanFeed] Closed: ${code} ${reason?.toString()}`);
      this.connected = false;
      this.ws = null;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton via globalThis for Next.js HMR safety
const g = globalThis as typeof globalThis & { __dhanFeed?: DhanFeedManager };

export function getDhanFeedManager(): DhanFeedManager {
  if (!g.__dhanFeed) {
    const accessToken = process.env.DHAN_ACCESS_TOKEN || '';
    const clientId = process.env.DHAN_CLIENT_ID || '';
    g.__dhanFeed = new DhanFeedManager(clientId, accessToken);
    g.__dhanFeed.connect();
  }
  return g.__dhanFeed;
}
