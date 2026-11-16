# Subdominios de negocio (`ismaelillobarber.bipsy.es`)

Cada negocio tiene un subdominio (bipsy-backend, migración V131). No sirve
ninguna página: este Worker de Cloudflare pregunta al backend a qué ficha lleva
y redirige a la de siempre:

```
ismaelillobarber.bipsy.es            → https://bipsy.es/negocio/ismaelillo-barber-19
ismaelillobarber.bipsy.es/reservar   → https://bipsy.es/negocio/ismaelillo-barber-19/reservar
nadie.bipsy.es                       → https://bipsy.es/buscar?q=nadie
www.bipsy.es/...                     → https://bipsy.es/... (301)
```

Las fichas `/negocio/...` y los enlaces ya repartidos no cambian.

## Puesta en marcha (una vez)

Hace falta que el backend con la V131 esté desplegado (responde
`GET https://api.bipsy.es/businesses/subdomain/<sub>`).

1. **DNS en Cloudflare** (bipsy.es › DNS › Registros › Agregar registro):
   - Tipo `AAAA`, nombre `*`, contenido `100::`, **Proxy activado (nube naranja)**.
   - Es un registro comodín: cubre cualquier subdominio que no tenga el suyo.
     `business`, `api`, `help`… tienen registro propio y no se ven afectados.
   - El certificado SSL universal de Cloudflare ya cubre `*.bipsy.es`.
2. **Desplegar el Worker** desde esta carpeta:
   ```
   npx wrangler login
   npx wrangler deploy
   ```
   `wrangler.toml` ya trae la ruta `*.bipsy.es/*` en la zona `bipsy.es`.
   Sin terminal: Workers & Pages › Crear › Worker «bipsy-subdomains», pegar
   `worker.js`, y en Configuración › Dominios y rutas añadir la ruta
   `*.bipsy.es/*` (zona bipsy.es) y la variable `API_URL=https://api.bipsy.es`.
3. **Probar**: abrir el subdominio de un negocio real (sale en «Mi enlace» del
   panel) y comprobar que llega a su ficha.

## Pruebas

```
node cloudflare/subdomains/worker.test.mjs
```
