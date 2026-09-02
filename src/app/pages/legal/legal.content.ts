import { LegalDocument, LEGAL_COMPANY } from './legal.models';

/**
 * Los cuatro documentos legales publicados.
 *
 * Redactados sobre lo que el código hace de verdad, no sobre una plantilla: el
 * apartado del orden de resultados describe `BusinessDiscoveryService`, y el de
 * cookies, las claves que escribe `TokenStorageService`. Si cambia el
 * comportamiento, cambia el documento en el mismo cambio o pasa a ser falso.
 *
 * No los ha revisado un abogado. Cubren lo que exigen la LSSI-CE, el RGPD, el
 * Reglamento de Servicios Digitales y el Reglamento P2B, pero conviene que los
 * lea uno en cuanto sea asumible.
 *
 * La numeración de los títulos va escrita a mano. Si insertas una sección en
 * medio, renumera las siguientes: el índice de la página se genera a partir de
 * estos títulos y quedaría descuadrado.
 */

const TERMS: LegalDocument = {
  slug: 'terminos',
  title: 'Términos y condiciones',
  subtitle: 'Condiciones de uso de Bipsy para clientes y negocios',
  // 2.0 es la primera version oficial: identifica al prestador de verdad y
  // suma tres apartados obligatorios que la 1.1 no tenia —orden de los
  // resultados, contenidos ilicitos y el preaviso de baja a los negocios—.
  // Quien acepto la 1.1-borrador no acepto nada de eso, asi que sube entera.
  // LegalLinks.currentVersion (app de negocio) tiene que ir a la par.
  version: '2.0',
  updatedAt: '2 de septiembre de 2026',
  sections: [
    {
      id: 'titular',
      title: '1. Titular del servicio',
      paragraphs: [
        `Bipsy es una plataforma de reservas de servicios cuyo titular es ${LEGAL_COMPANY.legalName}, ` +
          `con NIF ${LEGAL_COMPANY.taxId} y domicilio en ${LEGAL_COMPANY.address}.`,
        `Puedes contactar con nosotros en ${LEGAL_COMPANY.email}. Respondemos en español.`,
        '«Bipsy» y «Giralabs» son nombres comerciales. El responsable frente a ti es la persona ' +
          'identificada arriba, tanto en esta web como en las aplicaciones móviles Bipsy y Bipsy Business.',
      ],
    },
    {
      id: 'objeto',
      title: '2. Objeto',
      paragraphs: [
        'Bipsy pone en contacto a quien busca un servicio con cita previa con los establecimientos y ' +
          'profesionales que lo prestan: peluquería, barbería, estética, uñas, maquillaje, tatuaje, ' +
          'depilación, masajes, fisioterapia, entrenamiento personal, yoga y pilates, nutrición, coaching, ' +
          'fotografía y clases particulares, entre otros.',
        'Bipsy es un intermediario tecnológico. El servicio contratado lo presta el negocio, no Bipsy, ' +
          'y es el negocio quien responde de su calidad, sus precios y su cumplimiento.',
        'Usar Bipsy como cliente es gratuito. Los negocios pueden contratar un plan de pago, que se ' +
          'describe dentro de la aplicación Bipsy Business antes de contratarlo.',
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
        'Podemos suspender cuentas que incumplan estas condiciones, con las garantías del apartado 10.',
      ],
    },
    {
      id: 'reservas',
      title: '4. Reservas, cancelaciones y penalizaciones',
      paragraphs: [
        'Al confirmar una reserva se genera un compromiso con el negocio. Cada negocio fija su propia ' +
          'política de cancelación y sus plazos, que se te muestran antes de confirmar.',
        'Un negocio puede exigir que tengas una tarjeta guardada para aceptar reservas. En ese caso, ' +
          'puede fijar una tarifa por avisar tarde y una ventana de antelación a partir de la cual se ' +
          'aplica. La tarifa nunca superará el 50 % del importe del servicio, con un máximo de 100 € por ' +
          'cita, y la ventana estará siempre entre 3 y 24 horas antes de la hora de la cita.',
        'Esa tarifa se aplica en tres supuestos, con las mismas condiciones en los tres, porque en todos ' +
          'ellos el negocio se queda con el hueco vacío y sin margen para ofrecérselo a otra persona:',
      ],
      bullets: [
        'Cancelar la cita dentro de la ventana fijada por el negocio.',
        'Cambiar la cita de fecha u hora dentro de esa misma ventana. La reprogramación se trata igual ' +
          'que una cancelación y se calcula sobre la hora que tenías reservada.',
        'No presentarte a la cita. El negocio puede marcarlo hasta 48 horas después de la hora prevista, ' +
          'y solo en citas que estuvieran confirmadas.',
      ],
      closingParagraphs: [
        'Antes de confirmar una reserva, y también antes de cancelarla o cambiarla, la aplicación te ' +
          'muestra el importe exacto que se te cobraría en ese momento. Si cancelas o cambias la cita con ' +
          'más antelación que la ventana fijada, no se cobra nada.',
        'El cobro se realiza sobre la tarjeta que tengas guardada, sin necesidad de que hagas nada más, y ' +
          'queda registrado en el apartado «Pagos» de la aplicación. Si el cargo es rechazado por tu ' +
          'entidad, la cancelación se mantiene igualmente y el intento queda reflejado como fallido.',
        'El cobro lo realiza Bipsy, que actúa como quien percibe el importe frente a ti, y liquida al ' +
          'negocio lo que le corresponda conforme a su relación con nosotros.',
        'A fecha de hoy la pasarela de pago está desactivada y no se realiza ningún cobro: ningún negocio ' +
          'puede exigir tarjeta ni cobrar una penalización. Este apartado describe cómo funcionará cuando ' +
          'se active, y avisaremos antes de que ocurra.',
      ],
    },
    {
      id: 'orden',
      title: '5. Cómo se ordenan los resultados',
      paragraphs: [
        'Cuando buscas o exploras, el orden en que aparecen los negocios no es aleatorio. Estos son los ' +
          'criterios que lo deciden, de más a menos peso:',
      ],
      bullets: [
        'Si marcas una zona en el mapa, manda solo la distancia a ese punto. Lo que tú eliges está por ' +
          'encima de cualquier otro criterio.',
        'Si no marcas zona, primero la cercanía, agrupada por franjas de kilómetros. Un negocio de una ' +
          'franja más cercana va siempre por delante de uno de una franja más lejana.',
        'Dentro de cada franja, los negocios con el plan de pago «Quality» aparecen antes que los demás. ' +
          'Es una ventaja que se paga y por eso te lo decimos aquí.',
        'Después van los negocios destacados por méritos propios (por ejemplo, ser nuevos en la zona).',
        'A igualdad de lo anterior, la nota media de las valoraciones y, a igual nota, el número de ' +
          'valoraciones recibidas.',
        'Los negocios que quedan fuera del radio máximo se ordenan solo por cercanía: ahí el plan de pago ' +
          'no adelanta a nadie.',
      ],
      closingParagraphs: [
        'Que un negocio pague no oculta a los que no pagan: mueve su puesto dentro de su franja de ' +
          'distancia, no borra a los demás de la lista.',
        'No vendemos posiciones concretas ni resultados para búsquedas concretas, y ninguna valoración ' +
          'se puede comprar. Si algún día introducimos contenido patrocinado, aparecerá identificado como ' +
          'tal en el propio resultado.',
      ],
    },
    {
      id: 'negocios',
      title: '6. Obligaciones de los negocios',
      paragraphs: [
        'Si te das de alta como negocio, declaras estar legalmente habilitado para prestar los servicios ' +
          'que publicas y te comprometes a mantener la información veraz.',
      ],
      bullets: [
        'Mantener actualizados horarios, precios y disponibilidad.',
        'Atender las reservas confirmadas o cancelarlas con antelación razonable.',
        'Tratar los datos de tus clientes conforme a la normativa de protección de datos. Respecto de los ' +
          'datos que recibes de un cliente para atenderle, eres responsable del tratamiento por tu cuenta.',
        'No publicar contenido de terceros sobre el que no tengas derechos.',
        'Cumplir tus propias obligaciones legales frente al consumidor: información de precios, factura y ' +
          'hojas de reclamaciones cuando procedan.',
      ],
      closingParagraphs: [
        'Puedes descargar en cualquier momento los datos de tu ficha, tu catálogo y tus citas desde la ' +
          'aplicación Bipsy Business, y llevártelos si dejas de usar Bipsy.',
      ],
    },
    {
      id: 'contenido',
      title: '7. Contenido y valoraciones',
      paragraphs: [
        'Las valoraciones deben responder a una experiencia real y solo pueden dejarlas clientes con una ' +
          'cita finalizada en ese negocio. No publicamos valoraciones de quien no ha ido, y ningún negocio ' +
          'puede pagar por recibirlas, borrarlas ni modificarlas.',
        'Podemos retirar contenido ofensivo, falso o que infrinja derechos de terceros. Cuando lo hagamos ' +
          'te diremos por qué, salvo que la ley nos obligue a lo contrario.',
        'La moderación se hace de forma manual, a partir de los avisos que recibimos y de las revisiones ' +
          'que hacemos por nuestra cuenta. No usamos sistemas automáticos que decidan por sí solos retirar ' +
          'contenido ni cerrar cuentas.',
      ],
    },
    {
      id: 'ilicitos',
      title: '8. Cómo avisarnos de un contenido ilícito',
      paragraphs: [
        'Cualquier persona puede avisarnos de un contenido alojado en Bipsy que considere ilícito: una ' +
          'ficha falsa, una fotografía de la que alguien tiene los derechos, una valoración difamatoria o ' +
          'un negocio que no está habilitado para lo que ofrece.',
        `Escríbenos a ${LEGAL_COMPANY.email} indicando, en la medida en que puedas:`,
      ],
      bullets: [
        'Qué contenido es y dónde está (la dirección de la ficha, o el nombre del negocio).',
        'Por qué crees que es ilícito.',
        'Tu nombre y un correo de contacto, salvo que el aviso se refiera a delitos contra la vida, la ' +
          'integridad o la libertad e indemnidad sexual, en cuyo caso puedes avisarnos de forma anónima.',
        'Una declaración de que, según tu leal saber y entender, la información del aviso es correcta.',
      ],
      closingParagraphs: [
        'Acusaremos recibo del aviso, lo trataremos de forma diligente, no arbitraria y sin demoras, y te ' +
          'comunicaremos la decisión y los motivos. Si el aviso es suficiente para saber que el contenido ' +
          'es ilícito sin necesidad de un examen jurídico detallado, actuaremos en consecuencia.',
        'A quien haya publicado el contenido le comunicaremos qué se ha retirado o restringido y por qué, ' +
          'y podrá responder a esa decisión por el mismo medio.',
        `Ese mismo correo, ${LEGAL_COMPANY.email}, es el punto de contacto para las autoridades y para ` +
          'los usuarios, y el idioma de comunicación es el español.',
      ],
    },
    {
      id: 'propiedad',
      title: '9. Propiedad intelectual',
      paragraphs: [
        `La aplicación, su código, su diseño, la marca Bipsy y los demás signos distintivos pertenecen a ` +
          `${LEGAL_COMPANY.legalName}. Poder usar el servicio no te da ningún derecho sobre ellos.`,
        'El contenido que subes (fotos del local, descripciones de servicios, valoraciones) sigue siendo ' +
          'tuyo. Al publicarlo nos autorizas a mostrarlo dentro de la plataforma y a usarlo para promocionar ' +
          'tu ficha, mientras lo mantengas publicado. Esa autorización termina cuando lo retiras.',
      ],
    },
    {
      id: 'baja',
      title: '10. Suspensión, restricción y baja',
      paragraphs: [
        'Puedes darte de baja cuando quieras desde tu perfil. La baja no cancela por sí sola las citas ya ' +
          'confirmadas: gestiónalas antes o quedarán sujetas a la política de cancelación del negocio.',
        'Si somos nosotros quienes restringimos, suspendemos o cerramos una cuenta, lo hacemos con estas ' +
          'garantías:',
      ],
      bullets: [
        'Te diremos los motivos concretos, por escrito, antes de que la medida surta efecto o en el mismo ' +
          'momento en que lo haga.',
        'Si se trata del cierre definitivo de la cuenta de un negocio, avisaremos con treinta días de ' +
          'antelación, salvo que estemos obligados por ley a actuar antes, que se trate de un ' +
          'incumplimiento reiterado de estas condiciones, o que haya un motivo imperioso de seguridad.',
        'Podrás responder a esa decisión escribiéndonos, y la revisaremos.',
      ],
      closingParagraphs: [
        'Salvo que el incumplimiento sea grave, avisaremos antes y daremos margen para corregirlo.',
      ],
    },
    {
      id: 'responsabilidad',
      title: '11. Responsabilidad',
      paragraphs: [
        'Bipsy no responde de la prestación del servicio contratado, que corresponde al negocio.',
        'Como intermediario, no controlamos previamente el contenido que publican los negocios ni las ' +
          'valoraciones que dejan los clientes. Cuando tenemos conocimiento efectivo de un contenido ' +
          'ilícito, actuamos con diligencia para retirarlo.',
        'Trabajamos para que la plataforma esté siempre disponible, pero no garantizamos que funcione sin ' +
          'interrupciones ni errores. Nada de lo anterior limita los derechos que la ley te reconoce como ' +
          'consumidor, ni excluye nuestra responsabilidad por dolo o culpa grave.',
      ],
    },
    {
      id: 'consumidores',
      title: '12. Consumidores y reclamaciones',
      paragraphs: [
        'Si contratas como consumidor, conservas todos los derechos que te reconoce la normativa de ' +
          'consumidores y usuarios.',
        'Ten en cuenta que el derecho de desistimiento de catorce días no se aplica a los servicios que se ' +
          'reservan para una fecha y hora concretas, como es el caso de una cita. Lo que se aplica es la ' +
          'política de cancelación del negocio, que ves antes de confirmar.',
        `Puedes dirigir cualquier reclamación a ${LEGAL_COMPANY.email} y te responderemos por escrito. ` +
          'También puedes pedirnos por ese medio la hoja de quejas y reclamaciones oficial de la Junta de ' +
          'Andalucía, y te la haremos llegar.',
        'No estamos adheridos a ningún sistema de arbitraje de consumo. Si no quedas conforme con nuestra ' +
          'respuesta, puedes acudir a la oficina de información al consumidor de tu municipio, a la ' +
          'Dirección General de Consumo de tu comunidad autónoma o a los tribunales.',
      ],
    },
    {
      id: 'modificaciones',
      title: '13. Cambios en estas condiciones',
      paragraphs: [
        'Podemos actualizar estas condiciones. Si el cambio es sustancial te avisaremos y, cuando proceda, ' +
          'te pediremos que las aceptes de nuevo antes de seguir usando el servicio.',
        'A los negocios les avisaremos con al menos quince días de antelación de cualquier cambio en estas ' +
          'condiciones, y durante ese plazo podrán darse de baja sin penalización si no están de acuerdo. ' +
          'El plazo no se aplica cuando el cambio venga impuesto por una obligación legal.',
        'Cada versión queda identificada por el número que aparece al principio de esta página, y guardamos ' +
          'cuál aceptaste al registrarte.',
      ],
    },
    {
      id: 'ley',
      title: '14. Ley aplicable',
      paragraphs: [
        'Estas condiciones se rigen por la legislación española.',
        'Para las controversias con usuarios que actúen como consumidores serán competentes los juzgados ' +
          'que determine la normativa de consumidores, que con carácter general son los del domicilio del ' +
          'consumidor. Para el resto, los juzgados y tribunales del domicilio del titular.',
      ],
    },
  ],
};

const PRIVACY: LegalDocument = {
  slug: 'privacidad',
  title: 'Política de privacidad',
  subtitle: 'Qué datos tratamos, para qué y qué puedes hacer al respecto',
  // 2.0 a la vez que los terminos: cambia quien es el responsable —ya no es
  // un marcador de posicion, es una persona identificada—. El backend solo
  // registra la version de los TERMINOS, asi que esto no pide aceptar nada.
  version: '2.0',
  updatedAt: '2 de septiembre de 2026',
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
        'IONOS — servidor y base de datos, en la Unión Europea.',
        'Vercel — alojamiento de esta web pública.',
        'Cloudflare R2 — almacenamiento de las imágenes y de los archivos que adjuntas a un ticket.',
        'Resend — envío del correo transaccional (verificación, avisos de cita).',
        'Google Firebase — notificaciones push y, si lo eliges, el acceso con cuenta de Google.',
        'Google Maps — mapas y búsqueda por zona. Solo se carga al abrir un mapa.',
        'Stripe — procesamiento de pagos, cuando el negocio exija tarjeta. Los datos de la tarjeta ' +
          'los recoge Stripe directamente y Bipsy nunca llega a verlos.',
      ],
      closingParagraphs: [
        'No cedemos tus datos a nadie más, ni los vendemos, ni los usamos para publicidad de terceros.',
      ],
    },
    {
      id: 'transferencias',
      title: '6. Transferencias internacionales',
      paragraphs: [
        'El servidor y la base de datos están en la Unión Europea. Es donde vive el grueso de tus datos: ' +
          'tu cuenta, tus citas y tus mensajes.',
        'Otros proveedores son estadounidenses y pueden tratar datos fuera del Espacio Económico Europeo: ' +
          'Vercel, Cloudflare, Resend, Google y Stripe. En todos los casos la transferencia se ampara en el ' +
          'Marco de Privacidad de Datos UE-EE. UU. o, en su defecto, en las cláusulas contractuales tipo ' +
          'aprobadas por la Comisión Europea, con las garantías adicionales que correspondan.',
        'Si cambiamos de proveedor, actualizaremos esta lista antes de que el cambio surta efecto.',
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

const NOTICE: LegalDocument = {
  slug: 'aviso-legal',
  title: 'Aviso legal',
  subtitle: 'Quién presta este servicio y en qué condiciones se accede a él',
  version: '1.0',
  updatedAt: '2 de septiembre de 2026',
  sections: [
    {
      id: 'identificacion',
      title: '1. Datos identificativos',
      paragraphs: [
        'En cumplimiento del deber de información del artículo 10 de la Ley 34/2002, de servicios de la ' +
          'sociedad de la información y de comercio electrónico (LSSI-CE), se hacen constar los siguientes datos:',
      ],
      bullets: [
        `Titular: ${LEGAL_COMPANY.legalName}, persona física.`,
        `NIF: ${LEGAL_COMPANY.taxId}.`,
        `Domicilio: ${LEGAL_COMPANY.address}.`,
        `Correo electrónico de contacto: ${LEGAL_COMPANY.email}.`,
        'Sitio web: bipsy.es.',
        'Actividad: explotación de una plataforma de intermediación para la reserva de servicios ' +
          'prestados con cita previa (bienestar y cuidado personal, salud no sanitaria, deporte, formación ' +
          'y servicios profesionales, entre otros).',
      ],
      closingParagraphs: [
        `«Bipsy» y «Giralabs» son nombres comerciales bajo los que ${LEGAL_COMPANY.legalName} presta el ` +
          'servicio, tanto en este sitio web como en las aplicaciones móviles Bipsy y Bipsy Business. ' +
          'Cuando estos documentos dicen «Bipsy» se están refiriendo a esa persona.',
        `El correo ${LEGAL_COMPANY.email} es además el punto de contacto único para las autoridades y ` +
          'para los usuarios, y el idioma de comunicación es el español. Cómo avisar de un contenido ' +
          'ilícito se explica en el apartado 8 de los Términos y condiciones.',
      ],
    },
    {
      id: 'objeto-aviso',
      title: '2. Objeto',
      paragraphs: [
        'Este aviso legal regula el acceso, la navegación y el uso de este sitio web y de las aplicaciones ' +
          'móviles de Bipsy, con independencia de que llegues a contratar algo a través de ellos.',
        'Las condiciones de contratación de las reservas están en los Términos y condiciones; el tratamiento ' +
          'de tus datos, en la Política de privacidad; y lo que se guarda en tu navegador, en la Política de ' +
          'cookies. Los cuatro documentos se complementan y ninguno sustituye a los otros.',
      ],
    },
    {
      id: 'acceso',
      title: '3. Condiciones de acceso y uso',
      paragraphs: [
        'El acceso al sitio es libre y gratuito. Consultar negocios, horarios y precios no exige registrarse; ' +
          'reservar, sí.',
        'Por el mero hecho de acceder aceptas este aviso legal en la versión publicada en ese momento. Si no ' +
          'estás de acuerdo con alguna de sus cláusulas, no uses el sitio.',
        'Te comprometes a hacer un uso diligente del servicio y, en particular, a no:',
      ],
      bullets: [
        'Introducir datos falsos, suplantar a otra persona o a un negocio, o usar la cuenta de un tercero.',
        'Realizar reservas sin intención real de acudir, o de forma masiva o automatizada.',
        'Emplear robots, arañas o cualquier medio automatizado para extraer contenido del sitio, ni acceder a ' +
          'la API por vías distintas de las aplicaciones oficiales.',
        'Intentar eludir las medidas de seguridad, acceder a áreas restringidas o interferir en el ' +
          'funcionamiento normal del servicio.',
        'Introducir virus, código malicioso o cualquier elemento que pueda dañar los sistemas.',
        'Publicar contenidos ilícitos, difamatorios, discriminatorios o que vulneren derechos de terceros.',
      ],
      closingParagraphs: [
        'El incumplimiento de lo anterior puede llevar a la suspensión o al cierre de la cuenta, y a las ' +
          'acciones legales que procedan.',
      ],
    },
    {
      id: 'propiedad-aviso',
      title: '4. Propiedad intelectual e industrial',
      paragraphs: [
        'Todos los derechos sobre el sitio y las aplicaciones —código fuente, diseño, estructura de ' +
          'navegación, textos, imágenes propias y bases de datos— pertenecen a ' +
          `${LEGAL_COMPANY.legalName} o a los terceros que hayan autorizado su uso.`,
        'Las marcas, nombres comerciales y logotipos de Bipsy y de Giralabs están protegidos. Su ' +
          'reproducción, distribución o modificación sin autorización expresa está prohibida, incluida la ' +
          'presentación del contenido como propio mediante enlaces profundos o marcos.',
        'El contenido que publican los negocios (fotografías del local, descripciones y precios) es de sus ' +
          'respectivos titulares, que autorizan a Bipsy a mostrarlo dentro de la plataforma.',
      ],
    },
    {
      id: 'enlaces',
      title: '5. Enlaces a sitios de terceros',
      paragraphs: [
        'El sitio puede contener enlaces a páginas de terceros: fichas de negocios, tiendas de aplicaciones, ' +
          'redes sociales o mapas.',
        'Esos enlaces se ofrecen solo como referencia. Bipsy no controla esos sitios ni responde de sus ' +
          'contenidos, de su disponibilidad ni de sus prácticas de privacidad. Al seguir un enlace sales de ' +
          'nuestro ámbito y pasas a regirte por las condiciones del destino.',
        'Si detectas un enlace a un contenido ilícito, comunícanoslo y lo retiraremos.',
      ],
    },
    {
      id: 'papel',
      title: '6. Papel de Bipsy frente a los negocios',
      paragraphs: [
        'Bipsy es un intermediario tecnológico: pone en contacto a quien busca un servicio con quien lo ' +
          'presta. El servicio contratado lo presta el negocio bajo su propia responsabilidad.',
        'La información de cada ficha —precios, horarios, servicios y fotografías— la publica y la mantiene ' +
          'el propio negocio. Bipsy no la verifica una a una y no responde de su exactitud, sin perjuicio de ' +
          'retirar la que resulte manifiestamente ilícita en cuanto tenga conocimiento efectivo de ello.',
        'Cualquier incidencia sobre el servicio prestado (calidad, trato, importe cobrado en el local) debe ' +
          'dirigirse al negocio. Si no encuentras solución, escríbenos y mediaremos en lo que podamos.',
      ],
    },
    {
      id: 'disponibilidad',
      title: '7. Disponibilidad y exclusión de responsabilidad',
      paragraphs: [
        'Bipsy no garantiza la disponibilidad continuada del sitio ni la ausencia de errores. Puede haber ' +
          'interrupciones por mantenimiento, por fallos de los proveedores de alojamiento o por causas ajenas.',
        'En la medida en que lo permita la ley, Bipsy no responde de los daños derivados de la falta de ' +
          'disponibilidad del servicio, de la pérdida de datos causada por terceros ni del uso que hagas del ' +
          'sitio contra lo previsto en este aviso.',
        'Nada de lo anterior excluye ni limita la responsabilidad por dolo o culpa grave, ni los derechos ' +
          'que la normativa de consumidores reconoce con carácter imperativo.',
      ],
    },
    {
      id: 'proteccion-datos-aviso',
      title: '8. Protección de datos',
      paragraphs: [
        'El tratamiento de los datos personales que recogemos se describe en la Política de privacidad, y el ' +
          'almacenamiento en tu navegador, en la Política de cookies.',
        `Puedes ejercer tus derechos escribiendo a ${LEGAL_COMPANY.privacyEmail}.`,
      ],
    },
    {
      id: 'ley-aviso',
      title: '9. Legislación aplicable y jurisdicción',
      paragraphs: [
        'Este aviso legal se rige por la legislación española.',
        'Para las controversias con usuarios que actúen como consumidores serán competentes los juzgados que ' +
          'determine la normativa de consumidores, que con carácter general son los del domicilio del ' +
          'consumidor. Para el resto, los juzgados y tribunales del domicilio del titular.',
      ],
    },
  ],
};

const COOKIES: LegalDocument = {
  slug: 'cookies',
  title: 'Política de cookies',
  subtitle: 'Qué se guarda en tu navegador, para qué y cómo quitarlo',
  version: '1.0',
  updatedAt: '2 de septiembre de 2026',
  sections: [
    {
      id: 'que-son',
      title: '1. Qué es esto',
      paragraphs: [
        'Una cookie es un archivo pequeño que un sitio web guarda en tu navegador para recordar algo entre ' +
          'una página y la siguiente. Junto a las cookies existen otras técnicas equivalentes —almacenamiento ' +
          'local y bases de datos del navegador— que hacen lo mismo y que esta política también cubre, porque ' +
          'la ley las trata igual.',
        `El responsable de lo que se guarda desde este sitio es ${LEGAL_COMPANY.legalName}, cuyos datos ` +
          'completos están en el Aviso legal.',
        'Esta política se refiere a la web. Las aplicaciones móviles de Bipsy no usan cookies: guardan la ' +
          'sesión en el almacenamiento seguro del dispositivo y el identificador de notificaciones en su ' +
          'propio espacio privado.',
      ],
    },
    {
      id: 'resumen',
      title: '2. Resumen',
      paragraphs: [
        'Bipsy no usa cookies de publicidad, de analítica ni de seguimiento entre sitios. No verás un banner ' +
          'de consentimiento porque no hay nada que consentir: todo lo que guardamos es imprescindible para ' +
          'prestar el servicio que pides, y la normativa exime a ese uso del consentimiento previo.',
        'Lo que sí conviene que sepas es que dos funciones concretas —el mapa y el pago con tarjeta— cargan ' +
          'código de Google y de Stripe, y esos proveedores guardan cosas por su cuenta. Se detallan abajo.',
      ],
    },
    {
      id: 'propias',
      title: '3. Almacenamiento propio (imprescindible)',
      paragraphs: [
        'Todo lo siguiente se guarda en el almacenamiento local de tu navegador. No viaja en cada petición ' +
          'como una cookie clásica y no se comparte con nadie. Permanece hasta que cierras sesión o borras ' +
          'los datos del navegador:',
      ],
      bullets: [
        'bipsy_auth_token — el testigo que acredita tu sesión. Sin él habría que pedirte la contraseña en ' +
          'cada página.',
        'bipsy_refresh_token — permite renovar la sesión cuando el anterior caduca, sin volver a pedirte ' +
          'las credenciales.',
        'bipsy_role y bipsy_actor_id — si entras como cliente o como negocio, y a qué cuenta corresponde la ' +
          'sesión. Determinan qué pantallas se te muestran.',
        'bipsy_promo_business — recuerda que has cerrado el aviso superior para no volver a mostrártelo. ' +
          'Es una preferencia de interfaz: no identifica a nadie ni se envía a ningún sitio.',
      ],
      closingParagraphs: [
        'Si bloqueas este almacenamiento podrás navegar y consultar negocios, pero no mantener la sesión ' +
          'iniciada: no podrás reservar, ver tus citas ni escribir al negocio.',
      ],
    },
    {
      id: 'terceros',
      title: '4. Servicios de terceros',
      paragraphs: [
        'Ninguno de estos servicios se carga al entrar en la web. Cada uno se descarga solo cuando usas la ' +
          'función que lo necesita, y hasta entonces no guarda nada:',
      ],
      bullets: [
        'Google Maps (Google Ireland Limited) — se carga al abrir un mapa, en la búsqueda por zona y en la ' +
          'ficha de un negocio. Google guarda preferencias del propio mapa y, al servirse desde sus ' +
          'dominios, puede leer las cookies que ya tengas de tu cuenta de Google.',
        'Stripe (Stripe Payments Europe, Ltd.) — se carga solo al guardar o usar una tarjeta. Instala las ' +
          'cookies __stripe_mid y __stripe_sid, que sirven para detectar el fraude y para que el pago no se ' +
          'pierda a mitad. Son necesarias para poder pagar: sin ellas Stripe rechaza la operación.',
        'Firebase Authentication (Google) — solo si eliges «Continuar con Google». Guarda en el navegador el ' +
          'estado de esa autenticación mientras dura.',
        'Firebase Cloud Messaging (Google) — solo si autorizas las notificaciones. Registra un trabajador de ' +
          'servicio y un identificador de dispositivo para poder avisarte de tus citas.',
      ],
      closingParagraphs: [
        'Estos proveedores actúan como encargados del tratamiento o, en lo que hacen por cuenta propia, como ' +
          'responsables independientes. El detalle de qué datos reciben está en la Política de privacidad.',
      ],
    },
    {
      id: 'no-usamos',
      title: '5. Lo que no usamos',
      paragraphs: ['Para que quede escrito y sea exigible:'],
      bullets: [
        'No usamos cookies publicitarias ni de personalización de anuncios.',
        'No usamos Google Analytics ni ninguna otra herramienta de analítica de terceros.',
        'No usamos píxeles de redes sociales ni botones que rastreen tu navegación.',
        'No vendemos ni cedemos datos de navegación a terceros con fines comerciales.',
      ],
      closingParagraphs: [
        'Si algún día incorporamos alguna de estas herramientas, aparecerá un aviso pidiéndote consentimiento ' +
          'antes de instalarla, y esta política se actualizará indicando la fecha del cambio.',
      ],
    },
    {
      id: 'gestionar',
      title: '6. Cómo verlas y cómo borrarlas',
      paragraphs: [
        'La forma más rápida de eliminar lo que Bipsy guarda es cerrar sesión desde tu perfil: se borra el ' +
          'almacenamiento de sesión completo.',
        'También puedes hacerlo desde tu navegador, en su configuración de privacidad:',
      ],
      bullets: [
        'Chrome: Configuración › Privacidad y seguridad › Datos de sitios.',
        'Firefox: Ajustes › Privacidad y seguridad › Cookies y datos del sitio.',
        'Safari: Preferencias › Privacidad › Gestionar datos de sitios web.',
        'Edge: Configuración › Cookies y permisos del sitio.',
      ],
      closingParagraphs: [
        'Bloquear el almacenamiento por completo cierra la sesión y deja el sitio en modo consulta. Navegar ' +
          'en ventana privada funciona igual, pero la sesión se pierde al cerrarla.',
      ],
    },
    {
      id: 'cambios-cookies',
      title: '7. Cambios en esta política',
      paragraphs: [
        'Publicaremos aquí cualquier cambio, con su fecha. Conviene revisarla si vuelves después de mucho ' +
          'tiempo.',
        `Para cualquier duda sobre lo que guardamos, escríbenos a ${LEGAL_COMPANY.privacyEmail}.`,
      ],
    },
  ],
};

const ABOUT: LegalDocument = {
  slug: 'quienes-somos',
  title: 'Quiénes somos',
  subtitle: 'Qué es Bipsy, por qué existe y quién está detrás',
  version: '1.0',
  updatedAt: '2 de septiembre de 2026',
  sections: [
    {
      id: 'que-es',
      title: '1. Qué es Bipsy',
      paragraphs: [
        'Bipsy es una aplicación para pedir cita en cualquier negocio que trabaje con cita previa. Una ' +
          'barbería o una peluquería, sí, pero también un centro de estética, un fisioterapeuta, un ' +
          'entrenador personal, una clase de yoga, un tatuador, un fotógrafo o quien da clases ' +
          'particulares. Si tu trabajo se organiza en huecos de agenda, cabe aquí.',
        'Ves los huecos que hay de verdad, eliges uno y ya está: sin llamar, sin esperar a que te devuelvan ' +
          'la llamada y sin descubrir a las siete de la tarde que ese hueco ya no existía.',
        'Del otro lado hay una segunda aplicación, Bipsy Business, con la que el negocio lleva su agenda, ' +
          'su equipo y sus servicios. Las dos hablan con el mismo sistema, así que lo que ves como cliente ' +
          'es lo que el negocio tiene puesto en ese momento.',
      ],
    },
    {
      id: 'por-que',
      title: '2. Por qué existe',
      paragraphs: [
        'Pedir cita por teléfono funciona mal para los dos lados. Tú llamas cuando puedes, que suele ser ' +
          'justo cuando el negocio está atendiendo a alguien; y el negocio interrumpe lo que está haciendo ' +
          'para coger el teléfono, mirar una libreta y apuntar un nombre.',
        'El resultado son huecos que se quedan vacíos porque nadie llegó a saber que estaban libres, y ' +
          'citas que se pierden porque se apuntaron mal. Bipsy es un intento de arreglar eso sin pedirle al ' +
          'negocio que cambie su forma de trabajar: la agenda sigue siendo suya, sus precios y sus horarios ' +
          'también, y quien decide qué se ofrece y cuándo es él.',
      ],
    },
    {
      id: 'quien',
      title: '3. Quién está detrás',
      paragraphs: [
        'Bipsy lo desarrolla **Giralabs**, un proyecto pequeño con base en Marchena, Sevilla. Giralabs es ' +
          'un nombre comercial: la persona responsable, con su nombre y su NIF, está identificada en el ' +
          'Aviso legal, como manda la ley.',
        'Somos pocos y no tenemos inversores detrás. Eso tiene una parte buena y una mala, y las dos se ' +
          'notan: la buena es que no hay nadie pidiéndonos crecer a cualquier precio, así que no vas a ver ' +
          'anuncios ni te vamos a vender a nadie. La mala es que vamos más despacio de lo que nos gustaría ' +
          'y que a veces contestamos tarde.',
      ],
    },
    {
      id: 'como-vivimos',
      title: '4. De qué vivimos',
      paragraphs: [
        'Lo decimos claro porque explica casi todo lo demás:',
      ],
      bullets: [
        'Para ti, como cliente, Bipsy es gratis. No hay cuota, ni versión de pago, ni funciones bloqueadas.',
        'Los negocios pueden contratar un plan mensual. Ese es todo el ingreso.',
        'No hay publicidad de terceros en ningún sitio de la aplicación.',
        'No vendemos datos, ni tuyos ni de los negocios, ni los cedemos con fines comerciales.',
      ],
      closingParagraphs: [
        'Hay una cosa que sí conviene que sepas, y la contamos aquí además de en las condiciones: el plan ' +
          'superior de pago hace que la ficha de ese negocio aparezca antes que otras dentro de su misma ' +
          'franja de distancia. No esconde a nadie ni cambia las valoraciones, pero mueve el puesto, y eso ' +
          'es dinero influyendo en lo que ves. Cómo funciona exactamente el orden está explicado paso a ' +
          'paso en el apartado 5 de los Términos y condiciones.',
      ],
    },
    {
      id: 'compromisos',
      title: '5. A qué nos comprometemos',
      paragraphs: [
        'Cuatro cosas, y las cuatro se pueden comprobar en el resto de estas páginas:',
      ],
      bullets: [
        'Decir la verdad sobre cómo funciona esto, incluido lo que no nos favorece.',
        'No cobrarte nada sin habértelo enseñado antes. Cualquier tarifa por cancelar se te muestra con su ' +
          'importe exacto antes de confirmar y antes de cancelar.',
        'Que solo valore quien de verdad ha ido. Ningún negocio puede comprar, borrar ni cambiar una reseña.',
        'Que puedas irte cuando quieras, llevándote tus datos y sin trámites raros de por medio.',
      ],
    },
    {
      id: 'que-no-somos',
      title: '6. Lo que Bipsy no es',
      paragraphs: [
        'Bipsy no presta el servicio: lo presta el negocio. Nosotros ponemos la herramienta con la que os ' +
          'encontráis y con la que se organiza la cita.',
        'Eso quiere decir que del corte de pelo, del trato y del precio que se cobre en el local responde ' +
          'quien te atiende, no nosotros. Si algo va mal, el chat de la aplicación es la vía directa con el ' +
          'negocio; y si no encuentras solución, escríbenos igualmente: no podemos decidir por ellos, pero ' +
          'sí mediar, y si vemos un patrón tomamos medidas sobre la ficha.',
      ],
    },
    {
      id: 'hablar',
      title: '7. Hablar con nosotros',
      paragraphs: [
        `Escribe a ${LEGAL_COMPANY.email} y contesta una persona. En la página de Contacto está explicado ` +
          'qué poner en el asunto para que llegue antes al sitio correcto.',
        'Si tienes un negocio y quieres darte de alta, o si algo de la aplicación te parece mal pensado, ' +
          'también es esa dirección. Lo segundo interesa especialmente: casi todo lo que funciona bien en ' +
          'Bipsy está así porque alguien se quejó de que estaba mal.',
      ],
    },
  ],
};

const SECURITY: LegalDocument = {
  slug: 'seguridad',
  title: 'Seguridad',
  subtitle: 'Cómo protegemos tu cuenta y cómo avisarnos si encuentras un fallo',
  version: '1.0',
  updatedAt: '2 de septiembre de 2026',
  sections: [
    {
      id: 'como-protegemos',
      title: '1. Cómo protegemos tus datos',
      paragraphs: [
        'Estas son las medidas que aplicamos. No son promesas generales: son cosas concretas que se ' +
          'pueden comprobar.',
      ],
      bullets: [
        'Las contraseñas se guardan cifradas con un algoritmo de un solo sentido. Nadie de Bipsy puede ' +
          'leerlas, ni siquiera con acceso a la base de datos.',
        'Todo el tráfico viaja cifrado. La aplicación no acepta conexiones sin cifrar.',
        'El número de tu tarjeta nunca pasa por Bipsy. El formulario lo sirve Stripe dentro de su propio ' +
          'marco y nosotros solo guardamos un identificador con el que no se puede pagar en otro sitio.',
        'Los archivos que adjuntas a un ticket de soporte van a un almacenamiento privado, separado del ' +
          'de las fotos públicas, y solo se sirven previa identificación.',
        'Cada sesión caduca y se renueva sola. Al cerrar sesión, el testigo se borra del dispositivo.',
        'El acceso a los datos de producción está restringido a quien lo necesita para operar el servicio.',
      ],
    },
    {
      id: 'tu-cuenta',
      title: '2. Lo que puedes hacer tú',
      paragraphs: [
        'La mayoría de las cuentas que se pierden no se pierden por un fallo de la plataforma, sino por una ' +
          'contraseña repetida en otro sitio del que sí se filtró.',
      ],
      bullets: [
        'Usa una contraseña que no uses en ningún otro servicio.',
        'Si entras con Google, la seguridad de tu cuenta de Bipsy depende de la de tu cuenta de Google: ' +
          'ten activada allí la verificación en dos pasos.',
        'Cierra sesión en dispositivos que no sean tuyos.',
        'Revisa de vez en cuando el apartado «Pagos»: ahí aparece cualquier cobro, con su fecha y su motivo.',
      ],
    },
    {
      id: 'nunca-pedimos',
      title: '3. Lo que Bipsy nunca te va a pedir',
      paragraphs: [
        'Si recibes un mensaje que hace alguna de estas cosas, no es nuestro, por mucho que lleve nuestro ' +
          'logotipo:',
      ],
      bullets: [
        'Pedirte la contraseña. Nunca, ni por correo, ni por teléfono, ni por el chat de la aplicación.',
        'Pedirte el número completo de tu tarjeta o el código de seguridad.',
        'Pedirte un código de verificación que te haya llegado por SMS o por correo.',
        'Meterte prisa para que pagues fuera de la aplicación.',
      ],
      closingParagraphs: [
        `Si te ha llegado algo así, reenvíanoslo a ${LEGAL_COMPANY.email} y lo miramos.`,
      ],
    },
    {
      id: 'cuenta-comprometida',
      title: '4. Si crees que han entrado en tu cuenta',
      paragraphs: [
        'Cambia la contraseña desde tu perfil. Eso invalida las sesiones abiertas.',
        `Después escríbenos a ${LEGAL_COMPANY.email} contando qué has visto: citas que no reconoces, ` +
          'cambios en tus datos, cobros extraños. Revisamos el registro de la cuenta y te decimos qué ' +
          'encontramos.',
        'Si hay un cobro que no reconoces, dínoslo en el mismo mensaje: lo paramos mientras se aclara.',
      ],
    },
    {
      id: 'reportar',
      title: '5. Has encontrado un fallo de seguridad',
      paragraphs: [
        'Si eres investigador de seguridad y encuentras una vulnerabilidad, queremos saberlo. Escríbenos a ' +
          `${LEGAL_COMPANY.email} con el asunto «Seguridad» e incluye qué has encontrado, cómo reproducirlo ` +
          'y qué impacto crees que tiene.',
        'Nuestro compromiso:',
      ],
      bullets: [
        'Acusamos recibo lo antes posible y te decimos si lo hemos podido reproducir.',
        'Te mantenemos al tanto mientras lo arreglamos.',
        'No emprenderemos acciones legales contra quien investigue de buena fe y siga lo de abajo.',
        'Si quieres, te damos crédito público cuando esté corregido.',
      ],
      closingParagraphs: [
        'Lo que te pedimos a cambio: no accedas a datos de otras personas más allá de lo imprescindible ' +
          'para demostrar el fallo, no degrades el servicio, no hagas cambios ni borres nada, y dános un ' +
          'margen razonable para corregirlo antes de publicarlo.',
        'Somos un equipo pequeño y no tenemos un programa de recompensas. Lo decimos por delante para que ' +
          'nadie invierta tiempo esperando un pago que no vamos a poder hacer.',
      ],
    },
    {
      id: 'brechas',
      title: '6. Si ocurre una brecha',
      paragraphs: [
        'Si se produjera una violación de seguridad que afecte a tus datos personales, lo notificaremos a la ' +
          'Agencia Española de Protección de Datos dentro de las 72 horas siguientes a tener constancia, ' +
          'como exige el RGPD.',
        'Y si el riesgo para ti fuera alto, te lo diremos directamente: qué ha pasado, qué datos están ' +
          'afectados, qué estamos haciendo y qué te conviene hacer a ti. Sin rodeos y sin esperar a que se ' +
          'sepa por otro lado.',
      ],
    },
  ],
};

const CONTACT: LegalDocument = {
  slug: 'contacto',
  title: 'Contacto',
  subtitle: 'Por dónde escribirnos y qué esperar',
  version: '1.0',
  updatedAt: '2 de septiembre de 2026',
  sections: [
    {
      id: 'donde',
      title: '1. Dónde escribirnos',
      paragraphs: [
        `Todo pasa por un mismo buzón: **${LEGAL_COMPANY.email}**. Somos un equipo pequeño y preferimos ` +
          'una dirección que se lee a cinco que no se leen.',
        'Para que llegue al sitio correcto, pon en el asunto de qué va:',
      ],
      bullets: [
        '«Soporte» — algo no funciona, una cita no aparece, no puedes entrar.',
        '«Privacidad» — quieres acceder a tus datos, corregirlos o que los borremos.',
        '«Seguridad» — has encontrado un fallo. Cómo hacerlo, en la página de Seguridad.',
        '«Contenido» — quieres avisarnos de una ficha, una foto o una valoración que no debería estar ahí.',
        '«Negocios» — tienes un local y quieres darte de alta o preguntar por los planes.',
      ],
    },
    {
      id: 'que-contar',
      title: '2. Qué contarnos',
      paragraphs: [
        'Cuanto más concreto, antes se resuelve. Si el problema es con una cita, dinos el negocio, el día y ' +
          'la hora. Si es con un cobro, la fecha y el importe. Y si algo falla en la aplicación, qué estabas ' +
          'haciendo justo antes.',
        'Escríbenos desde el correo con el que te registraste. Si no puedes, dínoslo: para cosas que afectan ' +
          'a tu cuenta tendremos que comprobar de otra forma que eres tú, y así nos ahorramos un par de ' +
          'mensajes.',
      ],
    },
    {
      id: 'plazos',
      title: '3. Cuánto tardamos',
      paragraphs: [
        'Contestamos en días laborables y lo antes que podemos. No damos un plazo que no podamos cumplir: ' +
          'somos pocos y no hay turno de noche.',
        'Hay dos excepciones con plazo de verdad, porque lo marca la ley:',
      ],
      bullets: [
        'Ejercicio de derechos sobre tus datos (acceso, rectificación, supresión, oposición, limitación y ' +
          'portabilidad): un mes como máximo.',
        'Avisos de contenido ilícito: acusamos recibo enseguida y te comunicamos la decisión con sus ' +
          'motivos, como se explica en el apartado 8 de los Términos.',
      ],
    },
    {
      id: 'reclamaciones',
      title: '4. Si quieres reclamar',
      paragraphs: [
        `Dirige la reclamación a ${LEGAL_COMPANY.email} y te responderemos por escrito. También puedes ` +
          'pedirnos por ese medio la hoja de quejas y reclamaciones oficial de la Junta de Andalucía.',
        'No estamos adheridos a ningún sistema de arbitraje de consumo. Si no quedas conforme, puedes acudir ' +
          'a la oficina municipal de información al consumidor, a la Dirección General de Consumo de tu ' +
          'comunidad autónoma o a los tribunales.',
        'Y si lo tuyo es de protección de datos, puedes reclamar ante la Agencia Española de Protección de ' +
          'Datos (www.aepd.es).',
      ],
    },
    {
      id: 'postal',
      title: '5. Dirección postal',
      paragraphs: [
        `${LEGAL_COMPANY.legalName}, NIF ${LEGAL_COMPANY.taxId}, ${LEGAL_COMPANY.address}.`,
        'Es la dirección a efectos de notificaciones. Para cualquier cosa del día a día, el correo es más ' +
          'rápido.',
      ],
    },
    {
      id: 'lo-que-no',
      title: '6. Lo que no podemos resolver nosotros',
      paragraphs: [
        'Bipsy es un intermediario: la cita la presta el negocio. Si la incidencia es sobre cómo te ' +
          'atendieron, el resultado del servicio o un importe cobrado en el propio local, quien puede ' +
          'resolverlo es el negocio, y el chat de la aplicación es la vía directa.',
        'Si no encuentras solución por ahí, escríbenos igualmente. No podemos decidir por el negocio, pero ' +
          'sí mediar, y si vemos un patrón tomamos medidas sobre la ficha.',
      ],
    },
  ],
};

/** Documentos indexados por slug de ruta. */
export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  'aviso-legal': NOTICE,
  terminos: TERMS,
  privacidad: PRIVACY,
  cookies: COOKIES,
  'quienes-somos': ABOUT,
  seguridad: SECURITY,
  contacto: CONTACT,
};
