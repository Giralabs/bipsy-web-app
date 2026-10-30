import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../core/api-error';
import { DialogService } from '../../../core/dialog.service';
import { ContactsRepository } from '../../../repositories/contacts.repository';
import { CustomerContact } from '../../../models/profile-extras.models';

/**
 * Tope por cuenta. El mismo número que aplica el servidor
 * (`CustomerContactService.MAX_CONTACTS`): el botón se apaga aquí y el pie lo
 * explica, en vez de dejar que el error llegue después de teclear un nombre.
 */
const MAX_PEOPLE = 10;

/**
 * Ajustes → Mis personas. Port de `PeopleScreen`.
 *
 * Para que reservarle a tu madre no obligue a escribir su nombre cada vez. La
 * cita sigue siendo del titular de la cuenta —su tarjeta, su política—; lo
 * único que cambia es que el negocio sabe quién se va a presentar. Y la cita
 * se queda con el nombre COPIADO: borrar a alguien de aquí no la toca.
 */
@Component({
  selector: 'app-profile-people',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile-people.component.html',
  styleUrls: ['../profile-shared.css', '../profile-list.css'],
})
export class ProfilePeopleComponent implements OnInit, OnDestroy {
  private readonly repo = inject(ContactsRepository);
  private readonly dialog = inject(DialogService);

  readonly max = MAX_PEOPLE;

  items: CustomerContact[] = [];
  loading = true;
  loadError = false;

  sheetOpen = false;
  editing: CustomerContact | null = null;
  formName = '';
  busy = false;
  sheetError: string | null = null;

  toast: string | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  get full(): boolean {
    return this.items.length >= MAX_PEOPLE;
  }

  /** Sin nombre el servidor lo rechaza: el botón se apaga antes. */
  get canSave(): boolean {
    return !this.busy && this.formName.trim().length > 0;
  }

  ngOnInit(): void {
    void this.load();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = false;
    try {
      this.items = await this.repo.mine();
    } catch {
      this.loadError = true;
    } finally {
      this.loading = false;
    }
  }

  openNew(): void {
    if (this.full) return;
    this.openSheet(null);
  }

  openSheet(p: CustomerContact | null): void {
    this.editing = p;
    this.formName = p?.name ?? '';
    this.sheetError = null;
    this.busy = false;
    this.sheetOpen = true;
  }

  closeSheet(): void {
    if (this.busy) return;
    this.sheetOpen = false;
  }

  /** Escape cierra la hoja, como cualquier diálogo. Sin guardar. */
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    // Con el diálogo de borrar encima, Escape es suyo: lo cierra y marca el
    // evento como atendido (preventDefault), así que aquí no se toca la hoja.
    if (this.sheetOpen && !event.defaultPrevented && !this.dialog.current()) this.closeSheet();
  }

  async save(): Promise<void> {
    const name = this.formName.trim();
    if (!this.canSave) return;
    this.busy = true;
    this.sheetError = null;
    try {
      if (this.editing) {
        await this.repo.update(this.editing.id, name);
      } else {
        await this.repo.create(name);
      }
      this.busy = false;
      this.sheetOpen = false;
      this.showToast(this.editing ? 'Persona actualizada' : 'Persona guardada');
      await this.load();
    } catch (raw) {
      this.busy = false;
      this.sheetError = messageOf(raw);
    }
  }

  async remove(): Promise<void> {
    const target = this.editing;
    if (!target || this.busy) return;
    const ok = await this.dialog.confirm({
      title: `¿Borrar a ${target.name}?`,
      // Lo que de verdad preocupa al borrar: no se pierde ninguna cita.
      message: 'Las citas que ya le has pedido no cambian.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;

    this.busy = true;
    this.sheetError = null;
    try {
      await this.repo.delete(target.id);
      this.busy = false;
      this.sheetOpen = false;
      this.showToast('Persona borrada');
      await this.load();
    } catch (raw) {
      this.busy = false;
      this.sheetError = messageOf(raw);
    }
  }

  private showToast(text: string): void {
    this.toast = text;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 2600);
  }
}

function messageOf(raw: unknown): string {
  const error = ApiError.from(raw);
  return error.networkError ? 'Sin conexión. Comprueba tu red.' : error.message;
}
