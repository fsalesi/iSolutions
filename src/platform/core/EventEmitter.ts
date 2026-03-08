// EventEmitter.ts — Base class for all platform objects

export class EventControl {
  private _cancelled = false;
  private _cancelMessage?: string;
  private _replacement: any = undefined;
  private _hasReplacement = false;
  private _handled = false;

  cancel(message?: string): void   { this._cancelled = true; this._cancelMessage = message; }
  replace(value: any): void        { this._replacement = value; this._hasReplacement = true; }
  handled(): void                  { this._handled = true; }

  get isCancelled(): boolean       { return this._cancelled; }
  get cancelMessage()              { return this._cancelMessage; }
  get hasReplacement(): boolean    { return this._hasReplacement; }
  get replacement(): any           { return this._replacement; }
  get isHandled(): boolean         { return this._handled; }
}

export type EventHandler = (...args: any[]) => void;

export class EventEmitter {
  private _handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): this {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event)!.push(handler);
    return this;
  }

  off(event: string, handler: EventHandler): this {
    const h = this._handlers.get(event);
    if (h) { const i = h.indexOf(handler); if (i !== -1) h.splice(i, 1); }
    return this;
  }

  offAll(event?: string): this {
    event ? this._handlers.delete(event) : this._handlers.clear();
    return this;
  }

  protected emit(event: string, ...args: any[]): void {
    this._handlers.get(event)?.forEach(h => h(...args));
  }

  protected emitBefore(event: string, ...args: any[]): EventControl {
    const control = new EventControl();
    const handlers = this._handlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(...args, control);
        if (control.isCancelled) break;
      }
    }
    return control;
  }
}
