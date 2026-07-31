import { LegalDocument, LEGAL_COMPANY } from './legal.models';

/**
 * BORRADOR pendiente de revisión jurídica.
 *
 * El texto cubre la estructura que exigen el RGPD y la LSSI-CE y sirve para
 * tener el flujo de registro completo, pero NO es asesoramiento legal: antes
 * de publicar en producción tiene que revisarlo un abogado y hay que rellenar
 * el CIF y el domicilio en LEGAL_COMPANY.
 *
 * La numeración de los títulos va escrita a mano. Si insertas una sección en
 * medio, renumera las siguientes: el índice de la página se genera a partir de
 * estos títulos y quedaría descuadrado.
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
        'Bipsy es el nombre comercial con el que se presta el servicio, tanto en esta web como en las ' +
          'aplicaciones móviles Bipsy y Bipsy Business.',
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
      id: 'propiedad',
      title: '7. Propiedad intelectual',
      paragraphs: [
        `La aplicación, su código, su diseño, la marca Bipsy y los demás signos distintivos pertenecen a ` +
          `${LEGAL_COMPANY.legalName}. Poder usar el servicio no te da ningún derecho sobre ellos.`,
        'El contenido que subes (fotos del local, descripciones de servicios, valoraciones) sigue siendo ' +
          'tuyo. Al publicarlo nos autorizas a mostrarlo dentro de la plataforma y a usarlo para promocionar ' +
          'tu ficha, mientras lo mantengas publicado.',
      ],
    },
    {
      id: 'baja',
      title: '8. Suspensión y baja',
      paragraphs: [
        'Puedes darte de baja cuando quieras desde tu perfil. La baja no cancela por sí sola las citas ya ' +
          'confirmadas: gestiónalas antes o quedarán sujetas a la política de cancelación del negocio.',
        'Podemos suspender o cerrar una cuenta que incumpla estas condiciones, que suplante a otra persona ' +
          'o que use la plataforma de forma fraudulenta. Salvo que el incumplimiento sea grave, avisaremos ' +
          'antes y daremos margen para corregirlo.',
      ],
    },
    {
      id: 'responsabilidad',
      title: '9. Responsabilidad',
      paragraphs: [
        'Bipsy no responde de la prestación del servicio contratado, que corresponde al negocio.',
        'Trabajamos para que la plataforma esté siempre disponible, pero no garantizamos que funcione sin ' +
          'interrupciones ni errores. Nada de lo anterior limita los derechos que la ley te reconoce como ' +
          'consumidor.',
      ],
    },
    {
      id: 'consumidores',
      title: '10. Consumidores y reclamaciones',
      paragraphs: [
        'Si contratas como consumidor, conservas todos los derechos que te reconoce la normativa de ' +
          'consumidores y usuarios.',
        'Ten en cuenta que el derecho de desistimiento de catorce días no se aplica a los servicios que se ' +
          'reservan para una fecha y hora concretas, como es el caso de una cita. Lo que se aplica es la ' +
          'política de cancelación del negocio, que ves antes de confirmar.',
        `Puedes dirigir cualquier reclamación a ${LEGAL_COMPANY.email}. Si no quedas conforme, la Comisión ` +
          'Europea ofrece una plataforma de resolución de litigios en línea en ec.europa.eu/consumers/odr.',
      ],
    },
    {
      id: 'modificaciones',
      title: '11. Cambios en estas condiciones',
      paragraphs: [
        'Podemos actualizar estas condiciones. Si el cambio es sustancial te avisaremos y, cuando proceda, ' +
          'te pediremos que las aceptes de nuevo antes de seguir usando el servicio.',
        'Cada versión queda identificada por el número que aparece al principio de esta página, y guardamos ' +
          'cuál aceptaste al registrarte.',
      ],
    },
    {
      id: 'ley',
      title: '12. Ley aplicable',
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
      id: 'transferencias',
      title: '6. Transferencias internacionales',
      paragraphs: [
        'Procuramos que nuestros proveedores traten los datos dentro del Espacio Económico Europeo.',
        'Si alguno los trata fuera, la transferencia se ampara en una decisión de adecuación de la Comisión ' +
          'Europea o en cláusulas contractuales tipo, con las garantías adicionales que correspondan.',
      ],
    },
    {
      id: 'conservacion',
      title: '7. Cuánto tiempo los guardamos',
      paragraphs: [
        'Mientras tu cuenta esté activa. Al eliminarla, anonimizamos tus datos personales y conservamos ' +
          'solo lo que exige la ley durante los plazos legales de prescripción.',
        'Los mensajes de soporte y sus archivos adjuntos se conservan mientras el caso siga abierto y, ' +
          'después, el tiempo necesario para acreditar cómo se resolvió.',
      ],
    },
    {
      id: 'menores',
      title: '8. Menores de edad',
      paragraphs: [
        'El servicio no está dirigido a menores de edad y no se puede crear una cuenta siendo menor.',
        `Si detectamos una cuenta de un menor la eliminamos. Si crees que un menor a tu cargo se ha ` +
          `registrado, escríbenos a ${LEGAL_COMPANY.privacyEmail} y la daremos de baja.`,
      ],
    },
    {
      id: 'cookies',
      title: '9. Cookies y almacenamiento local',
      paragraphs: [
        'Esta web usa únicamente almacenamiento técnico imprescindible: guardamos en tu navegador la sesión ' +
          'iniciada para no pedirte la contraseña en cada página.',
        'No usamos cookies de publicidad ni de analítica de terceros, así que no necesitamos pedirte ' +
          'consentimiento para ellas. Si eso cambiara, te lo pediríamos antes de instalarlas.',
        'Las aplicaciones móviles no usan cookies: guardan la sesión en el almacenamiento seguro del ' +
          'dispositivo.',
      ],
    },
    {
      id: 'decisiones',
      title: '10. Decisiones automatizadas',
      paragraphs: [
        'No tomamos decisiones que te afecten significativamente basadas únicamente en un tratamiento ' +
          'automatizado, ni elaboramos perfiles con tus datos.',
      ],
    },
    {
      id: 'derechos',
      title: '11. Tus derechos',
      paragraphs: [
        'Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, ' +
          `limitación y portabilidad escribiendo a ${LEGAL_COMPANY.privacyEmail}.`,
        'Responderemos en el plazo de un mes. Para comprobar que la solicitud es tuya podemos pedirte que ' +
          'la envíes desde el correo de tu cuenta o que acredites tu identidad.',
        'También puedes retirar en cualquier momento el consentimiento para recibir comunicaciones ' +
          'comerciales, desde tu perfil o desde el enlace que incluye cada correo.',
        'Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia ' +
          'Española de Protección de Datos (www.aepd.es).',
      ],
    },
    {
      id: 'seguridad',
      title: '12. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas y organizativas para proteger tus datos: las contraseñas se almacenan ' +
          'cifradas, las comunicaciones viajan cifradas y el acceso está restringido al personal que lo necesita.',
        'Los archivos que adjuntas a un ticket de soporte se guardan en un almacenamiento privado, separado ' +
          'de los archivos públicos, y solo son accesibles previa identificación.',
      ],
    },
    {
      id: 'cambios-privacidad',
      title: '13. Cambios en esta política',
      paragraphs: [
        'Si modificamos esta política publicaremos aquí la nueva versión y actualizaremos la fecha. Cuando ' +
          'el cambio afecte a algo que requiera tu consentimiento, te lo pediremos de nuevo.',
      ],
    },
  ],
};

/** Documentos indexados por slug de ruta. */
export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terminos: TERMS,
  privacidad: PRIVACY,
};
