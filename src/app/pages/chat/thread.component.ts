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
        return;
      }
      // El negocio ha recibido o leído: segundo tic, o tics en azul. Solo
      // cuenta si lo dice la otra parte; los míos no cambian mis tics.
      if (this.conversation && event.side !== 'CUSTOMER' && event.at) {
        if (event.type === 'conversation.read') {
          this.conversation = { ...this.conversation, otherLastReadAt: event.at };
        } else if (event.type === 'conversation.delivered') {
          this.conversation = { ...this.conversation, otherLastDeliveredAt: event.at };
        }
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
      this.preloadImages();
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
    // Burbuja optimista también para archivos: se ve qué se está enviando.
    // Una foto enseña su vista previa local; un documento, su tarjeta.
    const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isImage = file.type.startsWith('image/');
    const tempId = -Date.now();
    const optimistic: ChatMessageResponse = {
      id: tempId,
      side: 'CUSTOMER',
      kind: isImage ? 'IMAGE' : 'FILE',
      attachment: { filename: file.name, contentType: file.type, sizeBytes: file.size, url: '' },
      clientMessageId,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    if (isImage) {
      this.attachmentUrls.set(tempId, URL.createObjectURL(file));
    }
    this.messages = [...this.messages, optimistic];
    this.shouldScroll = true;
    this.sending = true;
    this.sendError = null;
    try {
      const saved = await this.chat.sendAttachment(this.conversationId, file, clientMessageId);
      // La vista previa local sirve también para el mensaje ya guardado: así
      // la foto no parpadea al cambiar de id.
      const preview = this.attachmentUrls.get(tempId);
      if (preview) {
        this.attachmentUrls.delete(tempId);
        this.attachmentUrls.set(saved.id, preview);
      }
      const alreadyThere = this.messages.some(m => m.id === saved.id);
      this.messages = alreadyThere
        ? this.messages.filter(m => m.clientMessageId !== clientMessageId || m.id === saved.id)
        : this.messages.map(m => (m.clientMessageId === clientMessageId ? saved : m));
      this.shouldScroll = true;
    } catch (raw) {
      this.sendError = ApiError.from(raw).message;
      this.messages = this.messages.map(m =>
        m.clientMessageId === clientMessageId ? { ...m, pending: false, failed: true } : m,
      );
    } finally {
      this.sending = false;
    }
  }

  // ----- ADJUNTOS --------------------

  /** Imágenes que no han podido bajar: se ofrece reintentar. */
  readonly failedAttachments = new Set<number>();
  /** Documentos que se están descargando ahora mismo. */
  readonly downloading = new Set<number>();
  private readonly loadingAttachments = new Set<number>();

  /** Foto si lo dice el tipo del mensaje o el del archivo. */
  isImage(message: ChatMessageResponse): boolean {
    if (message.kind === 'IMAGE') return true;
    if (message.kind === 'FILE') return false;
    return (message.attachment?.contentType ?? '').startsWith('image/');
  }

  /** Familia del documento, para el color del icono. */
  docKind(message: ChatMessageResponse): string {
    const type = message.attachment?.contentType ?? '';
    const name = (message.attachment?.filename ?? '').toLowerCase();
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (/word|document|rtf|text\//.test(type) || /\.(docx?|odt|txt|rtf)$/.test(name)) return 'doc';
    if (/sheet|excel|csv/.test(type) || /\.(xlsx?|ods|csv)$/.test(name)) return 'sheet';
    if (/zip|compressed|rar/.test(type) || /\.(zip|rar|7z)$/.test(name)) return 'zip';
    return 'file';
  }

  docIcon(message: ChatMessageResponse): string {
    switch (this.docKind(message)) {
      case 'pdf': return 'picture_as_pdf';
      case 'doc': return 'description';
      case 'sheet': return 'table_chart';
      case 'zip': return 'folder_zip';
      default: return 'draft';
    }
  }

  /** "PDF · 1,2 MB". */
  docMeta(message: ChatMessageResponse): string {
    if (message.pending) return 'Enviando…';
    const a = message.attachment;
    if (!a) return '';
    const ext = a.filename.includes('.') ? a.filename.split('.').pop()!.toUpperCase() : 'Archivo';
    return a.sizeBytes ? `${ext} · ${formatBytes(a.sizeBytes)}` : ext;
  }

  /**
   * Baja las fotos del hilo en cuanto se pintan. Los adjuntos exigen
   * `Authorization`, así que no valen como `src` directo: se descargan y se
   * cachean como URL de objeto. Los documentos NO se bajan solos: solo cuando
   * se pulsan.
   */
  private preloadImages(): void {
    for (const message of this.messages) {
      if (message.attachment && message.id > 0 && this.isImage(message)) {
        void this.loadAttachment(message);
      }
    }
  }

  async loadAttachment(message: ChatMessageResponse): Promise<void> {
    if (!message.attachment || this.attachmentUrls.has(message.id) || this.loadingAttachments.has(message.id)) {
      return;
    }
    this.loadingAttachments.add(message.id);
    try {
      const url = await this.chat.attachmentObjectUrl(this.conversationId, message.id);
      this.attachmentUrls.set(message.id, url);
      this.failedAttachments.delete(message.id);
    } catch {
      this.failedAttachments.add(message.id);
    } finally {
      this.loadingAttachments.delete(message.id);
    }
  }

  retryAttachment(message: ChatMessageResponse): void {
    this.failedAttachments.delete(message.id);
    void this.loadAttachment(message);
  }

  /**
   * Abre un documento. Un PDF se abre en otra pestaña, que es donde el
   * navegador sabe enseñarlo; lo demás se descarga con su nombre.
   */
  async openDocument(message: ChatMessageResponse): Promise<void> {
    const attachment = message.attachment;
    if (!attachment || message.id <= 0 || this.downloading.has(message.id)) {
      return;
    }
    // La pestaña se abre YA, dentro del clic: abrirla después de la descarga
    // la convierte en una ventana emergente que el navegador bloquea.
    const isPdf = this.docKind(message) === 'pdf';
    const tab = isPdf ? window.open('', '_blank') : null;
    this.downloading.add(message.id);
    try {
      if (!this.attachmentUrls.has(message.id)) {
        const url = await this.chat.attachmentObjectUrl(this.conversationId, message.id);
        this.attachmentUrls.set(message.id, url);
      }
      const url = this.attachmentUrls.get(message.id)!;
      if (tab) {
        tab.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (raw) {
      tab?.close();
      this.sendError = 'No se ha podido abrir el archivo. Inténtalo de nuevo.';
    } finally {
      this.downloading.delete(message.id);
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

  /**
   * En qué punto está un mensaje mío. Port de `_deliveryOf` (ChatThreadScreen):
   * se compara la hora del mensaje con hasta dónde le ha llegado y ha leído el
   * negocio, que vienen en la conversación y se actualizan por el socket.
   */
  delivery(message: ChatMessageResponse): 'pending' | 'failed' | 'sent' | 'delivered' | 'read' {
    if (message.failed) return 'failed';
    if (message.pending) return 'pending';
    const c = this.conversation;
    if (!c) return 'sent';
    const at = new Date(message.createdAt).getTime();
    if (c.otherLastReadAt && at <= new Date(c.otherLastReadAt).getTime()) return 'read';
    if (c.otherLastDeliveredAt && at <= new Date(c.otherLastDeliveredAt).getTime()) return 'delivered';
    return 'sent';
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
    this.preloadImages();
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
      // La conversación también: sin socket, es la única forma de que los
      // tics pasen a entregado o leído.
      const [history, conversation] = await Promise.all([
        this.chat.history(this.conversationId),
        this.chat.conversation(this.conversationId).catch(() => null),
      ]);
      if (conversation) {
        this.conversation = conversation;
      }
      const fresh = [...history].reverse();
      const lastKnown = this.messages.filter(m => m.id > 0).at(-1)?.id ?? 0;
      const lastFresh = fresh.at(-1)?.id ?? 0;
      if (lastFresh > lastKnown) {
        this.messages = fresh;
        this.shouldScroll = true;
        this.preloadImages();
        void this.chat.markRead(this.conversationId).catch(() => undefined);
      }
    } catch {
      // Un sondeo que falla no dice nada: lo dirá el siguiente, o el envío.
    }
  }
}

/** "820 KB", "1,2 MB". */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
