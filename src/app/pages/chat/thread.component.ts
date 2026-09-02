import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { ChatRepository } from '../../repositories/chat.repository';
import { ChatSocketService } from '../../core/chat-socket.service';
import { ChatMessageResponse, ConversationResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { parseLocal, relativeDate, time } from '../../shared/dates';
import { businessPath } from '../../shared/slug';

/**
 * Un hilo de chat. Port de `ChatThreadScreen`.
 *
 * Los mensajes nuevos llegan por el socket, igual que en las apps. El sondeo
 * se queda como **red de seguridad**: se enciende solo si el socket no está
 * conectado, y se para cuando la pestaña deja de estar visible. Sin socket el
 * chat sigue funcionando; lo que se pierde es la inmediatez.
 */
@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.css',
})
export class ChatThreadComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly chat = inject(ChatRepository);
  private readonly socket = inject(ChatSocketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  conversation?: ConversationResponse;
  messages: ChatMessageResponse[] = [];

  isLoading = true;
  sending = false;
  loadError: ApiError | null = null;
  sendError: string | null = null;
  draft = '';

  /** URLs de objeto creadas para los adjuntos, por id de mensaje. */
  readonly attachmentUrls = new Map<number, string>();

  /** La foto abierta a tamaño completo, si hay alguna. */
  lightbox: string | null = null;

  private conversationId = 0;
  private poll?: ReturnType<typeof setInterval>;
  private shouldScroll = true;
  private socketSub?: Subscription;
  private readonly onVisibility = () => this.syncPolling();

  async ngOnInit(): Promise<void> {
    this.conversationId = Number(this.route.snapshot.paramMap.get('id'));
    await this.load();

    // Conectar y desconectar lo gobierna la barra de navegación, que vive
    // toda la sesión: hacerlo aquí tiraría el socket cada vez que se sale de
    // un hilo, justo cuando el globo de no leídos lo necesita.
    this.socketSub = this.socket.events$.subscribe(event => {
      if (event.type === 'socket.connected') {
        // Una reconexión puede haber dejado un hueco sin eventos: se recarga
        // en vez de dar por bueno lo que hay en pantalla.
        void this.refreshQuietly();
        this.syncPolling();
        return;
      }
      if (event.conversationId !== this.conversationId) {
        return;
      }
      if (event.type === 'message.created') {
        this.appendFromSocket(event.message);
      }
    });

    document.addEventListener('visibilitychange', this.onVisibility);
    this.syncPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.socketSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibility);
    // Las URL de objeto viven hasta que se revocan: sin esto, cada hilo que se
    // abre deja sus adjuntos en memoria para el resto de la sesión.
    this.attachmentUrls.forEach(url => URL.revokeObjectURL(url));
    this.attachmentUrls.clear();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scroller) {
      this.scroller.nativeElement.scrollTop = this.scroller.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      const [conversation, history] = await Promise.all([
        this.chat.conversation(this.conversationId),
        this.chat.history(this.conversationId),
      ]);
      this.conversation = conversation;
      // El backend devuelve del más nuevo al más viejo; en pantalla va al revés.
      this.messages = [...history].reverse();
      this.shouldScroll = true;
      void this.chat.markRead(this.conversationId).catch(() => undefined);
    } catch (raw) {
      this.loadError = ApiError.from(raw);
    } finally {
      this.isLoading = false;
    }
  }

  get canWrite(): boolean {
    return this.conversation?.canWrite !== false;
  }

  async send(): Promise<void> {
    const body = this.draft.trim();
    if (!body || this.sending || !this.canWrite) {
      return;
    }

    // Burbuja optimista: el mensaje aparece al pulsar, no cuando conteste el
    // servidor. Si falla se marca y se ofrece reintentar.
    const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessageResponse = {
      id: -Date.now(),
      side: 'CUSTOMER',
      kind: 'TEXT',
      body,
      clientMessageId,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    this.messages = [...this.messages, optimistic];
    this.draft = '';
    this.shouldScroll = true;
    this.sending = true;
    this.sendError = null;

    try {
      const saved = await this.chat.send(this.conversationId, body, clientMessageId);
      this.messages = this.messages.map(m => (m.clientMessageId === clientMessageId ? saved : m));
    } catch (raw) {
      this.sendError = ApiError.from(raw).message;
      this.messages = this.messages.map(m =>
        m.clientMessageId === clientMessageId ? { ...m, pending: false, failed: true } : m,
      );
    } finally {
      this.sending = false;
    }
  }

  async sendFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.canWrite) {
      return;
    }
    this.sending = true;
    this.sendError = null;
    try {
      const saved = await this.chat.sendAttachment(
        this.conversationId,
        file,
        `web-${Date.now()}`,
      );
      this.messages = [...this.messages, saved];
      this.shouldScroll = true;
    } catch (raw) {
      this.sendError = ApiError.from(raw).message;
    } finally {
      this.sending = false;
    }
  }

  /** Los adjuntos exigen `Authorization`, así que se bajan y se cachean. */
  async loadAttachment(message: ChatMessageResponse): Promise<void> {
    if (!message.attachment || this.attachmentUrls.has(message.id)) {
      return;
    }
    try {
      const url = await this.chat.attachmentObjectUrl(this.conversationId, message.id);
      this.attachmentUrls.set(message.id, url);
    } catch {
      // Un adjunto que no baja no puede romper el hilo: se queda el nombre del
      // archivo, que ya dice qué es.
    }
  }

  /**
   * Abre la foto entera.
   *
   * En el hilo se ve recortada a 260 px de alto: a tamaño natural, una foto de
   * móvil ocupaba dos pantallas y había que desplazarse para leer el mensaje
   * siguiente. Aquí se ve completa.
   */
  openImage(message: ChatMessageResponse): void {
    const url = this.attachmentUrls.get(message.id);
    if (url) {
      this.lightbox = url;
    }
  }

  isMine(message: ChatMessageResponse): boolean {
    return message.side === 'CUSTOMER';
  }

  stamp(message: ChatMessageResponse): string {
    return time(parseLocal(message.createdAt));
  }

  /** Separador de día, como en cualquier chat. */
  daySeparator(index: number): string | null {
    const current = parseLocal(this.messages[index].createdAt);
    if (index === 0) {
      return relativeDate(current);
    }
    const previous = parseLocal(this.messages[index - 1].createdAt);
    return current.toDateString() === previous.toDateString() ? null : relativeDate(current);
  }

  goBack(): void {
    this.location.back();
  }

  openBusiness(): void {
    if (this.conversation) {
      this.router.navigate(businessPath({
        id: this.conversation.businessId,
        name: this.conversation.otherPartyName,
      }));
    }
  }

  /**
   * Añade el mensaje que acaba de llegar por el socket.
   *
   * Se comprueba que no esté ya: el propio envío devuelve la burbuja por REST
   * y el socket la reparte también, así que sin esto el mensaje que escribes
   * sale dos veces.
   */
  private appendFromSocket(message: ChatMessageResponse): void {
    const already = this.messages.some(
      m => m.id === message.id ||
        (!!message.clientMessageId && m.clientMessageId === message.clientMessageId),
    );
    if (already) {
      return;
    }
    this.messages = [...this.messages, message];
    this.shouldScroll = true;
    void this.chat.markRead(this.conversationId).catch(() => undefined);
  }

  /**
   * El sondeo es la red de seguridad, no el camino principal: solo se enciende
   * si el socket NO está conectado y la pestaña está a la vista. Preguntar
   * cada pocos segundos por un hilo que ya recibe eventos —o que nadie mira—
   * es gastar batería y cuota por nada.
   */
  private syncPolling(): void {
    const visible = document.visibilityState === 'visible';
    if (visible && !this.loadError && !this.socket.isConnected) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.poll) {
      return;
    }
    this.poll = setInterval(() => void this.refreshQuietly(), 8000);
  }

  private stopPolling(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = undefined;
    }
  }

  /**
   * Refresco silencioso: sin spinner y sin tocar nada si no hay novedades.
   * Repintar la lista entera cada ocho segundos haría saltar el scroll.
   */
  private async refreshQuietly(): Promise<void> {
    if (this.sending) {
      return;
    }
    try {
      const history = await this.chat.history(this.conversationId);
      const fresh = [...history].reverse();
      const lastKnown = this.messages.filter(m => m.id > 0).at(-1)?.id ?? 0;
      const lastFresh = fresh.at(-1)?.id ?? 0;
      if (lastFresh > lastKnown) {
        this.messages = fresh;
        this.shouldScroll = true;
        void this.chat.markRead(this.conversationId).catch(() => undefined);
      }
    } catch {
      // Un sondeo que falla no dice nada: lo dirá el siguiente, o el envío.
    }
  }
}
