import { LegalDocument, LEGAL_COMPANY } from './legal.models';

/**
 * BORRADOR pendiente de revisión jurídica.
 *
 * El texto cubre la estructura que exigen el RGPD y la LSSI-CE y sirve para
 * tener el flujo de registro completo, pero NO es asesoramiento legal: antes
 * de publicar en producción tiene que revisarlo un abogado y hay que sustituir
 * los marcadores de LEGAL_COMPANY por los datos reales de la sociedad.
 */

const TERMS: LegalDocument = {
  slug: 'terminos',
  title: 'Términos y condiciones',
  subtitle: 'Condiciones de uso de Bipsy para clientes y negocios',
  version: '1.0-borrador',
  updatedAt: '31 de julio de 2026',
  sections: [
    {
      id: 'titular',
      title: '1. Titular del servicio',
      paragraphs: [
        `Bipsy es una plataforma de reservas de servicios titularidad de ${LEGAL_COMPANY.legalName}, ` +
          `con CIF ${LEGAL_COMPANY.taxId} y domicilio en ${LEGAL_COMPANY.address}.`,
        `Puedes contactar con nosotros en ${LEGAL_COMPANY.email}.`,
      ],
    },
    {
      id: 'objeto',
      title: '2. Objeto',
      paragraphs: [
        'Bipsy pone en contacto a personas que buscan servicios de belleza, estética y bienestar ' +
          'con los establecimientos y profesionales que los prestan.',
        'Bipsy es un intermediario tecnológico. El servicio contratado lo presta el negocio, no Bipsy, ' +
          'y es el negocio quien responde de su calidad, sus precios y su cumplimiento.',
      ],
    },
    {
      id: 'cuenta',
      title: '3. Tu cuenta',
      paragraphs: [
        'Para reservar o para gestionar un negocio necesitas una cuenta. Los datos que facilites deben ser ' +
          'veraces y mantenerse actualizados.',
        'Eres responsable de la confidencialidad de tus credenciales y de la actividad que se realice con ellas. ' +
          'Avísanos de inmediato si detectas un uso no autorizado.',
      ],
      bullets: [
        'Debes ser mayor de edad para registrarte.',
        'Una persona no puede tener varias cuentas del mismo tipo sin autorización.',
        'Podemos suspender cuentas que incumplan estas condiciones.',
      ],
    },
    {
      id: 'reservas',
      title: '4. Reservas y cancelaciones',
      paragraphs: [
        'Al confirmar una reserva se genera un compromiso con el negocio. Cada negocio fija su propia ' +
          'política de cancelación y sus plazos, que se te muestran antes de confirmar.',
        'Un negocio puede exigir una tarjeta registrada para aceptar reservas y aplicar una tarifa por ' +
          'cancelación tardía. Esa tarifa nunca podrá superar el 75 % del importe del servicio y solo se ' +
          'aplica si cancelas dentro del plazo que el negocio haya definido.',
        'La tarifa la percibe el negocio. Bipsy solo facilita el cobro.',
      ],
    },
    {
      id: 'negocios',
      title: '5. Obligaciones de los negocios',
      paragraphs: [
        'Si te das de alta como negocio, declaras estar legalmente habilitado para prestar los servicios ' +
          'que publicas y te comprometes a mantener la información veraz.',
      ],
      bullets: [
        'Mantener actualizados horarios, precios y disponibilidad.',
        'Atender las reservas confirmadas o cancelarlas con antelación razonable.',
        'Tratar los datos de tus clientes conforme a la normativa de protección de datos.',
        'No publicar contenido de terceros sobre el que no tengas derechos.',
      ],
    },
    {
      id: 'contenido',
      title: '6. Contenido y valoraciones',
      paragraphs: [
        'Las valoraciones deben responder a una experiencia real y solo pueden dejarlas clientes con una ' +
          'cita finalizada. Podemos retirar contenido ofensivo, falso o que infrinja derechos de terceros.',
      ],
    },
    {
      id: 'responsabilidad',
      title: '7. Responsabilidad',
      paragraphs: [
        'Bipsy no responde de la prestación del servicio contratado, que corresponde al negocio.',
        'Trabajamos para que la plataforma esté siempre disponible, pero no garantizamos que funcione sin ' +
          'interrupciones ni errores. Nada de lo anterior limita los derechos que la ley te reconoce como ' +
          'consumidor.',
      ],
    },
    {
      id: 'modificaciones',
      title: '8. Cambios en estas condiciones',
      paragraphs: [
        'Podemos actualizar estas condiciones. Si el cambio es sustancial te avisaremos y, cuando proceda, ' +
          'te pediremos que las aceptes de nuevo antes de seguir usando el servicio.',
      ],
    },
    {
      id: 'ley',
      title: '9. Ley aplicable',
      paragraphs: [
        'Estas condiciones se rigen por la legislación española. Para cualquier controversia serán ' +
          'competentes los juzgados que correspondan según la normativa de consumidores.',
      ],
    },
  ],
};

const PRIVACY: LegalDocument = {
  slug: 'privacidad',
  title: 'Política de privacidad',
  subtitle: 'Qué datos tratamos, para qué y qué puedes hacer al respecto',
  version: '1.0-borrador',
  updatedAt: '31 de julio de 2026',
  sections: [
    {
      id: 'responsable',
      title: '1. Responsable del tratamiento',
      paragraphs: [
        `${LEGAL_COMPANY.legalName}, CIF ${LEGAL_COMPANY.taxId}, con domicilio en ${LEGAL_COMPANY.address}.`,
        `Para cualquier cuestión sobre tus datos escribe a ${LEGAL_COMPANY.privacyEmail}.`,
      ],
    },
    {
      id: 'datos',
      title: '2. Qué datos tratamos',
      paragraphs: ['Tratamos únicamente los datos necesarios para que el servicio funcione:'],
      bullets: [
        'Identificación y contacto: nombre, correo electrónico y teléfono.',
        'Datos de la cuenta: contraseña cifrada y preferencias de la app.',
        'Datos del negocio: nombre comercial, CIF, dirección y ubicación exacta si la facilitas.',
        'Actividad: reservas, valoraciones y mensajes de soporte.',
        'Datos técnicos: identificador de dispositivo para las notificaciones push.',
      ],
    },
    {
      id: 'finalidad',
      title: '3. Para qué los usamos y con qué base legal',
      paragraphs: [
        'Ejecución del contrato: gestionar tu cuenta, las reservas y la comunicación con el negocio.',
        'Obligación legal: conservar la facturación y atender requerimientos de las autoridades.',
        'Interés legítimo: prevenir el fraude y el abuso de la plataforma, y mejorar el servicio.',
        'Consentimiento: envío de comunicaciones comerciales sobre Bipsy o Giralabs, que es opcional y ' +
          'puedes retirar en cualquier momento sin que afecte al resto del servicio.',
      ],
    },
    {
      id: 'ubicacion',
      title: '4. Ubicación',
      paragraphs: [
        'Si eres un negocio con local, puedes indicar su ubicación exacta para que tus clientes lo ' +
          'encuentren. Esa ubicación es pública dentro de la app.',
        'No rastreamos tu posición en segundo plano en ningún momento.',
      ],
    },
    {
      id: 'cesiones',
      title: '5. Con quién los compartimos',
      paragraphs: [
        'Cuando reservas, el negocio recibe los datos necesarios para atenderte.',
        'Nos apoyamos en proveedores que tratan datos por cuenta nuestra y bajo contrato:',
      ],
      bullets: [
        'Alojamiento de la aplicación y la base de datos.',
        'Envío de correo electrónico transaccional.',
        'Notificaciones push.',
        'Procesamiento de pagos, cuando el negocio exija tarjeta.',
      ],
    },
    {
      id: 'conservacion',
      title: '6. Cuánto tiempo los guardamos',
      paragraphs: [
        'Mientras tu cuenta esté activa. Al eliminarla, anonimizamos tus datos personales y conservamos ' +
          'solo lo que exige la ley durante los plazos legales de prescripción.',
      ],
    },
    {
      id: 'derechos',
      title: '7. Tus derechos',
      paragraphs: [
        'Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, ' +
          `limitación y portabilidad escribiendo a ${LEGAL_COMPANY.privacyEmail}.`,
        'Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia ' +
          'Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      id: 'seguridad',
      title: '8. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas y organizativas para proteger tus datos: las contraseñas se almacenan ' +
          'cifradas, las comunicaciones viajan cifradas y el acceso está restringido al personal que lo necesita.',
      ],
    },
  ],
};

/** Documentos indexados por slug de ruta. */
export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terminos: TERMS,
  privacidad: PRIVACY,
};
