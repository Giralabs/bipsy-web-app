import { Component, Input } from '@angular/core';
import { PASSWORD_MIN_LENGTH, checkPassword } from './password-policy';

/**
 * Las reglas de la contraseña con su tick, para colgar debajo del campo.
 * Port de `PasswordRules` / `GipsiPasswordRules`.
 *
 * Se enseñan mientras se escribe: así se ve qué falta sin tener que intentarlo
 * y fallar. «Evita las muy comunes» solo se marca en verde cuando ya hay algo
 * escrito: en un campo vacío no hay nada que celebrar.
 */
@Component({
  selector: 'app-password-rules',
  standalone: true,
  template: `
    <ul class="pw-rules" aria-label="Requisitos de la contraseña">
      @for (rule of rules; track rule.label) {
        <li class="pw-rule" [class.pw-rule--ok]="rule.ok">
          <span class="material-symbols-rounded" aria-hidden="true">{{ rule.ok ? 'check_circle' : 'radio_button_unchecked' }}</span>
          {{ rule.label }}
          <span class="sr-only">{{ rule.ok ? '(cumplido)' : '(pendiente)' }}</span>
        </li>
      }
    </ul>
  `,
  styles: [`
    .pw-rules { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 10px 0 0; padding: 0 4px; list-style: none; }
    .pw-rule {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--clr-text-3);
      transition: color .15s ease;
    }
    .pw-rule .material-symbols-rounded { font-size: 17px; }
    .pw-rule--ok { color: var(--clr-success); }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
  `],
})
export class PasswordRulesComponent {
  @Input() password = '';

  get rules(): { label: string; ok: boolean }[] {
    const check = checkPassword(this.password);
    return [
      { label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, ok: check.hasMinLength },
      { label: 'Combina letras y números', ok: check.hasLetterAndDigit },
      { label: 'Evita contraseñas muy comunes', ok: !!this.password && !check.isCommon },
    ];
  }
}
