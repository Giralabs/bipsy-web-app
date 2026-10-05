import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { AppErrorHandler, onNavigationError } from './core/app-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // `anchorScrolling` es lo que hace que un fragmento en la URL lleve de
    // verdad a su apartado. Sin esto, los índices de los documentos legales
    // cambiaban la URL y dejaban la página donde estaba.
    //
    // `withNavigationErrorHandler` recoge la página que no se ha podido
    // descargar —pestaña abierta durante un despliegue— y lleva a `/error` en
    // vez de dejar el enlace sin hacer nada.
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
      withNavigationErrorHandler(onNavigationError),
    ),
    provideHttpClient(withFetch()),
    // Lo mismo, para los `import()` que no pasan por el router. Todo lo demás
    // sigue yendo a la consola y nada más: ver `AppErrorHandler`.
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ]
};
