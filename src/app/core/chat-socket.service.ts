import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';
import { ChatMessageResponse, ChatSide } from '../models/bipsy.models';

/** Marca que precede al token en la lista de subprotocolos. */
const BEARER_PROTOCOL = 'bipsy-bearer';

export interface ChatMessageEvent {
  type: 'message.created';
  conversationId: number;
  message: ChatMessageResponse;
}

export interface ChatReadEvent {
  type: 'conversation.read' | 'conversation.delivered';
  conversationId: number;
  side: ChatSide;
  at?: string;
}

/**
 * El socket acaba de (re)conectar.
 *
 * No es informativo: es la señal de que ha podido haber un hueco sin eventos y
 * de que hay que recargar lo que se esté mirando. Sin esto, una reconexión
 * silenciosa dejaría la pantalla desactualizada para siempre.
 */
export interface ChatConnectedEvent {
  type: 'socket.connected';
}

export type ChatEvent = ChatMessageEvent | ChatReadEvent | ChatConnectedEvent;

/**
 * Canal de eventos del chat en vivo. Port de `ChatSocket` (gipsi_api).
 *
 * Es de **solo lectura**: por aquí no se envía nada nunca. Enviar va por REST,
 * donde ya funcionan la autenticación, la validación y el límite por actor.
 * Consecuencia práctica: si el socket está caído, el chat SIGUE funcionando.
 * No hay un modo "roto"; hay un modo "sin actualización instantánea".
 *
 * **El token va en la lista de subprotocolos** (`bipsy-bearer`), porque la API
 * de WebSocket del navegador no deja poner cabeceras en el handshake. El
 * backend lo acepta ahí además de en `Authorization`, que es lo que siguen
 * mandando las apps.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);

  private readonly eventsSubject = new Subject<ChatEvent>();
  readonly events$ = this.eventsSubject.asObservable();

  private socket: WebSocket | null = null;
  private wantConnected = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  /** Espera creciente entre reintentos, con techo. */
  private backoffMs = 1000;
  private static readonly MIN_BACKOFF = 1000;
  private static readonly MAX_BACKOFF = 30_000;

  connect(): void {
    this.wantConnected = true;
    this.open();
  }

  disconnect(): void {
    this.wantConnected = false;
    this.clearTimer();
    // `onclose` se dispara igual, pero con `wantConnected` en false no
    // reintenta: es lo que distingue un cierre nuestro de una caída.
    this.socket?.close();
    this.socket = null;
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private open(): void {
    if (!this.wantConnected || this.socket) {
      return;
    }
    const token = this.tokens.accessToken;
    if (!token) {
      // Sin sesión no hay nada que escuchar. No se reintenta: será `connect()`
      // quien vuelva a llamar cuando el usuario entre.
      this.wantConnected = false;
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(`${this.wsBase}/ws/chat`, [BEARER_PROTOCOL, token]);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.backoffMs = ChatSocketService.MIN_BACKOFF;
      this.eventsSubject.next({ type: 'socket.connected' });
    };

    socket.onmessage = event => {
      const parsed = this.parse(event.data);
      if (parsed) {
        this.eventsSubject.next(parsed);
      }
    };

    // El caso típico es un access token caducado: el handshake responde 403.
    // No se refresca aquí a propósito — de eso ya se encarga `ApiService` en
    // la primera petición REST, y para entonces el siguiente reintento cogerá
    // el token nuevo.
    socket.onclose = () => this.onClosed();
    socket.onerror = () => this.onClosed();
  }

  private onClosed(): void {
    this.socket = null;
    if (this.wantConnected) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.clearTimer();
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, ChatSocketService.MAX_BACKOFF);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /** Un evento que no se entiende se ignora: será un backend más nuevo. */
  private parse(raw: unknown): ChatEvent | null {
    if (typeof raw !== 'string') {
      return null;
    }
    try {
      const data = JSON.parse(raw) as { type?: string };
      switch (data.type) {
        case 'message.created':
        case 'conversation.read':
        case 'conversation.delivered':
          return data as ChatEvent;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /** `http` → `ws`, `https` → `wss`, sobre la misma API que el resto. */
  private get wsBase(): string {
    return this.api.baseUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  }
}
