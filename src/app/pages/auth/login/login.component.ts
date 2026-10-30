import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../../core/session.service';
import { SocialAuthService } from '../../../core/social-auth.service';
import { AuthAsideComponent } from '../auth-aside.component';
import { LoginFormComponent } from '../../../components/login-form/login-form.component';

/**
 * Pantalla de acceso. Port de `LoginScreen`.
 *
 * La marca arriba: esta es la puerta de casa y se agradece verla, pero el
 * trabajo de la pantalla son dos campos y un botón, y eso lo hace
 * `app-login-form` — el mismo formulario que usa el paso de entrada de la
 * reserva. Aquí solo quedan la marca y a dónde ir después.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AuthAsideComponent, LoginFormComponent],
  templateUrl: './login.component.html',
  styleUrl: '../auth-layout.css',
})
export class LoginComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly social = inject(SocialAuthService);

  /** Correo ya conocido, para no hacerlo escribir dos veces. */
  email = '';
  notice: string | null = null;
  subtitle: string | null = null;

  /** A dónde ir al entrar. Público: lo lee también el enlace de crear cuenta. */
  returnTo = '/';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    // Quien escribe su correo para registrarse y resulta que ya tiene cuenta
    // no debería tener que volver a escribirlo aquí.
    this.email = params['email'] ?? '';
    this.returnTo = params['returnTo'] ?? this.session.takeReturnTo() ?? '/';
    if (params['changed']) {
      this.notice = 'Contraseña cambiada. Ya puedes entrar con ella.';
    }
    // Viene del alta con un correo de una cuenta de Google, que no tiene
    // contraseña: se avisa en vez de dejarle pelearse con una que nunca eligió.
    if (params['google'] === '1') {
      this.subtitle = this.social.googleAvailable
        ? 'Esta cuenta entra con Google. Usa el botón de abajo.'
        : 'Esta cuenta se creó con Google y no tiene contraseña. Entra con Google desde la app de Bipsy.';
    }
  }

  onSignedIn(): void {
    this.router.navigateByUrl(this.returnTo);
  }
}
