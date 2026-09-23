import { state, store } from '../core/state';

export interface RemotePeer {
  id: string;
  /** interpolated ndc */
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  last: number;
  hue: number;
}

/**
 * Optional shared‑pointer layer. Connects only when a realtime URL is configured
 * (VITE_REALTIME_URL or ?realtime=wss://…); otherwise stays silent.
 */
export class Multiuser {
  readonly peers = new Map<string, RemotePeer>();
  private ws: WebSocket | null = null;
  private lastSend = 0;
  private lastX = 99;
  private lastY = 99;
  private retry = 0;
  private url: string | null;

  constructor() {
    const q = new URLSearchParams(location.search).get('realtime');
    this.url = q || (import.meta.env.VITE_REALTIME_URL as string | undefined) || null;
    if (this.url) this.connect();
  }

  private connect() {
    if (!this.url) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      return;
    }
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => (this.retry = 0);
    this.ws.onmessage = (e) => {
      let msg: { t: string; id: string; x?: number; y?: number; v?: number; n?: number };
      try {
        msg = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data));
      } catch {
        return;
      }
      if (msg.t === 'p' && typeof msg.x === 'number' && typeof msg.y === 'number') {
        let p = this.peers.get(msg.id);
        if (!p) {
          if (this.peers.size >= 8) return; // cap visible remote trails
          p = { id: msg.id, x: msg.x, y: msg.y, tx: msg.x, ty: msg.y, speed: 0, last: 0, hue: Math.random() };
          this.peers.set(msg.id, p);
        }
        p.tx = Math.max(-1, Math.min(1, msg.x));
        p.ty = Math.max(-1, Math.min(1, msg.y));
        p.speed = msg.v ?? 0;
        p.last = performance.now();
      } else if (msg.t === 'leave') this.peers.delete(msg.id);
      else if (msg.t === 'count') store.set({ multiuserPeers: Math.max(0, (msg.n ?? 1) - 1) });
    };
    this.ws.onclose = () => {
      this.ws = null;
      this.peers.clear();
      store.set({ multiuserPeers: 0 });
      if (this.retry < 5) setTimeout(() => this.connect(), 1000 * 2 ** this.retry++);
    };
    this.ws.onerror = () => this.ws?.close();
  }

  update(dt: number) {
    const now = performance.now();
    // throttle to ~20 Hz and only when the pointer actually moved
    const p = state.pointer;
    if (this.ws && this.ws.readyState === 1 && now - this.lastSend > 50 && p.active) {
      if (Math.abs(p.x - this.lastX) + Math.abs(p.y - this.lastY) > 0.002) {
        this.ws.send(JSON.stringify({ t: 'p', x: +p.x.toFixed(4), y: +p.y.toFixed(4), v: +p.speed.toFixed(2) }));
        this.lastSend = now;
        this.lastX = p.x;
        this.lastY = p.y;
      }
    }
    // interpolate peers toward their latest sample (hides 50 ms send interval + jitter)
    const k = 1 - Math.exp(-14 * dt);
    for (const [id, peer] of this.peers) {
      peer.x += (peer.tx - peer.x) * k;
      peer.y += (peer.ty - peer.y) * k;
      if (now - peer.last > 4000) this.peers.delete(id);
    }
  }
}
