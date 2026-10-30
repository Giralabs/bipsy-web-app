import { Routes } from '@angular/router';
import { ErrorComponent } from './pages/error/error.component';

/**
 * Rutas de la web. **Todas en español**, como el resto de la web.
 *
 * **Cada página se carga en diferido.** Con todo importado de golpe, el bundle
 * inicial crecía con cada pantalla portada de la app y ya se había pasado del
 * presupuesto: quien entra a la portada no tiene por qué descargarse el flujo
 * de reserva, los ajustes y el detalle de una cita antes de ver nada.
 */
export const routes: Routes = [
  // Explorar es la portada: vive en la raíz.
  {
    path: '',
    pathMatch: 'full',
    data: { defaultTitle: true },
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'buscar',
    title: 'Buscar',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
  },
  {
    path: 'negocio/:id',
    loadComponent: () =>
      import('./pages/business-detail/business-detail.component').then(m => m.BusinessDetailComponent),
  },
  // El flujo de reserva es una ruta propia y no un modal: así se puede volver
  // atrás, recargar sin perder el sitio y enlazar "vuelve a reservar" desde
  // Mis citas con el servicio ya elegido.
  {
    path: 'negocio/:id/reservar',
    title: 'Pedir cita',
    loadComponent: () =>
      import('./pages/booking/booking-flow.component').then(m => m.BookingFlowComponent),
  },

  {
    path: 'citas',
    title: 'Mis citas',
    loadComponent: () =>
      import('./pages/appointment-detail/appointments.component').then(m => m.AppointmentsComponent),
  },
  {
    // Singular y a propósito: `citas/:id` es la lista de un usuario con sesión y
    // haría match con el UUID de un token. Esta es la cita que el NEGOCIO le dio
    // a alguien sin app, y el destino del correo con el que la gestiona.
    path: 'cita/:token',
    title: 'Tu cita',
    loadComponent: () =>
      import('./pages/guest-booking/guest-booking.component').then(m => m.GuestBookingComponent),
  },
  // Una cita que te ha dado el negocio y espera que la confirmes. Antes que
  // `citas/:id` para que esa no se la quede.
  {
    path: 'citas/:id/confirmar',
    title: 'Confirma tu cita',
    loadComponent: () =>
      import('./pages/booking-confirm/booking-confirm.component').then(m => m.BookingConfirmComponent),
  },
  // El aviso de un hueco libre de la lista de espera.
  {
    path: 'lista-espera/oferta/:id',
    title: 'Hueco libre',
    loadComponent: () =>
      import('./pages/waitlist-offer/waitlist-offer.component').then(m => m.WaitlistOfferComponent),
  },
  {
    path: 'citas/:id',
    title: 'Tu cita',
    loadComponent: () =>
      import('./pages/appointment-detail/booking-detail.component').then(m => m.BookingDetailComponent),
  },
  {
    path: 'citas/:id/cambiar',
    title: 'Cambiar la cita',
    loadComponent: () =>
      import('./pages/appointment-detail/reschedule.component').then(m => m.RescheduleComponent),
  },

  {
    path: 'mensajes',
    title: 'Mensajes',
    loadComponent: () => import('./pages/chat/inbox.component').then(m => m.ChatInboxComponent),
  },
  {
    path: 'mensajes/:id',
    title: 'Conversación',
    loadComponent: () => import('./pages/chat/thread.component').then(m => m.ChatThreadComponent),
  },

  {
    path: 'favoritos',
    title: 'Favoritos',
    loadComponent: () =>
      import('./pages/favorites/favorites.component').then(m => m.FavoritesComponent),
  },
  {
    path: 'resenas',
    title: 'Mis reseñas',
    loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
  },
  {
    path: 'pagos',
    title: 'Pagos',
    loadComponent: () => import('./pages/payments/payments.component').then(m => m.PaymentsComponent),
  },
  {
    path: 'ajustes',
    title: 'Ajustes',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
  },

  // Soporte: el ticket y el correo, como la pantalla de la app de cliente.
  {
    path: 'soporte',
    title: 'Soporte',
    loadComponent: () => import('./pages/support/support.component').then(m => m.SupportComponent),
  },

  // Acceso. Pantallas y no un modal, como en la app: el navegador puede
  // guardar la contraseña y el enlace se puede compartir.
  {
    path: 'acceder',
    title: 'Iniciar sesión',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'crear-cuenta',
    title: 'Crear cuenta',
    loadComponent: () =>
      import('./pages/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'recuperar',
    title: 'Recuperar la contraseña',
    loadComponent: () =>
      import('./pages/auth/recover/recover.component').then(m => m.RecoverComponent),
  },
  // La espera de verificación del correo. A ella lleva `SessionService` a
  // quien tiene sesión con el correo sin verificar (`EMAIL_PENDING_PATH`).
  {
    path: 'verificar-correo',
    title: 'Verifica tu email',
    loadComponent: () =>
      import('./pages/auth/email-pending/email-pending.component').then(m => m.EmailPendingComponent),
  },

  // Documentos legales. La app móvil enlaza aquí desde la casilla de
  // aceptación del registro, así que deben ser accesibles sin sesión.
  { path: 'legal', redirectTo: 'legal/terminos', pathMatch: 'full' },
  {
    path: 'legal/:slug',
    title: 'Información legal',
    loadComponent: () => import('./pages/legal/legal.component').then(m => m.LegalComponent),
  },

  // Invitaciones y descarga. Las abren quienes NO tienen la app: con ella, el
  // enlace abre la app y esta página no llega a cargarse (ver
  // `.well-known/apple-app-site-association`). `/equipo` es de la app de
  // negocio y `/invitacion`, de la de cliente.
  {
    path: 'equipo/:codigo',
    data: { kind: 'team' },
    loadComponent: () => import('./pages/invite/invite.component').then(m => m.InviteComponent),
  },
  {
    path: 'invitacion/:codigo',
    data: { kind: 'customer' },
    loadComponent: () => import('./pages/invite/invite.component').then(m => m.InviteComponent),
  },
  {
    path: 'descargar',
    data: { app: 'customer' },
    loadComponent: () => import('./pages/download/download.component').then(m => m.DownloadComponent),
  },
  {
    path: 'descargar/negocio',
    data: { app: 'business' },
    loadComponent: () => import('./pages/download/download.component').then(m => m.DownloadComponent),
  },

  // La puerta del equipo durante un mantenimiento. Sin mantenimiento pinta la
  // página no encontrada: es una dirección que, para el público, no existe.
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
  },

  // Página de error: `?tipo=inesperado|conexion|version` y `?desde=` para
  // volver. ⚠️ Es la única que NO se carga en diferido, y a propósito: se
  // enseña justo cuando no se ha podido descargar otra página, así que no
  // puede depender de una descarga.
  { path: 'error', component: ErrorComponent },

  // ── Direcciones antiguas, en inglés ──
  // Redirigen a las nuevas para que no se rompa ningún enlace ya compartido,
  // guardado en favoritos del navegador o enviado en un aviso push.
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'search', redirectTo: 'buscar', pathMatch: 'full' },
  { path: 'business/:id', redirectTo: 'negocio/:id', pathMatch: 'full' },
  { path: 'business/:id/reservar', redirectTo: 'negocio/:id/reservar', pathMatch: 'full' },
  { path: 'appointments', redirectTo: 'citas', pathMatch: 'full' },
  { path: 'appointments/:id', redirectTo: 'citas/:id', pathMatch: 'full' },
  { path: 'appointments/:id/cambiar', redirectTo: 'citas/:id/cambiar', pathMatch: 'full' },
  { path: 'profile', redirectTo: 'ajustes', pathMatch: 'full' },

  // Lo que no es ninguna de las anteriores no existe, y se dice. Antes
  // redirigía a la portada, y un enlace roto parecía funcionar.
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
