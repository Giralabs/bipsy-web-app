import { PageSeo } from '../../core/page-meta.service';
import { APP_STORE_READY, BipsyApp, PLAY_STORE_READY } from '../../data/app-links';

/** `/descargar` and `/descargar/negocio`, naming the stores that are published today. */
export function downloadSeo(app: BipsyApp): PageSeo {
  const where = APP_STORE_READY && PLAY_STORE_READY
    ? 'para iPhone y Android'
    : APP_STORE_READY ? 'para iPhone y iPad' : 'para Android';

  if (app === 'business') {
    return {
      title: 'Bipsy Business, la app para negocios',
      path: '/descargar/negocio',
      description:
        `Descarga Bipsy Business ${where}: la app con la que barberías, peluquerías y ` +
        'centros de estética llevan su agenda y reciben citas de sus clientes.',
    };
  }
  return {
    title: 'Descargar la app',
    path: '/descargar',
    description:
      `Descarga gratis la app de Bipsy ${where} y pide cita en barberías, peluquerías ` +
      'y centros de estética cerca de ti desde el móvil.' +
      (PLAY_STORE_READY ? '' : ' En Android llega muy pronto.'),
  };
}
