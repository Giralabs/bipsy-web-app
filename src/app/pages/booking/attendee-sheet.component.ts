import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../core/api-error';
import { CustomerContact } from '../../models/booking-extras.models';
import { BookingExtrasRepository } from '../../repositories/booking-extras.repository';
import { ButtonComponent } from '../../components/button/button.component';

/**
 * ¿Para quién es la cita? Port de `AttendeeSheet`.
 *
 * Hoja y no un paso del flujo: reservar para uno mismo es lo que hace casi todo
 * el mundo, y un paso más sería un clic de peaje para todos.
 *
 * Añadir a alguien que no está en la libreta se hace AQUÍ DENTRO, cambiando el
 * contenido de la hoja, y no abriendo otra encima: nunca dos hojas a la vez. La
 * persona recién creada sale elegida, que es lo que evita volver a buscarla.
 */
@Component({
  selector: 'app-attendee-sheet',
  standalone: true,
  imports: [FormsModule, ButtonComponent],
  templateUrl: './attendee-sheet.component.html',
  styleUrl: './attendee-sheet.component.css',
})
export class AttendeeSheetComponent implements OnInit, AfterViewInit {
  private readonly repo = inject(BookingExtrasRepository);

  /** Quién está elegido ahora. Null = «Mí». */
  @Input() current: CustomerContact | null = null;

  @Output() picked = new EventEmitter<CustomerContact | null>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

  /** Null mientras carga. */
  contacts: CustomerContact[] | null = null;
  loadFailed = false;

  adding = false;
  newName = '';
  saving = false;
  error: string | null = null;

  /** El foco vuelve a donde estaba al cerrar. */
  private readonly returnFocus = document.activeElement as HTMLElement | null;

  async ngOnInit(): Promise<void> {
    try {
      this.contacts = await this.repo.contacts();
    } catch {
      // Con la libreta caída se puede seguir reservando PARA UNO MISMO, que es
      // casi siempre: bloquear por una lista que casi nadie usa no tiene sentido.
      this.contacts = [];
      this.loadFailed = true;
    }
  }

  ngAfterViewInit(): void {
    this.panel?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
    this.returnFocus?.focus?.();
  }

  choose(contact: CustomerContact | null): void {
    this.picked.emit(contact);
    this.returnFocus?.focus?.();
  }

  startAdding(): void {
    this.adding = true;
    this.error = null;
    setTimeout(() => this.nameInput?.nativeElement.focus());
  }

  cancelAdding(): void {
    this.adding = false;
    this.newName = '';
    this.error = null;
  }

  async save(): Promise<void> {
    const name = this.newName.trim();
    if (!name || this.saving) {
      return;
    }
    this.saving = true;
    this.error = null;
    try {
      const created = await this.repo.createContact(name);
      this.choose(created);
    } catch (raw) {
      // El servidor dice por qué —nombre repetido, libreta llena— mejor que
      // cualquier texto genérico de aquí.
      this.error = ApiError.from(raw).message || 'No se ha podido guardar.';
    } finally {
      this.saving = false;
    }
  }
}
