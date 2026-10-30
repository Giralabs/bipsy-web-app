import { Component, ElementRef, HostListener, ViewChild, effect, inject } from '@angular/core';
import { DialogService } from '../../core/dialog.service';

/**
 * El diálogo de confirmación. Se monta una vez en la raíz y pinta lo que pida
 * `DialogService.confirm`.
 *
 * Accesible como `alertdialog`: el foco entra en el botón seguro («Volver»)
 * —un Intro despistado no cancela una cita—, Escape cierra, el tabulador no
 * se escapa al fondo y al cerrar el foco vuelve a donde estaba.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (dialog.current(); as req) {
      <div class="sheet-backdrop" (click)="dialog.settle(false)">
        <div class="sheet cdlg" role="alertdialog" aria-modal="true"
             aria-labelledby="cdlg-title" [attr.aria-describedby]="req.message ? 'cdlg-msg' : null"
             (click)="$event.stopPropagation()" #box>
          <h2 class="sheet__title" id="cdlg-title">{{ req.title }}</h2>
          @if (req.message) {
            <p class="cdlg__msg" id="cdlg-msg">{{ req.message }}</p>
          }
          <div class="cdlg__actions">
            <button type="button" class="cdlg__btn" #safe (click)="dialog.settle(false)">
              {{ req.cancelLabel || 'Volver' }}
            </button>
            <button type="button" class="cdlg__btn cdlg__btn--go" [class.cdlg__btn--danger]="req.destructive"
                    (click)="dialog.settle(true)">
              {{ req.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cdlg { max-width: 400px; padding: 28px 24px 20px; }
    .cdlg__msg {
      margin-top: 10px;
      font-size: 0.9375rem;
      font-weight: 500;
      line-height: 1.55;
      color: var(--clr-text-2);
      text-align: center;
      white-space: pre-line;
    }
    .cdlg__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 24px; }
    .cdlg__btn {
      height: 50px;
      border: none;
      border-radius: var(--r-xl);
      background: var(--clr-field);
      color: var(--clr-text);
      font-family: var(--ff);
      font-size: 0.9375rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color .2s ease, transform .12s ease;
    }
    .cdlg__btn:hover { background: var(--clr-subtle); }
    .cdlg__btn:active { transform: scale(.97); }
    .cdlg__btn--go { background: var(--clr-mint); color: var(--clr-mint-text); }
    .cdlg__btn--go:hover { background: var(--clr-mint-hover); }
    .cdlg__btn--danger { background: var(--clr-danger); color: #fff; }
    .cdlg__btn--danger:hover { background: #d35f5f; }
  `],
})
export class ConfirmDialogComponent {
  readonly dialog = inject(DialogService);

  @ViewChild('safe') private safe?: ElementRef<HTMLButtonElement>;
  @ViewChild('box') private box?: ElementRef<HTMLElement>;

  /** Donde estaba el foco al abrirse, para devolverlo al cerrar. */
  private returnFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.dialog.current()) {
        this.returnFocus = document.activeElement as HTMLElement | null;
        setTimeout(() => this.safe?.nativeElement.focus());
      } else if (this.returnFocus) {
        this.returnFocus.focus?.();
        this.returnFocus = null;
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.dialog.current()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dialog.settle(false);
      return;
    }
    // El tabulador da vueltas dentro del diálogo.
    if (event.key === 'Tab' && this.box) {
      const buttons = Array.from(this.box.nativeElement.querySelectorAll('button'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
