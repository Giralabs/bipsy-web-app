import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { PushService } from '../../core/push.service';
import { shrinkImage } from '../../shared/image-resize';
import { MeRepository } from '../../repositories/me.repository';
import { UserProfileDto } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { GroupedSectionComponent } from '../../components/grouped-list/grouped-section.component';
import { GroupedRowComponent } from '../../components/grouped-list/grouped-row.component';

/** Qué panel está abierto dentro de los ajustes. */
type Panel = 'none' | 'edit' | 'password' | 'notices';

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
  imports: [CommonModule, FormsModule, ButtonComponent, GroupedSectionComponent, GroupedRowComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly session = inject(SessionService);
  private readonly meRepo = inject(MeRepository);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);

  profile: UserProfileDto | null = null;
  panel: Panel = 'none';

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

  ngOnInit(): void {
    this.session.currentUser$.subscribe(user => {
      this.profile = user;
      if (user) {
        this.formName = user.name ?? '';
        this.formEmail = user.email ?? '';
        this.formPhone = user.phone ?? '';
      }
    });
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
  get passwordRowLabel(): string {
    return this.profile?.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña';
  }

  openPanel(panel: Panel): void {
    this.error = null;
    this.notice = null;
    this.panel = this.panel === panel ? 'none' : panel;
    if (this.panel === 'notices') {
      void this.loadPrivacy();
    }
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/profile' } });
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
      this.panel = 'none';
    });
  }

  /** Cerrar el panel también descarta la foto elegida. */
  cancelEdit(): void {
    this.discardPendingPhoto();
    this.removePhoto = false;
    this.panel = 'none';
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
      this.panel = 'none';
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
    this.router.navigate(['/home']);
  }

  async deleteAccount(): Promise<void> {
    const sure = confirm(
      'Al eliminar la cuenta se borran tus datos y tus reservas. No se puede deshacer. ' +
      '¿Seguro que quieres continuar?',
    );
    if (!sure) {
      return;
    }
    await this.run(async () => {
      await this.meRepo.deleteAccount();
      await this.session.logout();
      this.router.navigate(['/home']);
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
