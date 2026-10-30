import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BookingRepository } from '../../repositories/booking.repository';
import { ApiError } from '../../core/api-error';
import { SessionService, SessionStatus } from '../../core/session.service';
import { PushService } from '../../core/push.service';
import { SocialAuthService, SocialSignInCancelled, socialMessageFor } from '../../core/social-auth.service';
import { shrinkImage } from '../../shared/image-resize';
import { MeRepository } from '../../repositories/me.repository';
import { NotificationPrefsRepository } from '../../repositories/notification-prefs.repository';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { confirmPhone } from '../../shared/confirm-phone';
import { newPasswordError } from '../../shared/password-policy';
import { PasswordRulesComponent } from '../../shared/password-rules.component';
import { UserProfileDto } from '../../models/bipsy.models';
import { CUSTOMER_NOTIF_KEYS } from '../../models/profile-extras.models';
import { ButtonComponent } from '../../components/button/button.component';
import { ProfileAddressesComponent } from './addresses/profile-addresses.component';
import { ProfilePeopleComponent } from './people/profile-people.component';

/** Cada apartado de los ajustes. En escritorio se ve uno a la derecha del menú. */
type Section = 'profile' | 'addresses' | 'people' | 'security' | 'notices' | 'help' | 'about' | 'legal' | 'account';

/**
 * Lo que se enseña de la versión, igual que `info_sheets.dart` en la app: no
 * se lee sola, hay que tocarla aquí cuando suba.
 */
const APP_VERSION = '0.1.0';
const APP_PHASE = 'Beta';

/** Estado del permiso de ubicación del navegador. `null` mientras se mira. */
type LocationAccess = 'granted' | 'prompt' | 'denied' | 'unsupported';

interface SectionInfo { id: Section; icon: string; label: string; hint: string }
interface QuickLink { path: string; icon: string; label: string; hint: string }

const SECTIONS: SectionInfo[] = [
  { id: 'profile', icon: 'person', label: 'Editar perfil', hint: 'Foto, nombre y datos de contacto' },
  { id: 'addresses', icon: 'home_work', label: 'Mis direcciones', hint: 'Para reservar a domicilio sin teclearla' },
  { id: 'people', icon: 'group', label: 'Mis personas', hint: 'Para quién pides cita' },
  { id: 'security', icon: 'lock', label: 'Contraseña y sesiones', hint: 'Contraseña, Google y dispositivos' },
  { id: 'notices', icon: 'notifications', label: 'Avisos', hint: 'Notificaciones y correos' },
  { id: 'help', icon: 'help', label: 'Ayuda', hint: 'Preguntas frecuentes' },
  { id: 'about', icon: 'info', label: 'Acerca de Bipsy', hint: 'Versión y documentos' },
  { id: 'legal', icon: 'gavel', label: 'Legal', hint: 'Términos y privacidad' },
  { id: 'account', icon: 'logout', label: 'Cuenta', hint: 'Cerrar sesión o eliminarla' },
];

/**
 * El menú, en bloques como los de la app: lo que es tuyo arriba («Mi
 * cuenta», con las dos libretas junto al perfil porque se buscan en el mismo
 * sitio), luego las preferencias, tu actividad, la información y, sola al
 * final, la salida. Los `links` llevan a otra página; las `sections` se abren
 * a la derecha.
 */
const MENU: { label: string | null; sections: Section[]; links: QuickLink[] }[] = [
  // Los bloques y el orden de `ProfileScreen`: Mi cuenta, Seguridad, General y
  // las salidas. Favoritos se queda en Mi cuenta: la app lo tiene en Explorar y
  // la web no tiene otra puerta fija a esa pantalla.
  {
    label: 'Mi cuenta',
    sections: ['profile'],
    links: [
      { path: '/resenas', icon: 'rate_review', label: 'Reseñas', hint: 'Valora tus visitas' },
      { path: '/favoritos', icon: 'favorite', label: 'Favoritos', hint: 'Tus sitios guardados' },
    ],
  },
  {
    label: null,
    sections: ['addresses', 'people'],
    links: [{ path: '/pagos', icon: 'credit_card', label: 'Pagos', hint: 'Tarjetas y cobros' }],
  },
  { label: 'Seguridad', sections: ['security'], links: [] },
  { label: 'General', sections: ['notices', 'about', 'help', 'legal'], links: [] },
  { label: null, sections: ['account'], links: [] },
];

/**
 * Sin sesión, como `ProfileScreen` con `user == null`: el bloque para entrar y
 * debajo «General», lo que no necesita cuenta. Antes la pantalla se quedaba en
 * un texto y dos botones, sin forma de llegar a Ayuda ni a los textos legales.
 * Avisos no está: en la web sus ajustes viven en la cuenta.
 */
const GUEST_MENU: typeof MENU = [
  { label: 'General', sections: ['about', 'help', 'legal'], links: [] },
];

/** Los apartados que se pueden abrir sin sesión. */
const GUEST_SECTIONS: Section[] = ['about', 'help', 'legal'];

const SECTION_SLUGS: Record<string, Section> = {
  perfil: 'profile',
  direcciones: 'addresses',
  personas: 'people',
  seguridad: 'security',
  avisos: 'notices',
  ayuda: 'help',
  'acerca-de': 'about',
  legal: 'legal',
  cuenta: 'account',
};

/**
 * Los avisos de la cuenta, con el texto de `NotificationsScreen` en la app.
 * Son de la cuenta y no del navegador: lo que se apague aquí deja de sonar
 * también en el móvil.
 */
const NOTIF_ROWS: { key: string; icon: string; title: string; subtitle: string }[] = [
  { key: CUSTOMER_NOTIF_KEYS.bookingStateChange, icon: 'event_note', title: 'Estado de tus citas', subtitle: 'Confirmaciones, cambios y recordatorios.' },
  { key: CUSTOMER_NOTIF_KEYS.chatMessage, icon: 'chat_bubble', title: 'Mensajes', subtitle: 'Cuando el negocio te escribe.' },
  { key: CUSTOMER_NOTIF_KEYS.waitlistOffer, icon: 'event_available', title: 'Huecos libres', subtitle: 'Cuando se libera uno que estabas esperando.' },
  { key: CUSTOMER_NOTIF_KEYS.reviews, icon: 'rate_review', title: 'Valoraciones', subtitle: 'Cuando te pedimos opinión o el negocio te responde.' },
  { key: CUSTOMER_NOTIF_KEYS.waitlistState, icon: 'hourglass_bottom', title: 'Tu lista de espera', subtitle: 'Si tu espera se cubre o se cierra.' },
];

/**
 * Las preguntas de `HelpSheet` en la app, con los caminos de la WEB: allí se
 * llega a todo desde la pestaña Perfil y aquí desde tu foto, y los apartados
 * no se llaman igual («Seguridad», «Cuenta»).
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Cómo reservo una cita',
    a: 'Busca un negocio en Explorar, entra en su ficha y elige el servicio. Después te pedimos día, hora y, si el negocio tiene equipo, con quién quieres ir.',
  },
  {
    q: 'Cómo cancelo o cambio una cita',
    a: 'En Mis citas, abre la que quieras y usa "Cambiar día u hora" o "Cancelar cita". Si el negocio cobra por cancelar tarde, la propia pantalla te dice hasta cuándo es gratis y cuánto costaría después.',
  },
  {
    q: 'Por qué me piden una tarjeta',
    a: 'Algunos negocios la exigen como garantía para aceptar la reserva. No se cobra nada al guardarla: solo sirve si cancelas tarde o no apareces y ese negocio aplica tarifa.',
  },
  {
    q: 'Puedo dejar una reseña',
    a: 'Sí, después de tu cita. Toca tu foto de perfil (arriba a la derecha, o en la barra de abajo en el móvil) y entra en Reseñas, dentro de «Tu actividad». Es una por negocio: si vuelves más adelante podrás actualizarla borrando la anterior.',
  },
  {
    q: 'Cómo cambio mi contraseña',
    a: 'En estos ajustes, en Seguridad. Al cambiarla se cierran tus sesiones en los demás dispositivos; en este sigues dentro. Si entraste con Google, ahí mismo puedes crearte una.',
  },
  {
    q: 'Cómo elimino mi cuenta',
    a: 'En estos ajustes, en Cuenta → Eliminar. Si tu cuenta tiene contraseña, se te pide para confirmar. Tus reservas pasadas se conservan anonimizadas y las futuras se cancelan.',
  },
];

/**
 * Ajustes de la cuenta. Port de `ProfileScreen`.
 *
 * Bloques agrupados como los Ajustes del sistema: el encabezado fuera, las
 * filas dentro y las dos salidas —cerrar sesión y eliminar cuenta— juntas y en
 * rojo al final. Antes eran dos botones a lo ancho y pesaban lo mismo que las
 * acciones que se usan a diario.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, ButtonComponent, ProfileAddressesComponent, ProfilePeopleComponent,
    PasswordRulesComponent,
  ],
  templateUrl: './profile.component.html',
  // Las piezas comunes (tarjetas, filas, interruptor) viven en profile-shared.css
  // porque también las usan los apartados hijos.
  styleUrls: ['./profile-shared.css', './profile.component.css', './profile-mobile.css', './profile-guest.css'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly session = inject(SessionService);
  private readonly meRepo = inject(MeRepository);
  private readonly notifRepo = inject(NotificationPrefsRepository);
  private readonly social = inject(SocialAuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly bookings = inject(BookingRepository);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly subs = new Subscription();

  profile: UserProfileDto | null = null;
  /**
   * Mientras es `unknown` la sesión aún se está comprobando: se pinta un
   * esqueleto. Sin esto, recargar con sesión enseñaba medio segundo la
   * cabecera de «Iniciar sesión» antes de saltar a los ajustes.
   */
  status: SessionStatus = 'unknown';
  section: Section = 'profile';

  get menu(): typeof MENU {
    return this.isAuthenticated ? MENU : GUEST_MENU;
  }

  /**
   * El apartado que se pinta. Sin sesión, uno de cuenta (un enlace guardado a
   * `?apartado=perfil`, el que hay por defecto en escritorio) se queda en
   * Ayuda: sus pantallas leen el perfil y no tienen nada que enseñar.
   */
  get shownSection(): Section {
    return this.isAuthenticated || GUEST_SECTIONS.includes(this.section) ? this.section : 'help';
  }

  /** En móvil, el apartado está abierto encima del menú. */
  get paneOpen(): boolean {
    return this.mobileOpen && (this.isAuthenticated || GUEST_SECTIONS.includes(this.section));
  }
  /** En móvil: el menú, o el apartado abierto encima. En escritorio no cuenta. */
  mobileOpen = false;
  /** Paso de confirmación para eliminar la cuenta. */
  deleteOpen = false;

  readonly faq = FAQ;
  /** La pregunta abierta en Ayuda. */
  openFaq: number | null = 0;

  // Eliminar cuenta
  deletePassword = '';
  deleteConfirmed = false;

  saving = false;
  error: string | null = null;
  notice: string | null = null;

  // Editar perfil. El correo no se edita aquí: el servidor no lo acepta.
  formName = '';
  formPhone = '';
  /** El error de cada campo, debajo de él, como los validadores de la app. */
  nameError: string | null = null;
  phoneError: string | null = null;

  readonly appVersion = `${APP_VERSION} · ${APP_PHASE}`;

  // Ubicación del navegador (bloque «Tu ubicación»).
  locationAccess: LocationAccess | null = null;
  locationAsking = false;
  private locationStatus: PermissionStatus | null = null;
  private readonly onLocationChange = () => {
    this.locationAccess = (this.locationStatus?.state as LocationAccess | undefined) ?? null;
  };

  // ----- FOTO DE PERFIL --------------------
  //
  // Se elige aquí pero **no se sube al elegirla**: la pantalla tiene Guardar y
  // Cancelar, así que la foto espera al mismo botón que el resto. Subirla al
  // vuelo dejaba a Cancelar sin nada que cancelar. Mismo criterio que
  // `AvatarPickerSheet` en la app.
  /** La foto elegida y todavía sin aplicar. */
  private pendingPhoto: File | null = null;
  /** Su vista previa, para pintarla mientras no se guarda. */
  pendingPhotoUrl: string | null = null;
  /** Se ha pedido quitar la que hay. */
  removePhoto = false;

  // Contraseña
  currentPassword = '';
  newPassword = '';
  /** La nueva, otra vez: como `ChangePasswordScreen`, para no fijar una con una errata. */
  repeatPassword = '';

  // Avisos
  newsletterBipsy = false;
  newsletterGiralabs = false;
  pushOn = false;
  pushBusy = false;

  // Avisos de la cuenta (`/me/notification-prefs`). Null mientras cargan.
  readonly notifRows = NOTIF_ROWS;
  private mutedKeys: Set<string> | null = null;
  notifLoading = false;
  notifLoadError = false;
  /** Claves con un guardado en marcha: su interruptor se queda quieto. */
  private notifSaving = new Set<string>();

  // Cuenta de Google. Null mientras no se sabe: la fila no se pinta.
  googleLinked: boolean | null = null;

  // Tus cifras. Null mientras no han llegado: se pinta un guion, no un cero.
  bookingsCount: number | null = null;
  reviewsCount: number | null = null;
  favoritesCount = 0;
  private countsLoaded = false;

  ngOnInit(): void {
    this.subs.add(this.session.status$.subscribe(status => (this.status = status)));
    this.subs.add(this.session.currentUser$.subscribe(user => {
      this.profile = user;
      if (user && !this.saving) {
        this.formName = user.name ?? '';
        this.formPhone = user.phone ?? '';
        if (!this.countsLoaded) {
          this.countsLoaded = true;
          void this.loadCounts();
        }
      }
    }));
    this.subs.add(this.session.favoriteBusinessIds$.subscribe(ids => (this.favoritesCount = ids.length)));

    // El apartado vive en la dirección (/ajustes?apartado=seguridad): un enlace
    // directo lo abre y el atrás del navegador lo cierra.
    this.subs.add(this.route.queryParamMap.subscribe(params => {
      const wanted = SECTION_SLUGS[params.get('apartado') ?? ''];
      if (wanted) {
        this.openSection(wanted);
      } else {
        this.mobileOpen = false;
        this.openedFromMenu = false;
        this.error = null;
        this.notice = null;
      }
    }));
    void this.watchLocation();
  }

  // ----- UBICACIÓN --------------------

  /**
   * Port de `_LocationAccessBlock`. Se escucha el cambio del permiso: si lo
   * concede o lo quita desde el candado de la barra, el bloque no se queda
   * diciendo lo de antes (en la app es volver de los Ajustes del sistema).
   */
  private async watchLocation(): Promise<void> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.locationAccess = 'unsupported';
      return;
    }
    try {
      this.locationStatus = await navigator.permissions.query({ name: 'geolocation' });
      this.onLocationChange();
      this.locationStatus.addEventListener('change', this.onLocationChange);
    } catch {
      // Safari antiguo no tiene `permissions.query` para la ubicación: no se
      // sabe el estado, pero pedirla sigue funcionando.
      this.locationAccess = 'prompt';
    }
  }

  /** Solo cuando aún se puede preguntar: denegada, ya no sale el diálogo. */
  activateLocation(): void {
    if (this.locationAsking || this.locationAccess !== 'prompt') return;
    this.locationAsking = true;
    navigator.geolocation.getCurrentPosition(
      () => {
        this.locationAsking = false;
        this.locationAccess = 'granted';
      },
      error => {
        this.locationAsking = false;
        // Lo que se enseña sale de volver a mirar, nunca de dar por hecho lo
        // que se ha respondido: un fallo de señal no es un «no».
        if (error.code === error.PERMISSION_DENIED) {
          this.locationAccess = 'denied';
        } else if (!this.locationStatus) {
          this.locationAccess = 'prompt';
        } else {
          this.onLocationChange();
        }
      },
      { maximumAge: 300_000, timeout: 15_000 },
    );
  }

  /** Ninguna de las dos puede romper los ajustes: sin cifra, un guion. */
  private async loadCounts(): Promise<void> {
    const [bookings, reviews] = await Promise.allSettled([this.bookings.mine(), this.bookings.myReviews()]);
    this.bookingsCount = bookings.status === 'fulfilled' ? bookings.value.length : null;
    this.reviewsCount = reviews.status === 'fulfilled' ? reviews.value.length : null;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.discardPendingPhoto();
    this.locationStatus?.removeEventListener('change', this.onLocationChange);
  }

  // ----- FOTO DE PERFIL --------------------

  /** Lo que se ve ahora mismo: lo elegido, lo que hay, o nada. */
  get shownPhoto(): string | null {
    if (this.pendingPhotoUrl) {
      return this.pendingPhotoUrl;
    }
    return this.removePhoto ? null : this.profile?.profileImageUrl ?? null;
  }

  /** "Quitar" solo cuando hay algo que quitar. */
  get canRemovePhoto(): boolean {
    return !!this.shownPhoto;
  }

  async onPhotoPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.discardPendingPhoto();
    this.pendingPhoto = await shrinkImage(file);
    this.pendingPhotoUrl = URL.createObjectURL(this.pendingPhoto);
    this.removePhoto = false;
    this.error = null;
  }

  markPhotoForRemoval(): void {
    this.discardPendingPhoto();
    this.removePhoto = true;
  }

  private discardPendingPhoto(): void {
    if (this.pendingPhotoUrl) {
      URL.revokeObjectURL(this.pendingPhotoUrl);
    }
    this.pendingPhoto = null;
    this.pendingPhotoUrl = null;
  }

  get isAuthenticated(): boolean {
    return !!this.profile;
  }

  /**
   * Quien entró con Google no eligió contraseña, pero puede creársela: es lo
   * que le deja entrar también con su correo.
   */
  get passwordRowLabel(): string {
    return this.profile?.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña';
  }

  get currentSection(): SectionInfo {
    return this.info(this.shownSection);
  }

  info(id: Section): SectionInfo {
    return SECTIONS.find(s => s.id === id)!;
  }

  /**
   * Abre un apartado desde el menú. Lo apunta en la dirección (`?apartado=`):
   * en móvil cada apartado es una pantalla, como en la app, y así la flecha de
   * la barra y el atrás del navegador vuelven al menú en vez de salir de
   * Ajustes. En escritorio se reemplaza para no llenar el historial.
   */
  selectSection(section: Section): void {
    const slug = Object.keys(SECTION_SLUGS).find(k => SECTION_SLUGS[k] === section);
    const desktop = typeof window !== 'undefined' && window.innerWidth > 1024;
    this.openedFromMenu = !desktop;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { apartado: slug },
      replaceUrl: desktop,
    });
  }

  /** Lo que de verdad abre el apartado; lo dispara la dirección. */
  private openSection(section: Section): void {
    this.error = null;
    this.notice = null;
    this.section = section;
    this.mobileOpen = true;
    if (section === 'notices') {
      this.pushOn = this.push.state === 'on';
      void this.loadPrivacy();
      void this.loadNotifPrefs();
    }
    if (section === 'security') {
      void this.loadGoogleLink();
    }
    if (section === 'account') {
      this.deletePassword = '';
      this.deleteConfirmed = false;
      this.deleteOpen = false;
    }
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      window.scrollTo({ top: 0 });
    }
  }

  backToMenu(): void {
    // Si se entró desde el menú, atrás es deshacer ese paso; con un enlace
    // directo no hay paso que deshacer y se va al menú sin dejar rastro.
    if (this.openedFromMenu) {
      this.location.back();
      return;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  /** Se entró en el apartado desde el menú, en esta misma visita. */
  private openedFromMenu = false;

  /** Hay cambios del perfil sin guardar: habilita Guardar y Descartar. */
  get profileDirty(): boolean {
    const p = this.profile;
    return !!this.pendingPhoto || this.removePhoto ||
      this.formName.trim() !== (p?.name ?? '') ||
      this.formPhone.trim() !== (p?.phone ?? '');
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/ajustes' } });
  }

  goToRegister(): void {
    this.router.navigate(['/crear-cuenta']);
  }

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  // ----- EDITAR PERFIL --------------------

  /** Los mismos validadores que `EditProfileScreen`, con sus textos. */
  private validateProfile(): boolean {
    const name = this.formName.trim();
    const phone = this.formPhone.trim();
    this.nameError = !name ? 'Introduce tu nombre.' : name.length < 2 ? 'Demasiado corto.' : null;
    this.phoneError = !phone ? 'Introduce tu teléfono.' : phone.length < 6 ? 'Demasiado corto.' : null;
    return !this.nameError && !this.phoneError;
  }

  async saveProfile(): Promise<void> {
    if (this.saving || !this.validateProfile()) {
      return;
    }
    const phone = this.formPhone.trim();
    // Solo cuando ha cambiado: confirmar el de siempre en cada visita al
    // perfil es ruido. Un número mal escrito no lo descubre nadie hasta que
    // el negocio necesita llamar.
    if (phone !== (this.profile?.phone ?? '').trim() && !(await confirmPhone(this.dialog, phone))) {
      return;
    }
    await this.run(async () => {
      await this.meRepo.updateCustomer({
        name: this.formName.trim(),
        phone,
      });

      // La foto va después de los datos y en su propia llamada: son dos
      // endpoints distintos, y si esta falla los datos ya están guardados.
      if (this.pendingPhoto) {
        await this.meRepo.uploadPhoto(this.pendingPhoto);
      } else if (this.removePhoto) {
        await this.meRepo.deletePhoto();
      }

      this.discardPendingPhoto();
      this.removePhoto = false;
      await this.session.refreshProfile();
      this.notice = 'Perfil actualizado.';
    });
  }

  /** Descarta lo tocado: la foto elegida y los campos vuelven a lo guardado. */
  cancelEdit(): void {
    this.discardPendingPhoto();
    this.removePhoto = false;
    this.formName = this.profile?.name ?? '';
    this.formPhone = this.profile?.phone ?? '';
    this.nameError = null;
    this.phoneError = null;
  }

  /**
   * El correo no se cambia aquí, pero hace falta para escribir a soporte o
   * entrar desde otro sitio: tocarlo lo copia, que es lo único útil que puede
   * hacer una fila que no se edita. Port de `GipsiCopyableRow`.
   */
  async copyEmail(): Promise<void> {
    const email = this.profile?.email;
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      this.toast.success('Correo copiado');
    } catch {
      // Sin permiso de portapapeles el correo sigue a la vista y seleccionable.
      this.toast.info('No hemos podido copiarlo. Selecciónalo y cópialo a mano.');
    }
  }

  // ----- CONTRASEÑA --------------------

  async savePassword(): Promise<void> {
    const problem = newPasswordError(
      this.newPassword,
      this.profile?.hasPassword ? 'Introduce una contraseña nueva' : undefined,
    );
    if (problem) {
      this.error = problem;
      return;
    }
    if (this.repeatPassword !== this.newPassword) {
      this.error = 'Las dos contraseñas no coinciden.';
      return;
    }
    await this.run(async () => {
      await this.meRepo.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = '';
      this.newPassword = '';
      this.repeatPassword = '';
      // Quien entró con Google acaba de crearse una: sin releer el perfil, la
      // pantalla seguiría diciendo «Crear contraseña» y sin dejar desvincular.
      await this.session.refreshProfile();
      this.notice = 'Contraseña actualizada.';
    });
  }

  // ----- AVISOS --------------------

  /** Si se puede ofrecer el interruptor de avisos en este navegador. */
  get pushAvailable(): boolean {
    return this.push.isAvailable;
  }

  /** Denegado no se puede deshacer desde aquí: lo cambia el navegador. */
  get pushDenied(): boolean {
    return this.push.state === 'denied';
  }

  async togglePush(): Promise<void> {
    if (this.pushBusy) {
      return;
    }
    this.pushBusy = true;
    this.notice = null;
    try {
      if (this.pushOn) {
        await this.push.disable();
        this.pushOn = false;
      } else {
        this.pushOn = await this.push.enable();
        if (!this.pushOn) {
          this.error = this.pushDenied
            ? 'Has bloqueado los avisos para esta web. Se cambia desde los ajustes del navegador.'
            : 'No hemos podido activar los avisos en este navegador.';
        }
      }
    } finally {
      this.pushBusy = false;
    }
  }

  async loadPrivacy(): Promise<void> {
    await this.run(async () => {
      const settings = await this.meRepo.privacy();
      this.newsletterBipsy = settings.newsletterBipsy;
      this.newsletterGiralabs = settings.newsletterGiralabs;
    });
  }

  /** El endpoint espera el estado completo, no un parche. */
  async savePrivacy(): Promise<void> {
    await this.run(async () => {
      await this.meRepo.updatePrivacy({
        newsletterBipsy: this.newsletterBipsy,
        newsletterGiralabs: this.newsletterGiralabs,
      });
      this.notice = 'Preferencias guardadas.';
    });
  }

  // ----- AVISOS DE LA CUENTA --------------------

  async loadNotifPrefs(): Promise<void> {
    this.notifLoading = true;
    this.notifLoadError = false;
    try {
      const prefs = await this.notifRepo.get();
      this.mutedKeys = new Set(prefs.muted ?? []);
    } catch {
      this.notifLoadError = true;
    } finally {
      this.notifLoading = false;
    }
  }

  get notifReady(): boolean {
    return this.mutedKeys !== null;
  }

  /** Lo que no está apagado, llega: una clave desconocida cuenta como encendida. */
  notifOn(key: string): boolean {
    return !this.mutedKeys?.has(key);
  }

  notifBusy(key: string): boolean {
    return this.notifSaving.has(key);
  }

  /**
   * Cambio optimista y vuelta atrás si falla, como `NotifPrefsController`: un
   * interruptor que tarda medio segundo en moverse se lee como roto y se pulsa
   * dos veces. Se manda solo la clave que cambia.
   */
  async toggleNotif(key: string, enabled: boolean): Promise<void> {
    if (!this.mutedKeys || this.notifSaving.has(key)) return;
    const before = new Set(this.mutedKeys);
    const next = new Set(this.mutedKeys);
    if (enabled) next.delete(key); else next.add(key);
    this.mutedKeys = next;
    this.notifSaving.add(key);
    this.error = null;
    this.notice = null;
    try {
      const saved = await this.notifRepo.update({ [key]: enabled });
      this.mutedKeys = new Set(saved.muted ?? []);
    } catch (raw) {
      this.mutedKeys = before;
      this.error = ApiError.from(raw).networkError
        ? 'Sin conexión. Comprueba tu red.'
        : 'No hemos podido guardar el cambio.';
    } finally {
      this.notifSaving.delete(key);
    }
  }

  // ----- CUENTA DE GOOGLE --------------------

  /**
   * `googleLinked` no viaja en la sesión de la web, así que se pregunta a
   * `/me` al abrir Seguridad. Si falla, la fila simplemente no se pinta.
   */
  private async loadGoogleLink(): Promise<void> {
    try {
      const me = await this.meRepo.me();
      this.googleLinked = !!me.googleLinked;
    } catch {
      this.googleLinked = null;
    }
  }

  /** Vincular solo se ofrece si el acceso con Google está configurado en esta web. */
  get canLinkGoogle(): boolean {
    return this.social.googleAvailable;
  }

  /** El servidor exige el mismo correo; si no coincide, su mensaje lo dice. */
  async linkGoogle(): Promise<void> {
    if (this.saving) return;
    this.error = null;
    this.notice = null;
    let idToken: string;
    try {
      idToken = (await this.social.obtainIdentity('google')).idToken;
    } catch (raw) {
      // Cerrar la ventana de Google no es un fallo que contar.
      if (!(raw instanceof SocialSignInCancelled)) {
        this.error = socialMessageFor(raw, 'google');
      }
      return;
    }
    await this.run(async () => {
      await this.meRepo.linkGoogle(idToken);
      this.googleLinked = true;
      this.notice = 'Cuenta de Google vinculada.';
    });
  }

  /**
   * Sin contraseña propia, desvincular dejaría la cuenta sin forma de entrar:
   * la pantalla no lo ofrece y manda a crear una, que está justo encima.
   */
  async unlinkGoogle(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Desvincular Google',
      message: 'Dejarás de poder entrar con Google. Seguirás accediendo con tu correo y tu contraseña.',
      confirmLabel: 'Desvincular',
      destructive: true,
    });
    if (!ok) return;
    await this.run(async () => {
      await this.meRepo.unlinkGoogle();
      this.googleLinked = false;
      this.notice = 'Cuenta de Google desvinculada.';
    });
  }

  // ----- SALIDAS --------------------

  async revokeAllSessions(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: '¿Cerrar las demás sesiones?',
      message: 'Se cerrará tu sesión en el resto de tus dispositivos. En este sigues dentro.',
      confirmLabel: 'Cerrar sesiones',
    });
    if (!ok) {
      return;
    }
    await this.run(async () => {
      await this.meRepo.revokeAllSessions();
      this.notice = 'Sesiones cerradas en los demás dispositivos.';
    });
  }

  async logout(): Promise<void> {
    // Se da de baja este navegador antes de salir: si no, el siguiente que
    // entre aquí recibiría los avisos del anterior.
    await this.push.disable();
    await this.session.logout();
    this.router.navigate(['/']);
  }

  get canDelete(): boolean {
    return this.deleteConfirmed && (!this.profile?.hasPassword || this.deletePassword.length > 0);
  }

  async deleteAccount(): Promise<void> {
    if (!this.canDelete) {
      return;
    }
    await this.run(async () => {
      await this.meRepo.deleteAccount(this.profile?.hasPassword ? this.deletePassword : undefined);
      this.deletePassword = '';
      await this.push.disable();
      // `logout` limpia en local aunque la llamada falle, que es lo que pasa
      // con una cuenta ya borrada.
      await this.session.logout();
      this.router.navigate(['/']);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.error = null;
    try {
      await action();
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.networkError ? 'Sin conexión. Comprueba tu red.' : error.message;
    } finally {
      this.saving = false;
    }
  }
}
