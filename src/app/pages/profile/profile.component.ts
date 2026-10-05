import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BookingRepository } from '../../repositories/booking.repository';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { PushService } from '../../core/push.service';
import { shrinkImage } from '../../shared/image-resize';
import { MeRepository } from '../../repositories/me.repository';
import { UserProfileDto } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';

/** Cada apartado de los ajustes. En escritorio se ve uno a la derecha del menú. */
type Section = 'profile' | 'security' | 'notices' | 'help' | 'legal' | 'account';

const SECTIONS: { id: Section; icon: string; label: string; hint: string }[] = [
  { id: 'profile', icon: 'person', label: 'Perfil', hint: 'Foto, nombre y datos de contacto' },
  { id: 'security', icon: 'lock', label: 'Seguridad', hint: 'Contraseña y sesiones' },
  { id: 'notices', icon: 'notifications', label: 'Avisos', hint: 'Notificaciones y novedades' },
  { id: 'help', icon: 'help', label: 'Ayuda', hint: 'Preguntas frecuentes' },
  { id: 'legal', icon: 'gavel', label: 'Legal', hint: 'Términos y privacidad' },
  { id: 'account', icon: 'manage_accounts', label: 'Cuenta', hint: 'Cerrar sesión o eliminarla' },
];

const SECTION_SLUGS: Record<string, Section> = {
  perfil: 'profile',
  seguridad: 'security',
  avisos: 'notices',
  ayuda: 'help',
  legal: 'legal',
  cuenta: 'account',
};

/** Las preguntas de `HelpSheet` en la app, con el mismo texto. */
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
    a: 'Sí, después de tu cita, desde Ajustes → Reseñas. Es una por negocio: si vuelves más adelante podrás actualizarla borrando la anterior.',
  },
  {
    q: 'Cómo cambio mi contraseña',
    a: 'Ajustes → Cambiar contraseña. Al cambiarla se cierran tus sesiones en los demás dispositivos; en este sigues dentro.',
  },
  {
    q: 'Cómo elimino mi cuenta',
    a: 'Ajustes → Eliminar cuenta. Se te pide la contraseña. Tus reservas pasadas se conservan anonimizadas y las futuras se cancelan.',
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
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly session = inject(SessionService);
  private readonly meRepo = inject(MeRepository);
  private readonly bookings = inject(BookingRepository);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  profile: UserProfileDto | null = null;
  readonly sections = SECTIONS;
  section: Section = 'profile';
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

  // Editar perfil
  formName = '';
  formEmail = '';
  formPhone = '';

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

  // Avisos
  newsletterBipsy = false;
  newsletterGiralabs = false;
  pushOn = false;
  pushBusy = false;

  // Tus cifras. Null mientras no han llegado: se pinta un guion, no un cero.
  bookingsCount: number | null = null;
  reviewsCount: number | null = null;
  favoritesCount = 0;
  private countsLoaded = false;

  readonly quickLinks = [
    { path: '/citas', icon: 'event', label: 'Mis citas', hint: 'Próximas y pasadas' },
    { path: '/favoritos', icon: 'favorite', label: 'Favoritos', hint: 'Tus sitios guardados' },
    { path: '/resenas', icon: 'star', label: 'Reseñas', hint: 'Valora tus visitas' },
    { path: '/pagos', icon: 'credit_card', label: 'Pagos', hint: 'Tarjetas y cobros' },
  ];

  ngOnInit(): void {
    this.session.currentUser$.subscribe(user => {
      this.profile = user;
      if (user && !this.saving) {
        this.formName = user.name ?? '';
        this.formEmail = user.email ?? '';
        this.formPhone = user.phone ?? '';
        if (!this.countsLoaded) {
          this.countsLoaded = true;
          void this.loadCounts();
        }
      }
    });
    this.session.favoriteBusinessIds$.subscribe(ids => (this.favoritesCount = ids.length));

    // Enlace directo a un apartado: /profile?apartado=seguridad
    const wanted = SECTION_SLUGS[this.route.snapshot.queryParamMap.get('apartado') ?? ''];
    if (wanted) {
      this.selectSection(wanted);
    }
  }

  /** Ninguna de las dos puede romper los ajustes: sin cifra, un guion. */
  private async loadCounts(): Promise<void> {
    const [bookings, reviews] = await Promise.allSettled([this.bookings.mine(), this.bookings.myReviews()]);
    this.bookingsCount = bookings.status === 'fulfilled' ? bookings.value.length : null;
    this.reviewsCount = reviews.status === 'fulfilled' ? reviews.value.length : null;
  }

  ngOnDestroy(): void {
    this.discardPendingPhoto();
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
  get hasLetter(): boolean {
    return /[a-zA-Z]/.test(this.newPassword);
  }

  get hasDigit(): boolean {
    return /\d/.test(this.newPassword);
  }

  get passwordRowLabel(): string {
    return this.profile?.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña';
  }

  get currentSection(): { id: Section; icon: string; label: string; hint: string } {
    return SECTIONS.find(s => s.id === this.section)!;
  }

  /** Abre un apartado. En móvil, además, pasa del menú al contenido. */
  selectSection(section: Section): void {
    this.error = null;
    this.notice = null;
    this.section = section;
    this.mobileOpen = true;
    if (section === 'notices') {
      this.pushOn = this.push.state === 'on';
      void this.loadPrivacy();
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
    this.mobileOpen = false;
    this.error = null;
    this.notice = null;
  }

  /** Hay cambios del perfil sin guardar: habilita Guardar y Descartar. */
  get profileDirty(): boolean {
    const p = this.profile;
    return !!this.pendingPhoto || this.removePhoto ||
      this.formName.trim() !== (p?.name ?? '') ||
      this.formEmail.trim() !== (p?.email ?? '') ||
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

  async saveProfile(): Promise<void> {
    await this.run(async () => {
      await this.meRepo.updateCustomer({
        name: this.formName.trim(),
        email: this.formEmail.trim(),
        phone: this.formPhone.trim(),
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
    this.formEmail = this.profile?.email ?? '';
    this.formPhone = this.profile?.phone ?? '';
  }

  // ----- CONTRASEÑA --------------------

  async savePassword(): Promise<void> {
    if (this.newPassword.length < 8 || !/[a-zA-Z]/.test(this.newPassword) || !/\d/.test(this.newPassword)) {
      this.error = 'Al menos 8 caracteres, con letras y números.';
      return;
    }
    await this.run(async () => {
      await this.meRepo.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = '';
      this.newPassword = '';
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

  // ----- SALIDAS --------------------

  async revokeAllSessions(): Promise<void> {
    if (!confirm('Se cerrará la sesión en el resto de tus dispositivos. ¿Continuamos?')) {
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
