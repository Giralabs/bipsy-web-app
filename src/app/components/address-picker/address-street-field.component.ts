import { Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlaceSuggestion, ResolvedAddress } from '../../models/booking-extras.models';
import { BookingExtrasRepository } from '../../repositories/booking-extras.repository';

/**
 * La fila «Dirección» con el buscador de Google (`/places`) debajo.
 *
 * Sale del paso «¿Dónde te atendemos?», que era el único que lo tenía, para
 * que la libreta del perfil y el aviso de lista de espera usen el MISMO
 * buscador: tres copias del debounce, el token de sesión y el teclado del
 * desplegable acabarían comportándose cada una a su manera.
 *
 * Es una fila más dentro de un `.form-group__box`: se coloca entre las otras y
 * las sugerencias empujan a las de debajo. Un desplegable flotante quedaba
 * recortado por el `overflow: hidden` del bloque.
 *
 * El buscador necesita sesión —cada consulta gasta cuota de pago—. Sin ella
 * (`searchEnabled` a false) la fila es un campo normal y se escribe a mano.
 */
@Component({
  selector: 'app-address-street-field',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './address-street-field.component.html',
  styleUrl: './address-street-field.component.css',
})
export class AddressStreetFieldComponent implements OnDestroy {
  private readonly repo = inject(BookingExtrasRepository);

  @Input() value = '';
  @Input() inputId = `street-${randomId()}`;
  @Input() label = 'Dirección';
  @Input() placeholder = 'Calle y número';
  @Input() disabled = false;
  @Input() searchEnabled = true;
  /** Etiqueta encima del campo, como en las hojas del perfil. */
  @Input() stacked = false;

  /** Lo que hay escrito, tecla a tecla y también al elegir una sugerencia. */
  @Output() valueChange = new EventEmitter<string>();
  /**
   * Lo que dio el buscador al elegir, o null en cuanto se teclea a mano: las
   * coordenadas de la elegida serían las de otra dirección.
   */
  @Output() resolved = new EventEmitter<ResolvedAddress | null>();

  suggestions: PlaceSuggestion[] = [];
  active = -1;
  readonly listboxId = `street-suggest-${randomId()}`;

  private sessionToken = newToken();
  private searchTimer?: ReturnType<typeof setTimeout>;
  private blurTimer?: ReturnType<typeof setTimeout>;
  private searchSeq = 0;

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.blurTimer);
  }

  get expanded(): boolean {
    return this.suggestions.length > 0;
  }

  optionId(i: number): string {
    return `${this.listboxId}-${i}`;
  }

  onInput(text: string): void {
    this.value = text;
    this.valueChange.emit(text);
    this.resolved.emit(null);
    this.scheduleSearch();
  }

  onKey(event: KeyboardEvent): void {
    if (!this.expanded) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active = (this.active + 1) % this.suggestions.length;
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active = this.active <= 0 ? this.suggestions.length - 1 : this.active - 1;
        break;
      case 'Enter':
        if (this.active >= 0) {
          event.preventDefault();
          void this.pick(this.suggestions[this.active]);
        }
        break;
      case 'Escape':
        // Escape cierra primero el desplegable y NADA MÁS: sin cortarlo aquí,
        // la hoja que contiene el campo lo oía también y se cerraba entera.
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
    }
  }

  /** Se cierra al salir del campo, con margen para que llegue el clic. */
  onBlur(): void {
    clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => this.close(), 150);
  }

  async pick(s: PlaceSuggestion): Promise<void> {
    this.close();
    this.value = s.mainText;
    this.valueChange.emit(s.mainText);
    const token = this.sessionToken;
    // La sesión de Google se cierra al elegir: la siguiente búsqueda es otra.
    this.sessionToken = newToken();
    try {
      const r = await this.repo.placeDetails(s.placeId, token);
      const street = r.address?.trim() || s.mainText;
      this.value = street;
      this.valueChange.emit(street);
      this.resolved.emit(r);
    } catch {
      // Sin detalle se queda lo escrito: la ciudad la pone el cliente.
      this.resolved.emit(null);
    }
  }

  private close(): void {
    this.suggestions = [];
    this.active = -1;
  }

  private scheduleSearch(): void {
    clearTimeout(this.searchTimer);
    const query = this.value.trim();
    if (!this.searchEnabled || query.length < 3) {
      this.searchSeq++;
      this.close();
      return;
    }
    this.searchTimer = setTimeout(async () => {
      const seq = ++this.searchSeq;
      try {
        const found = await this.repo.autocomplete(query, this.sessionToken);
        // Solo la última: una respuesta lenta no pisa a la que ya llegó.
        if (seq === this.searchSeq) {
          this.suggestions = found.slice(0, 5);
          this.active = -1;
        }
      } catch {
        if (seq === this.searchSeq) {
          this.close();
        }
      }
    }, 300);
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
