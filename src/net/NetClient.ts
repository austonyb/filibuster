import { WS_PATH, type ClientMessage, type ServerMessage } from "../shared/protocol";

type Listener = (msg: ServerMessage) => void;

/** Browser-side WebSocket client for the senator bridge. */
export class NetClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private queue: ClientMessage[] = [];

  connect(): this {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}${WS_PATH}`);
    this.ws = ws;
    ws.onopen = () => {
      for (const m of this.queue) ws.send(JSON.stringify(m));
      this.queue = [];
    };
    ws.onmessage = (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.listeners.forEach((l) => l(msg));
    };
    return this;
  }

  onMessage(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg); // sent on open
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }
}
