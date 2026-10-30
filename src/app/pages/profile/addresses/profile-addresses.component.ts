import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../core/api-error';
import { DialogService } from '../../../core/dialog.service';
import { ToastService } from '../../../core/toast.service';
import { AddressesRepository } from '../../../repositories/addresses.repository';
import {
  AddressFields,
  CustomerAddress,
  addressSubtitle,
  addressTitle,
} from '../../../models/profile-extras.models';
import { ResolvedAddress } from '../../../models/booking-extras.models';
import { AddressStreetFieldComponent } from '../../../components/address-picker/address-street-field.component';

/** El tope del servidor. El botón se apaga aquí y el pie dice por qué. */
const MAX_ADDRESSES = 5;

/**
 * Ajustes → Mis direcciones. Port de `AddressesScreen`.
 *
 * Existe para que reservar a domicilio no obligue a teclear la misma casa cada
 * vez. No cambia ninguna cita: cada reserva se queda con su copia.
 *
 * La calle lleva el buscador de Google, el mismo del flujo de reserva
 * (`app-address-street-field`): elegir de la lista rellena ciudad y código
 * postal y guarda las coordenadas, que son las que dejan avisar al reservar
 * de si el negocio llega hasta allí. Escrita a mano también vale: el servidor
 * acepta la dirección sin coordenadas.
 */
@Component({
  selector: 'app-profile-addresses',
  standalone: true,
  imports: [FormsModule, AddressStreetFieldComponent],
  templateUrl: './profile-addresses.component.html',
  styleUrls: ['../profile-shared.css', '../profile-list.css'],
})
export class ProfileAddressesComponent implements OnInit {
  private readonly repo = inject(AddressesRepository);
  private readonly dialog = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly max = MAX_ADDRESSES;
  readonly title = addressTitle;
  readonly subtitle = addressSubtitle;

  items: CustomerAddress[] = [];
  loading = true;
  loadError = false;

  // ----- HOJA --------------------
  sheetOpen = false;
  /** La que se edita. Null al crear una nueva. */
  editing: CustomerAddress | null = null;
  formLabel = '';
  formStreet = '';
  formDetails = '';
  formPostalCode = '';
  formCity = '';
  formDefault = false;
  /** Lo que dio el buscador. Null en cuanto se teclea la calle a mano. */
  private formResolved: ResolvedAddress | null = null;
  busy = false;
  sheetError: string | null = null;


  get full(): boolean {
    return this.items.length >= MAX_ADDRESSES;
  }

  /** Lo mínimo que pide el servidor: calle y ciudad. */
  get canSave(): boolean {
    return !this.busy && this.formStreet.trim().length > 0 && this.formCity.trim().length > 0;
  }

  /**
   * Solo se puede MARCAR, no desmarcar: dejar al cliente sin ninguna por
   * defecto le haría elegir cada vez sin entender por qué. Se cambia marcando
   * otra.
   */
  get defaultLocked(): boolean {
    return !!this.editing?.isDefault;
  }

  ngOnInit(): void {
    void this.load();
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

  openSheet(a: CustomerAddress | null): void {
    this.editing = a;
    this.formLabel = a?.label ?? '';
    this.formStreet = a?.address.address ?? '';
    this.formDetails = a?.address.details ?? '';
    this.formPostalCode = a?.address.postalCode ?? '';
    this.formCity = a?.address.city ?? '';
    this.formDefault = a?.isDefault ?? false;
    this.formResolved = null;
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

  /** Eligió una sugerencia: trae ciudad y código postal, que se rellenan solos. */
  onResolved(r: ResolvedAddress | null): void {
    this.formResolved = r;
    if (r?.city) this.formCity = r.city;
    if (r?.postalCode) this.formPostalCode = r.postalCode;
  }

  async save(): Promise<void> {
    if (!this.canSave) return;
    // Se parte de la que había para no perder lo que este formulario no pinta
    // (provincia, coordenadas, el sitio de Google) si vino de la app.
    const base: AddressFields = this.editing?.address ?? {};
    const r = this.formResolved;
    // Si cambia la calle, el punto del mapa ya no es suyo: fuera coordenadas.
    // Salvo que la nueva venga del buscador, que trae las suyas.
    const streetChanged = (base.address ?? '').trim() !== this.formStreet.trim();
    const location: Partial<AddressFields> = r
      ? {
          province: r.province ?? null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          placeId: r.placeId ?? null,
        }
      : streetChanged ? { latitude: null, longitude: null, placeId: null } : {};
    const address: AddressFields = {
      ...base,
      oneLine: undefined,
      address: this.formStreet.trim(),
      details: this.formDetails.trim() || null,
      postalCode: this.formPostalCode.trim() || null,
      city: this.formCity.trim(),
      ...location,
    };
    const req = {
      ...(this.formLabel.trim() ? { label: this.formLabel.trim() } : {}),
      isDefault: this.formDefault,
      address,
    };

    this.busy = true;
    this.sheetError = null;
    try {
      if (this.editing) {
        await this.repo.update(this.editing.id, req);
      } else {
        await this.repo.create(req);
      }
      this.busy = false;
      this.sheetOpen = false;
      this.showToast(this.editing ? 'Dirección actualizada' : 'Dirección guardada');
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
      title: '¿Borrar esta dirección?',
      message: 'Tus citas ya hechas no cambian: cada una guarda la suya.',
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
      this.showToast('Dirección borrada');
      await this.load();
    } catch (raw) {
      this.busy = false;
      this.sheetError = messageOf(raw);
    }
  }

  /** El aviso común de la web: el propio de esta pantalla se pintaba aparte. */
  private showToast(text: string): void {
    this.toasts.success(text);
  }
}

function messageOf(raw: unknown): string {
  const error = ApiError.from(raw);
  return error.networkError ? 'Sin conexión. Comprueba tu red.' : error.message;
}
