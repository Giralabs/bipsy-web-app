import {
  AfterViewChecked,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { ChatRepository } from '../../repositories/chat.repository';
import { ChatSocketService } from '../../core/chat-socket.service';
import { BreakpointService } from '../../core/breakpoint.service';
import { ToastService } from '../../core/toast.service';
import {
  ChatHandler,
  ChatMessageResponse,
  ConversationResponse,
  currentChatHandler,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { parseLocal } from '../../shared/dates';
import { shrinkImage } from '../../shared/image-resize';
import { businessPath } from '../../shared/slug';
import { ChatConversationListComponent } from './conversation-list.component';
import { ChatViewerComponent } from './chat-viewer.component';
import {
  ChatDelivery,
  dayLabel,
  differentDay,
  documentIcon,
  firstName,
  formatBytes,
  hhmm,
  isImageMessage,
  isPdf,
  newClientMessageId,
} from './chat-format';

/** Mensajes por página. El mismo `_pageSize` que la app. */
const PAGE_SIZE = 30;

/**
 * A cuántos píxeles del principio se pide la página anterior. En píxeles y no
 * en «primer mensaje visible», como el `_loadMoreThreshold` de la app: así se
 * pide antes de llegar al tope y el usuario casi nunca ve el spinner.
 */
const LOAD_MORE_THRESHOLD = 320;

/** Lo que admite el selector de documentos: lo mismo que la app. */
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.txt,.csv';

/**
 * El tope del servidor por archivo (`PrivateMediaValidation.MAX_SIZE`). Se
 * mira antes de subir: diez megas por una conexión móvil para que al final
 * rebote es mucho esperar para nada.
 */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Las fotos se reducen como en la app: 1600 px de lado y calidad 80. */
const PHOTO_MAX_SIDE = 1600;
const PHOTO_QUALITY = 0.8;

/**
 * Un hilo de chat. Port de `ChatThreadScreen` y de `ChatThreadController`.
 *
 * Los mensajes nuevos llegan por el socket, igual que en las apps. El sondeo
 * se queda como **red de seguridad**: se enciende solo si el socket no está
 * conectado, y se para cuando la pestaña deja de estar visible. Sin socket el
 * chat sigue funcionando; lo que se pierde es la inmediatez.
 *
 * En escritorio la bandeja va a la izquierda y el hilo a la derecha, como en
 * cualquier cliente de mensajería con pantalla grande. Por eso el componente
 * NO se recrea al saltar de una conversación a otra —Angular reutiliza la
 * misma ruta— y todo el estado del hilo se reinicia en `open()`.
 */
@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    AvatarComponent,
    ChatConversationListComponent,
    ChatViewerComponent,
  ],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.css',
})
export class ChatThreadComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly chat = inject(ChatRepository);
  private readonly socket = inject(ChatSocketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly desktop = inject(BreakpointService).desktop;

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;
  @ViewChild('field') field?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('docInput') docInput?: ElementRef<HTMLInputElement>;
  @ViewChild('attachBtn') attachBtn?: ElementRef<HTMLButtonElement>;

  readonly documentAccept = DOCUMENT_ACCEPT;
  /**
   * «Hacer una foto» solo donde hay cámara a mano: con puntero táctil. En un
   * ordenador `capture` no hace nada y la opción sería un «Elegir foto»
   * repetido con otro nombre.
   */
  readonly canUseCamera =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  readonly skeletonBubbles = [
    { mine: false, w: 62 }, { mine: false, w: 40 }, { mine: true, w: 54 },
    { mine: false, w: 70 }, { mine: true, w: 36 }, { mine: true, w: 58 },
  ];

  conversation?: ConversationResponse;
  /** Del más viejo al más nuevo: el orden en que se pintan. */
  messages: ChatMessageResponse[] = [];

  isLoading = true;
  loadError: ApiError | null = null;
  loadingMore = false;
  hasMore = false;
  draft = '';
  attachOpen = false;

  /** El último mensaje entrante, para el lector de pantalla. */
  announcement = '';

  /** La bandeja de la columna izquierda, solo en escritorio. */
  inbox: ConversationResponse[] = [];
  inboxLoading = true;

  /** URLs de objeto creadas para los adjuntos, por id de mensaje. */
  readonly attachmentUrls = new Map<number, string>();
  /** Imágenes que no han podido bajar: se ofrece reintentar. */
  readonly failedAttachments = new Set<number>();
  /** Documentos que se están descargando ahora mismo. */
  readonly downloading = new Set<number>();
  private readonly loadingAttachments = new Set<number>();

  /**
   * El archivo de cada adjunto que aún no ha confirmado el servidor, por
   * `clientMessageId`. Es lo que permite reintentar un adjunto: el mensaje
   * fallido no lleva el archivo, solo su nombre.
   */
  private readonly outgoingFiles = new Map<string, File>();

  /** La foto abierta a pantalla completa, si hay alguna. */
  viewer: { url: string; filename: string } | null = null;

  conversationId = 0;
  private poll?: ReturnType<typeof setInterval>;
  private shouldScroll = false;
  /** Distancia al final antes de añadir la página vieja: se restaura después. */
  private restoreFromBottom: number | null = null;
  /** Para descartar respuestas de un hilo que ya no es el abierto. */
  private generation = 0;
  private readonly onVisibility = () => this.syncPolling();
  private resizeObserver?: ResizeObserver;

  get handler(): ChatHandler | null {
    return currentChatHandler(this.messages, this.conversation);
  }

  get canWrite(): boolean {
    return this.conversation?.canWrite !== false;
  }

  /** Hay algo saliendo: el sondeo no pisa la lista mientras tanto. */
  private get sending(): boolean {
    return this.messages.some(m => m.pending);
  }

  readonly firstName = firstName;
  readonly isImage = isImageMessage;
  readonly docIcon = documentIcon;

  ngOnInit(): void {
    // Los avisos flotantes suben por encima de la caja de escribir mientras el
    // hilo está abierto: abajo del todo la tapaban.
    document.documentElement.style.setProperty('--toast-lift', '76px');
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      void this.open(Number(params.get('id')));
    });

    // Conectar y desconectar lo gobierna la barra de navegación, que vive
    // toda la sesión: hacerlo aquí tiraría el socket cada vez que se sale de
    // un hilo, justo cuando el globo de no leídos lo necesita.
    this.socket.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.type === 'socket.connected') {
        // Una reconexión puede haber dejado un hueco sin eventos: se recarga
        // en vez de dar por bueno lo que hay en pantalla.
        void this.refreshQuietly();
        void this.loadInbox(true);
        this.syncPolling();
        return;
      }
      if (event.type === 'message.created') {
        // La columna de la bandeja se refresca con cualquier mensaje, como la
        // bandeja de la app; el hilo solo con los suyos.
        void this.loadInbox(true);
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
    this.watchTop();
  }

  ngOnDestroy(): void {
    document.documentElement.style.removeProperty('--toast-lift');
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.measureTop);
    this.releaseAttachments();
  }

  ngAfterViewChecked(): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    if (this.restoreFromBottom !== null) {
      // La página vieja entra por arriba: sin esto el contenido saltaría y
      // se perdería el mensaje que se estaba leyendo.
      el.scrollTop = el.scrollHeight - this.restoreFromBottom;
      this.restoreFromBottom = null;
    } else if (this.shouldScroll) {
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
      // Si lo cargado no llega a llenar la pantalla no hay scroll que lo
      // pida: se pide la página anterior directamente.
      if (this.hasMore && el.scrollHeight <= el.clientHeight + LOAD_MORE_THRESHOLD) {
        setTimeout(() => void this.loadMore());
      }
    }
  }

  // ----- CARGA --------------------

  /** Abre un hilo desde cero. Se llama también al saltar de uno a otro. */
  private async open(id: number): Promise<void> {
    this.conversationId = id;
    this.generation++;
    this.stopPolling();
    this.releaseAttachments();
    this.outgoingFiles.clear();
    this.messages = [];
    this.conversation = this.inbox.find(c => c.id === id);
    this.draft = '';
    this.attachOpen = false;
    this.viewer = null;
    this.announcement = '';
    await Promise.all([this.load(), this.loadInbox(this.inbox.length > 0)]);
  }

  async load(): Promise<void> {
    const generation = this.generation;
    this.isLoading = true;
    this.loadError = null;
    this.hasMore = false;
    try {
      // La conversación se pide SIEMPRE, aunque la bandeja ya la tenga: de
      // ella salen los tics y aquella es una foto del momento de navegar.
      const [conversation, history] = await Promise.all([
        this.chat.conversation(this.conversationId),
        this.chat.history(this.conversationId, undefined, PAGE_SIZE),
      ]);
      if (generation !== this.generation) return;
      this.conversation = conversation;
      // El backend devuelve del más nuevo al más viejo; en pantalla va al revés.
      this.messages = [...history].reverse();
      this.hasMore = history.length === PAGE_SIZE;
      this.shouldScroll = true;
      this.preloadImages();
      this.markRead();
    } catch (raw) {
      if (generation !== this.generation) return;
      this.loadError = ApiError.from(raw);
    } finally {
      if (generation === this.generation) {
        this.isLoading = false;
        this.syncPolling();
      }
    }
  }

  /**
   * Página anterior, con el id del mensaje más viejo como cursor. Nada de
   * OFFSET: mientras se lee entran mensajes y la ventana se desplazaría.
   */
  async loadMore(): Promise<void> {
    const oldest = this.messages.find(m => m.id > 0);
    if (this.loadingMore || !this.hasMore || !oldest || this.isLoading) return;
    const generation = this.generation;
    this.loadingMore = true;
    try {
      const older = await this.chat.history(this.conversationId, oldest.id, PAGE_SIZE);
      if (generation !== this.generation) return;
      const known = new Set(this.messages.map(m => m.id));
      const fresh = [...older].reverse().filter(m => !known.has(m.id));
      const el = this.scroller?.nativeElement;
      if (el && fresh.length) {
        this.restoreFromBottom = el.scrollHeight - el.scrollTop;
      }
      this.messages = [...fresh, ...this.messages];
      this.hasMore = older.length === PAGE_SIZE;
      this.preloadImages();
    } catch {
      // Fallar al pedir más antiguos no puede romper el hilo ya cargado: se
      // deja de paginar y lo que hay sigue visible.
      if (generation === this.generation) this.hasMore = false;
    } finally {
      if (generation === this.generation) this.loadingMore = false;
    }
  }

  onScroll(): void {
    const el = this.scroller?.nativeElement;
    if (el && el.scrollTop < LOAD_MORE_THRESHOLD) {
      void this.loadMore();
    }
  }

  /**
   * La bandeja de la izquierda. Solo en escritorio: en el móvil no se pinta y
   * pedirla sería una petición para nada.
   */
  private async loadInbox(quiet: boolean): Promise<void> {
    if (!this.desktop()) return;
    if (!quiet) this.inboxLoading = true;
    try {
      const list = await this.chat.inbox();
      // El hilo abierto ya está leído aunque el servidor aún no lo sepa.
      this.inbox = list.map(c => (c.id === this.conversationId ? { ...c, unread: 0 } : c));
    } catch {
      // La columna es un atajo: si no carga, el hilo sigue funcionando.
    } finally {
      this.inboxLoading = false;
    }
  }

  private markRead(): void {
    void this.chat.markRead(this.conversationId).catch(() => undefined);
    this.inbox = this.inbox.map(c => (c.id === this.conversationId ? { ...c, unread: 0 } : c));
  }

  // ----- ENVÍO --------------------

  /** Enter envía; Mayúsculas+Enter, salto de línea. Como cualquier chat de escritorio. */
  onFieldKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }

  /** El campo crece con el texto hasta cinco líneas; a partir de ahí se comería el hilo. */
  autoGrow(): void {
    const el = this.field?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }

  get canSend(): boolean {
    return this.draft.trim().length > 0;
  }

  async send(): Promise<void> {
    const body = this.draft.trim();
    if (!body || !this.canWrite) {
      return;
    }
    // Se limpia ANTES de enviar: quien envía espera ver el campo vacío al
    // instante, y la burbuja optimista aparece aunque la red tarde.
    this.draft = '';
    // Vacío, el campo vuelve a su alto de una línea.
    if (this.field) this.field.nativeElement.style.height = '';
    const clientMessageId = newClientMessageId();
    this.messages = [...this.messages, {
      id: -Date.now(),
      side: 'CUSTOMER',
      kind: 'TEXT',
      body,
      clientMessageId,
      createdAt: new Date().toISOString(),
      pending: true,
    }];
    this.shouldScroll = true;
    await this.deliverText(clientMessageId, body);
  }

  /**
   * Reintenta un envío fallido con el MISMO `clientMessageId`: es lo que
   * garantiza que no salgan dos mensajes si el primero sí llegó.
   */
  retry(message: ChatMessageResponse): void {
    const clientMessageId = message.clientMessageId;
    if (!clientMessageId) return;
    this.patch(clientMessageId, { pending: true, failed: false });
    const file = this.outgoingFiles.get(clientMessageId);
    if (file) {
      void this.deliverFile(clientMessageId, file, message.id);
    } else {
      void this.deliverText(clientMessageId, message.body ?? '');
    }
  }

  private async deliverText(clientMessageId: string, body: string): Promise<void> {
    const generation = this.generation;
    try {
      const saved = await this.chat.send(this.conversationId, body, clientMessageId);
      if (generation !== this.generation) return;
      this.replacePending(clientMessageId, saved);
      void this.refreshConversation();
    } catch {
      // Sin aviso aparte: la propia burbuja dice «Reintentar», igual que la app.
      if (generation === this.generation) this.patch(clientMessageId, { pending: false, failed: true });
    }
  }

  // ----- ADJUNTAR --------------------

  toggleAttach(): void {
    this.attachOpen = !this.attachOpen;
    if (this.attachOpen) {
      // El foco entra en el menú: con teclado se abre y se elige sin ratón.
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.attach-menu__item')?.focus());
    }
  }

  closeAttach(returnFocus = false): void {
    if (!this.attachOpen) return;
    this.attachOpen = false;
    if (returnFocus) this.attachBtn?.nativeElement.focus();
  }

  pick(kind: 'camera' | 'photo' | 'document'): void {
    this.attachOpen = false;
    const input = kind === 'camera' ? this.cameraInput : kind === 'photo' ? this.photoInput : this.docInput;
    input?.nativeElement.click();
  }

  /** El menú se cierra al tocar fuera, como cualquier menú. */
  @HostListener('document:pointerdown', ['$event'])
  onOutside(event: PointerEvent): void {
    if (!this.attachOpen) return;
    const target = event.target as Node;
    if (!this.host.nativeElement.querySelector('.composer__attach-wrap')?.contains(target)) {
      this.attachOpen = false;
    }
  }

  onMenuKey(event: KeyboardEvent): void {
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.attach-menu__item'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeAttach(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  }

  async sendFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = '';
    if (!picked || !this.canWrite) {
      return;
    }
    // Se comprime al elegir, como la app: una foto de un móvil moderno sin
    // tocar pasa del tope del servidor. Si no se puede (un HEIC que el
    // navegador no decodifica), sale tal cual y decide el tope de abajo.
    const generation = this.generation;
    const file = picked.type.startsWith('image/')
      ? await shrinkImage(picked, PHOTO_MAX_SIDE, PHOTO_QUALITY)
      : picked;
    // Mientras se comprimía se pudo abrir otra conversación: la foto no puede
    // acabar enviada al negocio equivocado.
    if (generation !== this.generation) {
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      this.toast.error('El archivo es demasiado grande. El límite es de 10 MB por archivo.');
      return;
    }
    // Burbuja optimista también para archivos: se ve qué se está enviando.
    // Una foto enseña su vista previa local; un documento, su ficha.
    const clientMessageId = newClientMessageId();
    const isImage = file.type.startsWith('image/');
    const tempId = -Date.now();
    if (isImage) {
      this.attachmentUrls.set(tempId, URL.createObjectURL(file));
    }
    this.outgoingFiles.set(clientMessageId, file);
    this.messages = [...this.messages, {
      id: tempId,
      side: 'CUSTOMER',
      kind: isImage ? 'IMAGE' : 'FILE',
      attachment: { filename: file.name, contentType: file.type, sizeBytes: file.size, url: '' },
      clientMessageId,
      createdAt: new Date().toISOString(),
      pending: true,
    }];
    this.shouldScroll = true;
    await this.deliverFile(clientMessageId, file, tempId);
  }

  private async deliverFile(clientMessageId: string, file: File, tempId: number): Promise<void> {
    const generation = this.generation;
    try {
      const saved = await this.chat.sendAttachment(this.conversationId, file, clientMessageId);
      if (generation !== this.generation) return;
      this.outgoingFiles.delete(clientMessageId);
      // La vista previa local sirve también para el mensaje ya guardado: así
      // la foto no parpadea al cambiar de id.
      const preview = this.attachmentUrls.get(tempId);
      if (preview) {
        this.attachmentUrls.delete(tempId);
        this.attachmentUrls.set(saved.id, preview);
      }
      this.replacePending(clientMessageId, saved);
      void this.refreshConversation();
    } catch (raw) {
      if (generation !== this.generation) return;
      this.patch(clientMessageId, { pending: false, failed: true });
      // Aquí sí se avisa: un archivo puede rebotar por tamaño o por tipo, y
      // eso no lo arregla reintentar. Es el snackbar de `_pickAttachment`.
      this.toast.error(ApiError.from(raw).message);
    }
  }

  // ----- ADJUNTOS RECIBIDOS --------------------

  /** "PDF · 1,2 MB". */
  docMeta(message: ChatMessageResponse): string {
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
    const generation = this.generation;
    this.loadingAttachments.add(message.id);
    try {
      const url = await this.chat.attachmentObjectUrl(this.conversationId, message.id);
      if (generation !== this.generation) {
        URL.revokeObjectURL(url);
        return;
      }
      this.attachmentUrls.set(message.id, url);
      this.failedAttachments.delete(message.id);
    } catch {
      if (generation === this.generation) this.failedAttachments.add(message.id);
    } finally {
      this.loadingAttachments.delete(message.id);
    }
  }

  retryAttachment(message: ChatMessageResponse): void {
    this.failedAttachments.delete(message.id);
    void this.loadAttachment(message);
  }

  /** La foto entera, con la MISMA descarga que ya pintó la miniatura. */
  openImage(message: ChatMessageResponse): void {
    const url = this.attachmentUrls.get(message.id);
    if (url) {
      this.viewer = { url, filename: message.attachment?.filename ?? 'Imagen' };
    }
  }

  /**
   * Abre un documento. Un PDF se abre en otra pestaña, que es donde el
   * navegador sabe enseñarlo; lo demás se descarga con su nombre. Es el «lo
   * delega en el sistema» del visor de la app, en versión navegador.
   */
  async openDocument(message: ChatMessageResponse): Promise<void> {
    const attachment = message.attachment;
    if (!attachment || message.id <= 0 || this.downloading.has(message.id)) {
      return;
    }
    // La pestaña se abre YA, dentro del clic: abrirla después de la descarga
    // la convierte en una ventana emergente que el navegador bloquea.
    const tab = isPdf(message) ? window.open('', '_blank') : null;
    const generation = this.generation;
    this.downloading.add(message.id);
    try {
      if (!this.attachmentUrls.has(message.id)) {
        const url = await this.chat.attachmentObjectUrl(this.conversationId, message.id);
        if (generation !== this.generation) {
          // Se saltó a otro hilo durante la descarga: guardarla aquí la
          // dejaría en el mapa del hilo nuevo, sin revocar nunca.
          URL.revokeObjectURL(url);
          tab?.close();
          return;
        }
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
    } catch {
      tab?.close();
      this.toast.error('No se ha podido descargar el archivo.');
    } finally {
      this.downloading.delete(message.id);
    }
  }

  // ----- PINTADO --------------------

  /**
   * La clave de cada burbuja. Por `clientMessageId` cuando lo hay: la
   * provisional y la guardada son la misma burbuja aunque cambie el id, y así
   * no se repinta —ni parpadea la foto— al confirmarse el envío.
   */
  trackKey(message: ChatMessageResponse): string | number {
    return message.clientMessageId ?? message.id;
  }

  isMine(message: ChatMessageResponse): boolean {
    return message.side === 'CUSTOMER';
  }

  /**
   * Reloj → un tic → dos tics → dos tics en azul. Se deriva de las dos marcas
   * de agua de la conversación, no de un campo por mensaje: así abrir un hilo
   * con 200 sin leer no son 200 escrituras.
   */
  delivery(message: ChatMessageResponse): ChatDelivery {
    if (message.failed) return 'failed';
    if (message.pending) return 'pending';
    const c = this.conversation;
    if (!c) return 'sent';
    const at = parseLocal(message.createdAt).getTime();
    if (c.otherLastReadAt && at <= parseLocal(c.otherLastReadAt).getTime()) return 'read';
    if (c.otherLastDeliveredAt && at <= parseLocal(c.otherLastDeliveredAt).getTime()) return 'delivered';
    return 'sent';
  }

  deliveryLabel(state: ChatDelivery): string {
    switch (state) {
      case 'pending': return 'Enviando';
      case 'sent': return 'Enviado';
      case 'delivered': return 'Entregado';
      case 'read': return 'Leído';
      default: return 'No se ha enviado';
    }
  }

  stamp(message: ChatMessageResponse): string {
    return hhmm(parseLocal(message.createdAt));
  }

  /** "3 sep · 10:30", la línea de la cita citada. Como `_BookingCard`. */
  bookingWhen(value: string): string {
    const d = parseLocal(value);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d.getDate()} ${months[d.getMonth()]} · ${hhmm(d)}`;
  }

  /**
   * La píldora de día va encima del primer mensaje de cada día. En el primero
   * de la lista solo si ya no quedan más viejos: si quedan, ese día puede
   * seguir hacia arriba y la píldora saldría en mitad del grupo.
   */
  daySeparator(index: number): string | null {
    const current = parseLocal(this.messages[index].createdAt);
    if (index === 0) {
      return this.hasMore ? null : dayLabel(current);
    }
    const previous = parseLocal(this.messages[index - 1].createdAt);
    return differentDay(current, previous) ? dayLabel(current) : null;
  }

  /**
   * Atrás vuelve a la bandeja si se llegó navegando; si se entró directo (un
   * enlace, una notificación) el `back()` del navegador sacaría de la web.
   */
  goBack(): void {
    const state = history.state as { navigationId?: number } | null;
    if ((state?.navigationId ?? 1) > 1) {
      history.back();
    } else {
      void this.router.navigate(['/mensajes']);
    }
  }

  openBusiness(): void {
    if (this.conversation) {
      void this.router.navigate(businessPath({
        id: this.conversation.businessId,
        name: this.conversation.otherPartyName,
      }));
    }
  }

  // ----- AYUDAS --------------------

  private replacePending(clientMessageId: string, saved: ChatMessageResponse): void {
    // El socket puede haber traído ya el guardado: entonces sobra la provisional.
    const alreadyThere = this.messages.some(m => m.id === saved.id);
    this.messages = alreadyThere
      ? this.messages.filter(m => m.clientMessageId !== clientMessageId || m.id === saved.id)
      : this.messages.map(m => (m.clientMessageId === clientMessageId ? saved : m));
  }

  private patch(clientMessageId: string, changes: Partial<ChatMessageResponse>): void {
    this.messages = this.messages.map(m =>
      m.clientMessageId === clientMessageId && m.id <= 0 ? { ...m, ...changes } : m,
    );
  }

  /** Tras enviar: el mensaje propio nace en un tic y hay que verlo avanzar. */
  private async refreshConversation(): Promise<void> {
    try {
      const conversation = await this.chat.conversation(this.conversationId);
      if (conversation.id === this.conversationId) this.conversation = conversation;
    } catch {
      // Refresco de cortesía: el socket o la próxima apertura lo corrigen.
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
    this.announce(message);
    this.preloadImages();
    this.markRead();
  }

  /** Lo que lee el lector de pantalla cuando entra un mensaje del negocio. */
  private announce(message: ChatMessageResponse): void {
    if (message.side !== 'BUSINESS') return;
    const who = message.senderName ? firstName(message.senderName) : this.conversation?.otherPartyName ?? 'El negocio';
    const what = message.body || (message.attachment ? `ha enviado ${message.attachment.filename}` : '');
    this.announcement = `${who}: ${what}`;
  }

  private releaseAttachments(): void {
    // Las URL de objeto viven hasta que se revocan: sin esto, cada hilo que se
    // abre deja sus adjuntos en memoria para el resto de la sesión.
    this.attachmentUrls.forEach(url => URL.revokeObjectURL(url));
    this.attachmentUrls.clear();
    this.failedAttachments.clear();
    this.loadingAttachments.clear();
    this.downloading.clear();
  }

  /**
   * En escritorio el hilo ocupa lo que queda de ventana bajo la cabecera. No
   * se puede fijar en CSS: encima van la barra de promoción —que se puede
   * cerrar— y la de navegación, y con un número a ojo el compositor se
   * quedaba por debajo del pliegue. Se mide dónde empieza y se publica.
   */
  private readonly measureTop = () => {
    const el = this.host.nativeElement as HTMLElement;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY);
    el.style.setProperty('--th-top', `${Math.round(top)}px`);
  };

  private watchTop(): void {
    this.measureTop();
    window.addEventListener('resize', this.measureTop);
    if (typeof ResizeObserver !== 'undefined') {
      // Cerrar la barra de promoción no cambia la ventana ni el alto del
      // hilo, solo dónde empieza; lo que sí cambia es el alto de la página
      // entera (con el pie debajo siempre pasa de la ventana). Se vigila eso.
      this.zone.runOutsideAngular(() => {
        this.resizeObserver = new ResizeObserver(() => this.measureTop());
        const root = this.host.nativeElement.closest('main')?.parentElement ?? document.body;
        this.resizeObserver.observe(root);
      });
    }
  }

  /**
   * El sondeo es la red de seguridad, no el camino principal: solo se enciende
   * si el socket NO está conectado y la pestaña está a la vista. Preguntar
   * cada pocos segundos por un hilo que ya recibe eventos —o que nadie mira—
   * es gastar batería y cuota por nada.
   */
  private syncPolling(): void {
    const visible = document.visibilityState === 'visible';
    if (visible && !this.loadError && !this.isLoading && !this.socket.isConnected) {
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
   * Refresco silencioso: sin esqueleto y sin tocar nada si no hay novedades.
   * Solo se añaden los mensajes nuevos al final; repintar la lista entera
   * tiraría las páginas viejas ya cargadas y haría saltar el scroll.
   */
  private async refreshQuietly(): Promise<void> {
    if (this.sending || this.isLoading || this.loadError) {
      return;
    }
    const generation = this.generation;
    try {
      // La conversación también: sin socket, es la única forma de que los
      // tics pasen a entregado o leído.
      const [history, conversation] = await Promise.all([
        this.chat.history(this.conversationId, undefined, PAGE_SIZE),
        this.chat.conversation(this.conversationId).catch(() => null),
      ]);
      if (generation !== this.generation) return;
      if (conversation) {
        this.conversation = conversation;
      }
      const known = new Set(this.messages.map(m => m.id));
      const fresh = [...history].reverse().filter(m => !known.has(m.id) &&
        !(m.clientMessageId && this.messages.some(x => x.clientMessageId === m.clientMessageId)));
      if (fresh.length === history.length && history.length === PAGE_SIZE) {
        // Una página entera de nuevos: puede haber hueco entre lo que había y
        // esto. Se empieza de cero con la página fresca.
        this.messages = [...history].reverse();
        this.hasMore = true;
        this.shouldScroll = true;
        this.preloadImages();
        this.markRead();
      } else if (fresh.length) {
        this.messages = [...this.messages, ...fresh];
        this.shouldScroll = true;
        fresh.forEach(m => this.announce(m));
        this.preloadImages();
        this.markRead();
      }
    } catch {
      // Un sondeo que falla no dice nada: lo dirá el siguiente, o el envío.
    }
  }
}
