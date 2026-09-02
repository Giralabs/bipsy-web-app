import { Routes } from '@angular/router';

/**
 * Rutas de la web.
 *
 * **Cada página se carga en diferido.** Con todo importado de golpe, el bundle
 * inicial crecía con cada pantalla portada de la app y ya se había pasado del
 * presupuesto: quien entra a la portada no tiene por qué descargarse el flujo
 * de reserva, los ajustes y el detalle de una cita antes de ver nada.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
  },
  {
    path: 'business/:id',
    loadComponent: () =>
      import('./pages/business-detail/business-detail.component').then(m => m.BusinessDetailComponent),
  },
  // El flujo de reserva es una ruta propia y no un modal: así se puede volver
  // atrás, recargar sin perder el sitio y enlazar "vuelve a reservar" desde
  // Mis citas con el servicio ya elegido.
  {
    path: 'business/:id/reservar',
    loadComponent: () =>
      import('./pages/booking/booking-flow.component').then(m => m.BookingFlowComponent),
  },

  {
    path: 'appointments',
    loadComponent: () =>
      import('./pages/appointment-detail/appointments.component').then(m => m.AppointmentsComponent),
  },
  {
    path: 'appointments/:id',
    loadComponent: () =>
      import('./pages/appointment-detail/booking-detail.component').then(m => m.BookingDetailComponent),
  },
  {
    path: 'appointments/:id/cambiar',
    loadComponent: () =>
      import('./pages/appointment-detail/reschedule.component').then(m => m.RescheduleComponent),
  },

  {
    path: 'mensajes',
    loadComponent: () => import('./pages/chat/inbox.component').then(m => m.ChatInboxComponent),
  },
  {
    path: 'mensajes/:id',
    loadComponent: () => import('./pages/chat/thread.component').then(m => m.ChatThreadComponent),
  },

  {
    path: 'favoritos',
    loadComponent: () =>
      import('./pages/favorites/favorites.component').then(m => m.FavoritesComponent),
  },
  {
    path: 'pagos',
    loadComponent: () => import('./pages/payments/payments.component').then(m => m.PaymentsComponent),
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
  },

  // Acceso. Pantallas y no un modal, como en la app: el navegador puede
  // guardar la contraseña y el enlace se puede compartir.
  {
    path: 'acceder',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'crear-cuenta',
    loadComponent: () =>
      import('./pages/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'recuperar',
    loadComponent: () =>
      import('./pages/auth/recover/recover.component').then(m => m.RecoverComponent),
  },

  // Documentos legales. La app móvil enlaza aquí desde la casilla de
  // aceptación del registro, así que deben ser accesibles sin sesión.
  { path: 'legal', redirectTo: 'legal/terminos', pathMatch: 'full' },
  {
    path: 'legal/:slug',
    loadComponent: () => import('./pages/legal/legal.component').then(m => m.LegalComponent),
  },

  { path: '**', redirectTo: 'home' },
];
