import { Component, Input } from '@angular/core';

/**
 * La columna de la izquierda de Entrar, Crear cuenta y Recuperar, solo en
 * escritorio.
 *
 * En el móvil estas pantallas son las de la app: el formulario y nada más. En
 * un monitor eso dejaba una columna de 480 px perdida en el centro de la
 * pantalla; aquí se cuenta en tres líneas para qué sirve la cuenta, con Bip,
 * sin adornos: el formulario sigue siendo lo importante.
 */
@Component({
  selector: 'app-auth-aside',
  standalone: true,
  template: `
    <aside class="aa" aria-label="Qué puedes hacer con tu cuenta">
      <img class="aa__bip" src="assets_web/bip-booking.webp" alt="" width="320" height="320" loading="lazy" decoding="async" />
      <h2 class="aa__title">{{ title }}</h2>
      <ul class="aa__list">
        <li><span class="material-symbols-rounded" aria-hidden="true">bolt</span>Pide cita en segundos, sin llamar ni esperar respuesta.</li>
        <li><span class="material-symbols-rounded" aria-hidden="true">event_repeat</span>Cambia o cancela desde Mis citas, con el plazo a la vista.</li>
        <li><span class="material-symbols-rounded" aria-hidden="true">chat_bubble</span>Escribe al negocio por el chat cuando te haga falta.</li>
        <li><span class="material-symbols-rounded" aria-hidden="true">devices</span>La misma cuenta en la web y en la app.</li>
      </ul>
    </aside>
  `,
  styles: [`
    :host { display: contents; }
    .aa {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      padding: 40px 44px;
      border-radius: var(--r-xxl);
      background: var(--clr-surface);
    }
    .aa__bip { width: 168px; height: auto; margin-bottom: 4px; }
    .aa__title {
      font-family: var(--ff-display);
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -1px;
    }
    .aa__list { display: flex; flex-direction: column; gap: 14px; margin: 6px 0 0; padding: 0; list-style: none; }
    .aa__list li {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 0.9375rem;
      font-weight: 500;
      line-height: 1.45;
      color: var(--clr-text-2);
    }
    /* Icono gris suelto, como el resto de la web. */
    .aa__list .material-symbols-rounded { flex: 0 0 auto; font-size: 22px; color: var(--clr-text-3); }
  `],
})
export class AuthAsideComponent {
  @Input() title = 'Tus citas, en un solo sitio';
}
