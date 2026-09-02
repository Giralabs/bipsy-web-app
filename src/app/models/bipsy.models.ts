/**
 * Contrato con la API de Bipsy.
 *
 * Espejo de `bipsy-mobile-app/packages/gipsi_api/lib/src/models/*.dart`.
 * Cambiar un DTO del backend obliga a actualizar los dos ficheros.
 */

// ----- CATEGORIES --------------------

export interface CategoryResponse {
  id: number;
  code: string;
  name: string;
  description?: string;
  active: boolean;
}

// ----- BRANDING (PLAN QUALITY) --------------------

/**
 * Personalización visible de un negocio (plan Quality).
 *
 * La filtra el servidor por plan: lo que no cubre la suscripción no llega, así
 * que si el objeto está presente se pinta sin comprobar nada más. Ausente =
 * aspecto normal de Bipsy.
 *
 * Los códigos son los enums del backend (AvatarFrame, CoverEffect,
 * CardEffect, NameEffect, ShowcaseSection). Se tipan como string y no como
 * unión cerrada a propósito: la web no dibuja los efectos —hoy son solo de las
 * apps— y una unión obligaría a tocar este fichero cada vez que se añade uno.
 */
export interface BusinessBranding {
  accentColor?: string;
  animatedProfileUrl?: string;
  animatedCoverUrl?: string;
  avatarFrame: string;
  coverEffect: string;
  cardEffect: string;
  nameEffect: string;
  sectionOrder: string[];
}

// ----- BUSINESSES --------------------

export interface BusinessCategoryRef {
  id: number;
  code: string;
  name: string;
  primary: boolean;
}

/**
 * Por qué un negocio aparece donde aparece en Explorar.
 *
 * **Solo viaja en las filas de Explorar.** En el resto de respuestas es
 * `undefined`, que no significa "no destacado" sino "no preguntado".
 */
export interface BusinessDiscovery {
  featured: boolean;
  /** `QUALITY_PLAN` o `MERIT`. */
  featuredReason?: string;
  recentlyOpened: boolean;
  distanceKm?: number;
  /** El cliente ya ha reservado aquí. Solo en favoritos y habituales. */
  previouslyBooked?: boolean;
  /** Última cita aquí, para que "volver a reservar" entre con todo puesto. */
  lastServiceId?: number;
  lastWorkerId?: number;
}

export interface BusinessResponse {
  id: number;
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  cif?: string;
  /** Opcional: un negocio a domicilio no tiene local y no guarda dirección. */
  address?: string;
  city?: string;
  province?: string;
  /** Va a donde esté el cliente: no tiene calle propia que enseñar. */
  worksAtHome?: boolean;
  latitude?: number;
  longitude?: number;
  description?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  autonomous: boolean;
  autoAccept?: boolean;
  setupComplete?: boolean;
  availabilityHorizonDays?: number;
  waitlistEnabled?: boolean;
  chatEnabled?: boolean;
  averageRating?: number;
  reviewCount?: number;
  /** La principal siempre la primera. */
  categories?: BusinessCategoryRef[];
  /** Exige tarjeta guardada para poder reservar. */
  requiresCard?: boolean;
  cancellationFeePercent?: number;
  cancellationWindowHours?: number;
  branding?: BusinessBranding;
  discovery?: BusinessDiscovery;
}

/** Categoría principal, o la primera si ninguna viene marcada. */
export function primaryCategory(business: BusinessResponse): BusinessCategoryRef | undefined {
  const list = business.categories ?? [];
  return list.find(c => c.primary) ?? list[0];
}

/** Cancelar tarde tiene coste. Sin tarjeta no hay con qué cobrar. */
export function chargesCancellation(business: BusinessResponse): boolean {
  return !!business.requiresCard && (business.cancellationFeePercent ?? 0) > 0;
}

/**
 * Lo que se enseña donde va la ubicación de un negocio.
 *
 * Port de `BusinessLocationLabel` (gipsi_api). Existe porque `address` no está
 * normalizada: los negocios dados de alta antes de la V33 guardaron la
 * dirección completa de Google ("C. Sierpes, 1, Casco Antiguo, 41004 Sevilla,
 * España"), y añadirle la ciudad al lado producía "…Sevilla, España, Sevilla".
 */
export function businessLocationDisplay(business: BusinessResponse): string {
  if (business.worksAtHome) {
    return 'A domicilio';
  }

  const street = (business.address ?? '').trim();
  const town = (business.city ?? business.province ?? '').trim();

  if (street.length === 0) {
    return town;
  }

  const cleaned = trimCountry(street);
  if (town.length === 0 || cleaned.toLowerCase().includes(town.toLowerCase())) {
    return cleaned;
  }
  return `${cleaned}, ${town}`;
}

/** Quita el ", España" del final: alarga la línea hasta cortarla y no aporta. */
function trimCountry(value: string): string {
  const trimmed = value.trim();
  const suffix = ', españa';
  if (trimmed.toLowerCase().endsWith(suffix)) {
    return trimmed.slice(0, trimmed.length - suffix.length).trim();
  }
  return trimmed;
}

// ----- SERVICES --------------------

export interface ServiceResponse {
  id: number;
  businessId: number;
  businessName?: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  active: boolean;
  imageUrl?: string;
  workerIds?: number[];
  averageRating?: number;
  reviewCount?: number;
}

// ----- WORKERS --------------------

export interface WorkerResponse {
  id: number;
  name: string;
  email?: string;
  username?: string;
  phone?: string;
  businessId?: number;
  available: boolean;
  autoAccept?: boolean;
  allowOvertime?: boolean;
  profileImageUrl?: string;
}

// ----- AVAILABILITY --------------------

export type SlotUnavailableReason =
  | 'BOOKED'
  | 'OUT_OF_SCHEDULE'
  | 'TIME_OFF'
  | 'OVERTIME_NOT_ALLOWED'
  | 'WORKER_UNAVAILABLE';

export interface AvailabilitySlot {
  /** "HH:mm". El backend manda "HH:mm:ss"; el repositorio recorta. */
  start: string;
  end: string;
  available: boolean;
  reason?: SlotUnavailableReason;
  availableWorkerIds?: number[];
}

export interface AvailabilityResponse {
  serviceId: number;
  workerId?: number;
  date: string;
  slotMinutes: number;
  serviceDuration: number;
  slots: AvailabilitySlot[];
}

// ----- SCHEDULE --------------------

/**
 * Un tramo de horario.
 *
 * ⚠️ **`dayOfWeek` llega por NOMBRE** (`"MONDAY"`), no como número, y **un día
 * puede tener varios tramos** (mañana y tarde son dos filas). Un día sin
 * ninguno está cerrado: no hay campo `active` que mirar.
 */
export interface ScheduleDayResponse {
  id?: number;
  actorId?: number;
  dayOfWeek: string;
  startTime?: string;
  endTime?: string;
}

// ----- POLICIES --------------------

export interface BusinessPolicy {
  id: number;
  text: string;
  templateId?: number;
  custom: boolean;
  displayOrder: number;
}

export interface BusinessPolicyGroup {
  categoryId: number;
  code?: string;
  name: string;
  icon?: string;
  custom: boolean;
  displayOrder: number;
  policies: BusinessPolicy[];
}

// ----- PORTFOLIO --------------------

export interface PortfolioItem {
  id: number;
  /** El campo se llama `url`, no `imageUrl`. Llega relativa a la API. */
  url: string;
  caption?: string;
  serviceId?: number;
  serviceName?: string;
  displayOrder: number;
}

// ----- BOOKINGS --------------------

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'NO_SHOW';

export interface BookingResponse {
  id: number;
  businessId: number;
  businessName?: string;
  customerId: number;
  serviceId: number;
  serviceName: string;
  serviceImageUrl?: string;
  /** Si desde esta cita se puede valorar ahora mismo. Lo decide el servidor. */
  canReview?: boolean;
  workerId?: number;
  workerName?: string;
  /** ISO-8601 local, sin zona. */
  startDateTime: string;
  endDateTime: string;
  price?: number;
  status: BookingStatus;
  notes?: string;
  cancelReason?: string;
}

export interface CreateBookingRequest {
  serviceId: number;
  workerId?: number;
  /** ISO-8601 **sin zona**: en UTC la cita se desplazaría en la agenda. */
  startDateTime: string;
  notes?: string;
  /**
   * El cliente ha aceptado la política de cancelación del negocio.
   *
   * El servidor solo lo exige cuando ese negocio cobra por cancelar, y lo
   * guarda junto con la fecha y la IP: es la prueba con la que se contesta si
   * el cliente reclama después ese cobro a su banco.
   */
  acceptedPolicy: boolean;
}

export interface RescheduleBookingRequest {
  startDateTime: string;
  workerId?: number;
}

export interface CancellationFee {
  willCharge: boolean;
  amountCents: number;
  currency: string;
  feePercent: number;
  windowHours: number;
  hoursBeforeStart: number;
}

/** Una cita está viva mientras no se haya cancelado ni marcado como no-show. */
export function isBookingActive(booking: BookingResponse): boolean {
  return booking.status === 'PENDING' || booking.status === 'CONFIRMED';
}

// ----- REVIEWS --------------------

export interface ReviewResponse {
  id: number;
  businessId: number;
  bookingId?: number;
  customerId?: number;
  authorName?: string;
  customerImageUrl?: string;
  rating: number;
  comment?: string;
  serviceName?: string;
  createdAt?: string;
  reply?: string;
  repliedAt?: string;
}

export interface CreateReviewRequest {
  bookingId: number;
  rating: number;
  comment?: string;
}

// ----- PAGINACIÓN --------------------

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// ----- AUTH --------------------

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInMs: number;
  username: string;
  role: string;
  actorId: number;
}

export interface LoginRequest {
  /** El servidor acepta correo o nombre de usuario en el mismo campo. */
  username: string;
  password: string;
}

/**
 * Último paso del alta: los datos, con el correo ya verificado.
 *
 * No lleva email. El correo va DENTRO de `signupToken`, que se obtiene
 * acertando el código enviado a esa dirección; si viajara aparte, bastaría con
 * cambiarlo para crear una cuenta con el correo de otro.
 */
export interface RegisterCustomerRequest {
  signupToken: string;
  name: string;
  password: string;
  phone: string;
  referralCode?: string;
}

export interface SendCodeResult {
  /**
   * Segundos que faltan para poder pedir otro código.
   *
   * Lo dice el servidor y no se calcula aquí: si la web ofreciera reenviar
   * antes de tiempo, el usuario recibiría un error por pulsar justo lo que se
   * le estaba ofreciendo.
   */
  resendInSeconds: number;
}

export interface VerifyCodeResult {
  signupToken: string;
}

// ----- ME / PERFIL --------------------

/** Perfil del cliente: `GET /customers/me`. Trae también sus favoritos. */
export interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string;
  profileImageUrl?: string;
  city?: string;
  province?: string;
  favoriteBusinessIds?: number[];
  favoriteServiceIds?: number[];
}

/** Respuesta polimórfica de `GET /me`. `profile` depende del rol. */
export interface MeResponse {
  id: number;
  username: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  emailVerified?: boolean;
  /** Cómo se creó la cuenta: `LOCAL` (correo + contraseña) o `GOOGLE`. */
  authProvider?: 'LOCAL' | 'GOOGLE';
  googleLinked?: boolean;
  /**
   * Si la cuenta tiene contraseña propia, y por tanto puede cambiarla en vez
   * de crearla. Lo dice el servidor: no se deduce del proveedor, porque quien
   * entró con Google puede haberse creado una después.
   */
  hasPassword?: boolean;
  profile?: Record<string, unknown>;
}

/** Vista de sesión que consume la UI. */
export interface UserProfileDto {
  id?: number;
  email?: string;
  name?: string;
  username?: string;
  role?: string;
  phone?: string;
  profileImageUrl?: string;
  city?: string;
  province?: string;
  initials?: string;
  /** Decide si "Cambiar contraseña" se ofrece o se esconde. */
  hasPassword?: boolean;
  authProvider?: string;
}

export interface PrivacySettings {
  newsletterBipsy: boolean;
  newsletterGiralabs: boolean;
}

// ----- CHAT --------------------

/** Lado de la conversación. Nunca se compara contra el rol del usuario. */
export type ChatSide = 'CUSTOMER' | 'BUSINESS' | 'SYSTEM';

export type ChatMessageKind = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

/**
 * Archivo de un mensaje.
 *
 * `url` apunta a un endpoint **autenticado**: estos archivos viven en el
 * almacén privado y exigen cabecera `Authorization`, así que NO se pueden
 * pintar con `<img src>`. Hay que bajarlos con el cliente y hacer un
 * `URL.createObjectURL`.
 */
export interface ChatAttachmentView {
  filename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

/** Cita citada en un mensaje, ya resuelta por el backend. */
export interface BookingContextView {
  id: number;
  serviceName: string;
  startDateTime: string;
  status: string;
}

export interface ChatMessageResponse {
  id: number;
  side: ChatSide;
  kind: ChatMessageKind;
  body?: string;
  /** Solo llega en la app de negocio: al cliente le habla "el negocio". */
  senderId?: number;
  senderName?: string;
  attachment?: ChatAttachmentView;
  booking?: BookingContextView;
  clientMessageId?: string;
  createdAt: string;
  /** Solo local: burbuja optimista que aún no ha confirmado el servidor. */
  pending?: boolean;
  /** Solo local: el envío falló y se ofrece reintentar. */
  failed?: boolean;
}

export interface ConversationResponse {
  id: number;
  businessId: number;
  customerId: number;
  /** La otra parte vista desde quien pregunta. Lo resuelve el backend. */
  otherPartyName: string;
  otherPartyImageUrl?: string;
  lastMessagePreview?: string;
  lastMessageSide?: ChatSide;
  lastMessageAt?: string;
  unread: number;
  otherLastReadAt?: string;
  otherLastDeliveredAt?: string;
  /**
   * Si se puede escribir AHORA en este hilo.
   *
   * El derecho caduca: sin cita viva ni visita dentro de la ventana, el hilo
   * queda de solo lectura. Lo decide el servidor; la web solo pinta el campo
   * bloqueado en vez de dejar escribir algo que va a rebotar.
   */
  canWrite?: boolean;
  createdAt: string;
}

// ----- LISTA DE ESPERA --------------------

/** El cliente solo llega a ver `WAITING` y `OFFERED`; el resto son finales. */
export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'BOOKED' | 'CANCELED' | 'EXPIRED';

/**
 * En qué punto está un aviso de hueco libre.
 *
 * `LOST` es "se lo quedó otro antes de que respondieras": el hueco nunca se
 * bloquea mientras el aviso está vivo. No cuenta como fallo del cliente.
 */
export type WaitlistOfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'LOST';

/**
 * Franja del día que le vale al cliente.
 *
 * Los cortes son los mismos con los que el paso de hora agrupa los huecos
 * (mañana < 14:00, tarde < 20:00, noche): lo que se elige aquí es exactamente
 * lo que se ve al reservar.
 */
export type TimeBand = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface JoinWaitlistRequest {
  serviceId: number;
  /** Ausente = le vale cualquier profesional. Es lo que más huecos casa. */
  workerId?: number;
  /** `yyyy-MM-dd`. */
  dateFrom: string;
  dateTo: string;
  /** Vacío = cualquier hora. */
  timeBands?: TimeBand[];
  notes?: string;
}

/**
 * Una espera, vista por el cliente que la pidió.
 *
 * **No trae su posición en la lista.** El orden existe y el negocio lo maneja,
 * pero al cliente solo le serviría para desanimarse o para discutir un puesto
 * que no controla.
 */
export interface WaitlistEntry {
  id: number;
  businessId: number;
  businessName: string;
  businessImageUrl?: string;
  serviceId: number;
  serviceName: string;
  serviceDuration: number;
  workerId?: number;
  workerName?: string;
  dateFrom: string;
  dateTo: string;
  timeBands?: TimeBand[];
  notes?: string;
  status: WaitlistStatus;
  resultingBookingId?: number;
}

export interface WaitlistOffer {
  id: number;
  entryId: number;
  businessId: number;
  businessName: string;
  serviceId: number;
  serviceName: string;
  workerId?: number;
  workerName?: string;
  slotStart: string;
  slotEnd: string;
  status: WaitlistOfferStatus;
  /** Instante en UTC. Nunca pasa de la hora de la cita. */
  expiresAt: string;
  priceCents?: number;
  /** Si hay que aceptar la política de cancelación para quedarse el hueco. */
  requiresPolicyConsent: boolean;
  policyText?: string;
  bookingId?: number;
}

/** Cuánto queda del plazo, en milisegundos. Cero o menos = ya vencido. */
export function offerTimeLeftMs(offer: WaitlistOffer): number {
  return new Date(offer.expiresAt).getTime() - Date.now();
}

export function isOfferOpen(offer: WaitlistOffer): boolean {
  return offer.status === 'PENDING' && offerTimeLeftMs(offer) > 0;
}

// ----- PAGOS --------------------

/**
 * Configuración de pagos del cliente.
 *
 * Sin `STRIPE_SECRET_KEY` en el backend responde `enabled: false` y **la web
 * esconde toda la sección** en vez de fallar — mismo criterio que con Firebase,
 * Resend y Google Maps.
 */
export interface PaymentConfig {
  enabled: boolean;
  publishableKey?: string;
}

export interface PaymentMethodResponse {
  id: number;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  /**
   * Si se queda guardada para próximas reservas.
   *
   * En false la tarjeta sigue valiendo para la cita que se está reservando —es
   * la garantía con la que el negocio cobra una cancelación tardía— y se
   * retira sola cuando ninguna cita del cliente pueda ya generar un cargo.
   */
  keepSaved?: boolean;
}

/** "VISA •••• 4242" */
export function cardLabel(method: PaymentMethodResponse): string {
  const brand = (method.brand ?? 'Tarjeta').toUpperCase();
  return method.last4 ? `${brand} •••• ${method.last4}` : brand;
}

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REQUIRES_ACTION' | 'REFUNDED';

export interface PaymentResponse {
  id: number;
  /** `CANCELLATION_FEE`, `RESCHEDULE_FEE` o `NO_SHOW_FEE`. */
  kind: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  description?: string;
  businessId?: number;
  businessName?: string;
  bookingId?: number;
  failureReason?: string;
  /** ⚠️ Es un `Instant`, o sea **UTC** (`…Z`). Hay que pasarlo a hora local. */
  createdAt: string;
}
