# Traspaso — Bipsy Web App (para la próxima sesión, Opus 5.5)

> Objetivo de José: **una web completa, fluida y lista para producción**, al
> mismo nivel que la app móvil de CLIENTE de Bipsy (`apps/gipsi`). Lee este
> archivo entero antes de tocar nada.
>
> Estado al cerrar la sesión del 29-10-2026: **paridad con la app hecha**, revisión
> de código por zonas hecha, recorrido real con cuenta de cliente hecho, 46 tests
> en verde y Lighthouse revisado. Nada commiteado. Lo que falta está en §4.

---

## 0. Reglas que no se negocian

1. **Trabaja en Opus 5.5** (`claude-opus-5-5`). Los subagentes NO heredan el
   modelo salvo que sean `fork`: usa `fork` siempre.
2. **No toques `bipsy-backend` ni `bipsy-mobile-apps`.** Son la fuente de la
   verdad y solo se leen. Eso incluye **no lanzar seeds** ni escribir en la BD.
   Arrancar el backend con `mvnw spring-boot:run` sí vale (solo compila en
   `target/`). Comprueba al final que `git status` de los dos sigue vacío.
3. **Nunca uses claves de Stripe `live`.** El backend local ya arranca con las de
   test (`bipsy-backend/secrets/application-secrets.yml`, `sk_test_`/`pk_test_`).
4. No guardes contraseñas ni claves en archivos ni en la memoria.

---

## 1. Entorno

- **Raíz:** `C:\Users\josem\Documents\GitHub\bipsy` (no es repo; cada subcarpeta sí).
- **Web:** `bipsy-web-app`, Angular 18 standalone, UI en español, tema «lift»
  (claro/oscuro por `prefers-color-scheme`).
- **App de referencia:** `bipsy-mobile-apps/apps/gipsi` + `packages/gipsi_shared_ui`
  + `packages/gipsi_api`. **No** `gipsi_business`.
- **Backend:** `bipsy-backend`, Spring Boot en `:8080`. Si no responde:
  `cd bipsy-backend; .\mvnw.cmd -q spring-boot:run` (≈35 s).
- **BD:** Postgres nativo (servicio `postgresql-x64-18`), base `gipsi`,
  `postgres`/`password`. No hay Docker (los `seed-*.sh` no corren aquí y no se
  lanzan). `psql` en `C:\Program Files\PostgreSQL\18\bin`.
- **git** no está en el PATH:
  ```powershell
  $git = (Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" | Select-Object -Last 1).FullName
  ```
- **Cuenta de cliente de prueba:** `laura@example.com` / `password123` (también
  `miguel@`, `sofia@`). Sale de `DataInitializer.java`. El login exige la cabecera
  `X-Bipsy-Scope: CUSTOMER`.
- **Modo mantenimiento:** `CUSTOMER_WEB` está cerrado en la BD local. Para ver la
  web: entra por `/admin` con la contraseña del equipo (la tiene José; no está
  escrita aquí) o intercepta `GET /maintenance/status` en los scripts.

### Compilar y probar
- `npx ng build` → debe quedar **0 errores / 0 avisos** (15 kB por CSS de componente).
- `npx ng test`: `$env:CHROME_BIN='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; npx ng test --watch=false --browsers=ChromeHeadless`.
- Para pruebas automáticas **usa una build de producción servida aparte**, no
  `ng serve`: la recarga en caliente reinicia la página a mitad de un flujo en
  cuanto alguien edita un archivo (y parece un bug que no es). En la sesión se
  hizo con un servidor estático con gzip y fallback SPA en `:4300`; el backend
  ya admite ese origen por CORS. Los scripts (puppeteer-core, lighthouse, sharp)
  están en el scratchpad de esa sesión y no sobreviven: hay que recrearlos.
- `scripts/build-web-assets.mjs` genera `public/assets_web/` (necesita `sharp`
  instalado fuera del proyecto, ver su cabecera).

---

## 2. Hecho en la sesión del 29-10-2026

### Revisión de código por zonas (≈27 bugs arreglados)
- **Núcleo:** un corte de red ya no cierra la sesión (solo un 4xx del refresco);
  arrancar sin conexión no borra los tokens; doble socket del chat; fotos del chat
  con token caducado (`ApiService.getBlob`); suscripciones de las barras sin
  cortar; `parseLocal` troceando a mano (UTC y Safari); push dado de baja al
  cerrar sesión tras recargar; imágenes con la misma base que la API
  (`resolveApiUrl` exportada).
- **Reserva/citas:** respuestas de horas fuera de orden; reprogramar con tarifa
  pasa por la hoja de cobro; tarifa reconsultada al cancelar/cambiar; el detalle
  se recarga al cambiar de id; fecha de lista de espera un día antes; doble
  navegación con teclado; accesibilidad de la hoja de reseña.
- **Negocio/chat/perfil:** reintento de tarjeta atascado y apertura vieja de la
  hoja; ficha que mostraba datos del negocio anterior; respuestas viejas en
  Buscar y portada; el filtro de franja quitaba negocios sin horario; adjunto del
  chat sin liberar; el perfil mandaba un email que el backend ignora.

### Paridad con la app (auditoría pantalla a pantalla + implementación)
- **Citas:** dirección de las citas a domicilio (con aviso si falta), «Para quién
  es», fecha límite de cancelación concreta («hasta mañana a las 10:00»; antes
  decía «gratis» fuera de plazo aunque el negocio cobrase), cabecera compacta,
  textos de estrellas y validación en las reseñas.
- **Negocio/Buscar/chat:** visor de galería (`components/portfolio-viewer`), tope
  de citas por cliente, confirmar antes de llamar, filtro «Disponibles», filas de
  la portada paginadas de 5 en 5, fotos del chat comprimidas (1600 px) con aviso
  de 10 MB, «Hacer una foto» en móvil.
- **Acceso/perfil:** `email-status` antes del alta (cuentas de Google), reglas de
  contraseña con lista común (`shared/password-policy.ts`, `password-rules`),
  «¿Es este tu número?» (`shared/confirm-phone.ts`), pantalla `/verificar-correo`
  con reenvío, invitación → `/crear-cuenta?ref=`, «Acerca de Bipsy», textos de
  Editar perfil, bloque «Tu ubicación».

### Estilo
- Fuera los iconos en círculos/cuadros de color, degradados y halos donde la app
  no los tiene (Gestionar cita, filas agrupadas, páginas de estado, legales, Mis
  citas). Se dejaron los que la app también tiene (check de éxito, cámara del
  avatar). **Pendiente de decidir por José:** los discos menta detrás de Bip en la
  portada y en las páginas de estado.

### Verificado contra el backend real (cuenta de Laura, build de producción)
- Recorrido de todas las pantallas con sesión en escritorio y móvil: **0
  peticiones fallidas**, 0 errores de consola.
- **Ciclo completo de una cita:** reservar (`POST /bookings`) → Mis citas →
  detalle → cambiar día y hora (`PUT /bookings/15/reschedule`) → cancelar con el
  diálogo propio (`PUT /bookings/15/cancel`). Todo 200. (La cita 15 de Laura queda
  cancelada en la BD local.)

### Tests (46, todos en verde)
`shared/dates`, `password-policy`, `confirm-phone`, `image-url`,
`booking-countdown`, el filtro de franja de Buscar (`opensIn`, exportada) y el
refresco de sesión de `ApiService` con `HttpTestingController`. Se borró el
`app.component.spec.ts` de plantilla, que fallaba siempre.

### Lighthouse (build de producción con gzip)
| Página | Móvil perf/a11y | Escritorio perf/a11y | CLS |
|---|---|---|---|
| Portada | 94 / 100 | 79 / 100 | ~0 |
| Buscar | 99 / 96* | 94 / 100 | ~0 |
| Negocio | 91–98 / 100 | 92–93 / 100 | 0 |
| Acceder / Legal | 99 / 100 | 91–93 / 100 | ~0 |

\* El contraste de las pestañas sobre el cristal translúcido: el color ya es el
de la app; Lighthouse no sabe medir sobre `backdrop-filter`.

Arreglos que llevaron ahí: el pie empujado por el contenido diferido (CLS 0,33–0,43
→ 0; `main` con `min-height` en las páginas con pie), esqueletos de servicios y
reseñas en la ficha, mascota de la portada de 262 KB → 20 KB (LCP 3,4 → 1,9 s),
capturas de la portada con `srcset`, logo de Giralabs reducido, `robots.txt`,
`h2` de resultados en Buscar, `role="link"` fuera de `<article>`.

Otro bug encontrado de paso: la cuenta atrás de una cita redondeaba horas
(«Es mañana» para pasado mañana). Ahora `shared/booking-countdown.ts`, usado por
Mis citas y el detalle.

---

### Pagos con Stripe test, de punta a punta (hecho en la misma sesión, 2.ª tanda)
- **Barbería El Maestro (negocio 2) tiene cuenta Connect de test `READY`**, dada de
  alta como lo haría el negocio: `POST /businesses/me/payouts/activate` con su
  cuenta (`elmaestrob@gmail.com` / `password123`) y datos de prueba de Stripe
  (DOB `1901-01-01`, `address_full_match`, IBAN `ES0700120345030000067890`).
- **Bug grave encontrado y arreglado:** en la web **no se podía añadir ninguna
  tarjeta** (Pagos, reserva, confirmar cita, oferta de lista de espera, hoja de
  pagar): «No hemos podido abrir la pasarela de pago». `eventCoalescing: true`
  retrasa la detección de cambios al siguiente fotograma y el `setTimeout` que
  llamaba a `cardSheet.open()` llegaba antes de que el `@if` pintara la hoja. Se
  arregla con `cdr.detectChanges()` antes de `open()` en los cinco sitios.
- Probado con la web (build de producción) y verificado en el backend:
  1. Tarjeta exigida + 30 % → reservar guardando `4000 0025 0000 3155` con
     **3-D Secure** → cancelar dentro de plazo → **cobro de 4,50 € `SUCCEEDED`**
     y recibo «Pago realizado».
  2. `onlinePaymentMode=REQUIRED` → reservar y **pagar 15 € con 3-D Secure**
     (dos `POST /payments/booking/{id}`, como debe) → `SUCCEEDED`.
  3. `paymentRequestEnabled` → el negocio pide el pago → la hoja se abre sola y
     sale la tarjeta en Mis citas → pagado → `requests/pending` 204.
  4. Errores: tarjeta rechazada («Tu tarjeta ha sido rechazada») y 3-D Secure
     fallido («No podemos autenticar tu método de pago…»), sin guardar nada.
- Los ajustes del negocio 2 se **restauraron** a los originales tras las pruebas;
  la cuenta Connect de test se deja para futuras pruebas.
- Ojo: `prepaidCents` de la cita sigue en 0 tras pagar porque en local **no hay
  `webhook-secret`** y el backend rechaza los webhooks de Stripe. Para verlo:
  `stripe listen --forward-to localhost:8080/payments/webhook/stripe`.

### Navegadores y modo claro (2.ª tanda)
- **Firefox 159** (descargado con `@puppeteer/browsers` al scratchpad), escritorio y
  móvil: 0 errores, 0 peticiones fallidas. En Firefox no va la interceptación de
  puppeteer: se entra con el pase real de `/admin`.
- **Modo claro** revisado en escritorio y móvil. Arreglado: el símbolo del banner
  de la app no cargaba en claro (ruta con espacio dentro de un `srcset`).

### Tanda de pulido (30-10-2026): móvil = app de Android, escritorio acabado
Seis agentes por zonas (Explorar/Buscar/armazón · ficha · reserva · Mis citas ·
chat/reseñas · Ajustes/pagos/acceso), luego cabecera de flujos + confirmar cita +
oferta de lista de espera, una QA completa de solo lectura y sus arreglos.
- **Referencia visual de la app:** `renders/promo_*/shots/*.jpg` (capturas reales
  con datos) + widgets de `apps/gipsi` y `gipsi_shared_ui`.
- **Fotos:** el seeder no las trae en el repo (solo `seed-photos-bipsy/LEEME.md`;
  los jpg están fuera de git). Para revisar con fotos se recortaron de las capturas
  promocionales y se inyectaron en las respuestas de la API **solo en los scripts
  de prueba**; la BD no se tocó.
- Novedades destacables: tarjetas de cita y de servicio con foto a sangre como la
  app; ficha con botones sobre la portada, logo, secciones con filo y barra lateral
  en escritorio; reserva con resumen fijo en escritorio; chat a dos columnas y
  visor con zoom y deslizar para cerrar; Ajustes con la URL del apartado (el atrás
  del móvil vuelve al menú) y versión sin sesión con Ayuda/Acerca de/Legal; acceso
  a dos columnas en escritorio; filtros de Buscar como diálogo accesible.
- Ocultos mientras `STORE_LINKS_READY=false`: la tira de descarga del móvil y los
  distintivos de tiendas del pie (decían «Próximamente» / «Muy pronto»).
- Los avisos flotantes suben solos sobre las barras fijas de abajo (`:has` en
  `styles.css`, `--toast-lift`).
- Cierre: `ng build` 0/0, 46 tests en verde, recorrido de producción en escritorio,
  móvil oscuro y móvil claro sin errores de consola ni peticiones fallidas; la hoja
  de tarjeta vuelve a montar Stripe.
- Datos de prueba que quedan en la BD local (uso normal como Laura): citas 17/18/19
  del negocio 2 confirmadas (17 y 18 pagadas), persona «Marta Prueba», mensajes de
  prueba y dos fotos en la conversación con Barbería El Maestro.

### Sincronización con la app (07-11-2026)

**Adaptada hasta `bipsy-mobile-apps` `c28675c`** (PR #146, 06/11/2026) **y `bipsy-backend`
`f5e9ef1`** (PR #106). La próxima: `git log c28675c..HEAD -- apps/gipsi packages` y
`git log f5e9ef1..HEAD`. Sin commit.

Trasladado:
- **Bloquear un negocio** (497f9aa, d389b58, 6bf87d0, 9db9dc5; backend 2a3c889/e7f2185): la
  bandera de la ficha y la del chat abren «Reportar · Bloquear/Desbloquear»
  (`core/business-safety.service.ts`, `DialogService.actions`). Bloqueado: banda con
  «Desbloquear» (`components/blocked-banner`), sin reservar ni escribir, y el chat lo explica.
  Ajustes › **Negocios bloqueados** (`?apartado=bloqueados`). La ficha se pide ahora con la sesión
  para que llegue `blockedByMe`.
- **Nombre que no dan Apple/Google** (ebfcba3; backend 0a74387) en el acceso y el alta
  (`missingProfile`), y los «+» de los nombres de Apple (a22fd6a, `withoutFormEncodedSpaces`).
- **Cuentas solo-Apple** sin «Crear contraseña» (7d08223; backend 2a1b1b6).
- **Términos y privacidad** enlazados bajo Google y Apple (784b526) y versión «1.0.0» sin «Beta».
- **«Todas»** delante de las categorías en Explorar y Buscar (90572a7).
- **No cobrar lo que no se ha visto** (06fd7e8): sin la tarifa no se cancela ni se cambia (con
  reintento), y la reserva sin pagar se suelta con `release-unpaid` (921c39e) y no con `cancel`.
- **Confirmación pendiente al entrar** (3512338): `core/confirm-request-gate.service.ts` abre
  `/citas/:id/confirmar` al entrar y al volver a la pestaña (no saca de un flujo a medias).
- **Socket del chat** (d94bdd3, deec981): rechazado antes de abrir, renueva la sesión una vez y
  reintenta; pestaña al fondo, se cierra para que llegue el aviso, y se reabre al volver.
- Ficha sin atrás → Explorar (b1145e5); nunca «Profesional #id» (8e101ed).
- **Ubicación como la app** (encargo de José, ver abajo).

Ya estaba: teléfono opcional y cita de invitado (278ced9/eacafa1 = #18), búsqueda en el servidor
con «Ver más» (2bbfc76 = b4cc035), solo cerrar sesión si el servidor rechaza el refresco
(d67a097), dar de baja el push al salir (ba99273), errores legibles (db68979: la web ya enseñaba
`ApiError.message`), API de producción (b0268d2 = #20), detalle de cita sin id del profesional.

Omitido: solo nativo (iOS < 26, barra de pestañas, Dynamic Island, StoreKit, Crashlytics/dSYM,
Face ID, fuentes, teclado, mapas nativos, insignia del icono, splash, versiones de build, olvidar
el Keychain), lo de la app de negocio, el desmontaje de la lista de Flutter (5d537e9), y la
revocación de Apple al borrar la cuenta (d63e8e9: en la web haría falta volver a abrir la ventana
de Apple para sacar su token; queda pendiente). **Pendiente:** el botón «N vienen a domicilio
aquí» del mapa (2bbfc76, `/businesses/home-service`): el mapa de la web es un selector de zona
sobre la lista, no un mapa que se recorre, y necesita su diseño.

#### Ubicación (`core/location.service.ts` + `api/geo.js`)
Decisión de José (07/11): «como Booksy», **al entrar no se pregunta nada**. La raíz llama
`start()` al llegar a Explorar, Buscar o una ficha (no en legales, /admin ni invitaciones):
- **Con el permiso ya concedido de antes** (`permissions.query` = `granted`): la precisa en
  silencio. La guardada de la visita anterior al instante (`localStorage` `bipsy.location.last`,
  try/catch, caduca a los 7 días) y la de ahora cuando llega (precisión media, 15 s).
- **Sin él** (sin decidir, denegado, sin geolocalización): una **aproximada por la IP** de
  `GET /api/geo` (3 s como mucho). Ordena igual Destacados, Buscar sin zona y el arranque del
  mapa, pero no se guarda, no se enseñan kilómetros con ella y en pantalla sale como ciudad
  («Los mejores cerca de Madrid»; en Ajustes, «aproximada por tu conexión: cerca de Madrid»).
- **El diálogo del navegador solo sale cuando el usuario lo provoca:** el aviso «Activa la
  ubicación…» de Explorar (con su ✕), «Usar mi ubicación» del buscador, abrir el mapa en Buscar
  (solo si está sin decidir) y la fila «Tu ubicación» de Ajustes. **La precisa siempre gana.**
- Estados: `granted`, `prompt`, `denied` (el navegador no vuelve a preguntar: se explica cómo
  reactivarla según el navegador; queda la de la IP), `unavailable` (sin señal; queda la guardada
  o la de la IP) y `unsupported` (sin geolocalización o sin HTTPS). Sin `permissions.query` se
  deduce de si hay posición guardada. Cerrar el diálogo de Chrome sin elegir no cuenta como
  denegada. Las listas se recargan si la posición se mueve más de 1 km (p. ej. de la IP a la
  precisa).
- **`api/geo.js`** es una función *edge* de Vercel que devuelve las cabeceras
  `x-vercel-ip-latitude/longitude/city/country` en JSON con `Cache-Control: private, no-store`.
  Sin servicios de terceros ni configuración: Vercel las pone gratis en cada petición.
  `vercel.json` ya no reescribe `/api/*` al `index.html`. **Solo existe en Vercel** (producción,
  previews o `vercel dev`); con `ng serve` u otro hosting `/api/geo` no responde JSON y la web
  sigue sin ubicación, sin errores.
- **Cómo probarla:** en un preview o en producción, abrir `https://<dominio>/api/geo` (debe dar
  tu ciudad; con VPN, la de la VPN) y, en una ventana privada, entrar en Explorar: sin ningún
  diálogo, Destacados dice «cerca de <ciudad>». Con `vercel dev` en local las cabeceras no
  llegan y responde `lat: null`. Tests: `location.service.spec.ts` (sin permiso no se pregunta y
  se usa la IP; con permiso gana la precisa; sin la función no hay ubicación).

## 3. Lo que necesita a José (no se puede resolver desde aquí)

- [ ] **Apple**: el proveedor está activo en Firebase (`es.bipsy.web`); falta
  comprobar que el dominio de producción esté en los dominios autorizados de
  Firebase y en las Return URLs del Services ID.
- [ ] **Coordenadas de los negocios**: sin `latitude/longitude` en la BD el mapa de
  Buscar no tiene marcadores (no es fallo de la web).

- [ ] **Datos con fotos**: la BD local no tiene portadas ni logos y los seeds con
  fotos necesitan Docker. La web nunca se ha visto con contenido real con fotos.
- [ ] **«30 días gratis»** (`promo-bar.component.ts`, `home.component.html`) no
  coincide con el backend: 14 días del plan + 5 de bienvenida. Va enlazado con
  `bipsy-business-web-app`; es decisión comercial.
- [ ] **Enlaces de App Store / Google Play** (`data/app-links.ts`,
  `STORE_LINKS_READY=false`) y **textos legales** (cartel de borrador; faltan CIF
  y domicilio en `legal.models.ts`).
- [ ] **Rotar la `sk_live` de Stripe**: se pegó en el chat de esta sesión.
- [ ] Decidir si se quitan los discos menta detrás de Bip (§2, Estilo).

## 4. Pendiente que sí se puede hacer sin José

- [ ] **Safari iOS** (fechas `Instant` con microsegundos, `backdrop-filter`) y
  tablet: no se pueden probar desde Windows. Edge y Firefox ya están.
- [ ] Recorrido real de lo nuevo con datos que la BD local no tiene: cita a
  domicilio, cita para otra persona, lista de espera con hueco, cita
  `AWAITING_CUSTOMER`, chat con fotos.
- [ ] Apple Pay / Google Pay; zoom y deslizar-para-cerrar en el visor del chat.
- [ ] `apiUrl` de producción en `environments/environment.ts`: revisar antes de
  desplegar. El hosting debe servir con gzip/brotli y fallback a `index.html`.
- [ ] Más tests de componentes (flujo de reserva, hojas de pago).

---

## 5. Reglas de estilo

- UI en español; comentarios en español explicando el **porqué**.
- Tokens de `src/styles.css`. Ojo: `--clr-mint` en **claro es carbón** (#2E343B);
  si el texto es oscuro fijo, usa el menta de marca `#C0EED3`.
- Clases globales: `.sheet-backdrop`, `.sheet`, `.form-group`, `.flow`,
  `.img-placeholder`, `.toast`, `.skeleton`, `.sr-only`.
- **Nada de adornos:** iconos en círculos de color, degradados, halos, emojis.
  Antes de quitar uno, cotejar con el widget de Flutter: si la app lo tiene, se queda.
- Accesibilidad: botones reales, `aria-label` en los de solo icono,
  `aria-hidden` en iconos decorativos, foco visible, Escape cierra, foco atrapado.
- Confirmaciones → `DialogService`; avisos → `ToastService`. Nunca `confirm()`/`alert()`.
- Cada `ng build` en 0 errores y 0 avisos.
