# Despliegue con Vercel + Render + Neon

Esta es la ruta gratuita más práctica para `Gummy Lover's` sin depender de tu PC:

- `Frontend`: Vercel
- `Backend`: Render
- `Base de datos`: Neon PostgreSQL

## Decisión técnica

El frontend y el backend viven en dominios distintos. Por eso la app quedó preparada con:

- autenticación por token
- CORS configurable por variables de entorno
- `VITE_API_BASE_URL` para apuntar el frontend a la API

No dejé `Fly.io` como ruta principal porque para cuentas nuevas ya no ofrece un free tier real; hoy Render sigue siendo la opción gratuita más directa para la API, aunque se duerme sin tráfico.

## 1. Crear la base de datos en Neon

1. Crea una cuenta en Neon.
2. Crea un proyecto PostgreSQL.
3. Copia la cadena de conexión `DATABASE_URL`.

Debe verse similar a esto:

```text
postgresql://usuario:password@ep-xxxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## 2. Desplegar el backend en Render

Usa el archivo [render.yaml](/C:/Users/Admin/Documents/Gummy_Lovers/render.yaml).

### Variables necesarias

Configura en Render:

- `DATABASE_URL`
- `DJANGO_SECRET_KEY`
- `GUMMY_EFRAIN_PASSWORD`
- `GUMMY_ERIKA_PASSWORD`
- `CORS_ALLOWED_ORIGINS` si usarás dominio propio

Puedes usar [`.env.render.example`](/C:/Users/Admin/Documents/Gummy_Lovers/.env.render.example) como referencia.

### Valores típicos

```text
DJANGO_DEBUG=0
DJANGO_USE_HTTPS=1
DJANGO_ALLOWED_HOSTS=.onrender.com,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=https://*.onrender.com
CORS_ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
```

### Build y arranque

Render ya queda configurado para usar:

- `buildCommand`: `bash scripts/render-build.sh`
- `startCommand`: `bash scripts/render-start.sh`

## 3. Desplegar el frontend en Vercel

1. Importa el repositorio desde GitHub.
2. En `Root Directory`, selecciona `frontend`.
3. Framework: `Vite`.
4. Agrega la variable:

```text
VITE_API_BASE_URL=https://tu-backend.onrender.com
```

Referencia: [frontend/.env.example](/C:/Users/Admin/Documents/Gummy_Lovers/frontend/.env.example)

El archivo [frontend/vercel.json](/C:/Users/Admin/Documents/Gummy_Lovers/frontend/vercel.json) ya deja funcionando la recarga directa de rutas del SPA.

## 4. Alternativa con Netlify

Si prefieres Netlify:

1. Importa el repositorio.
2. Configura el sitio para el directorio `frontend`.
3. `Build command`: `npm run build`
4. `Publish directory`: `dist`
5. Variable:

```text
VITE_API_BASE_URL=https://tu-backend.onrender.com
```

El archivo [frontend/netlify.toml](/C:/Users/Admin/Documents/Gummy_Lovers/frontend/netlify.toml) ya incluye el redirect de SPA.

## 5. Probar login

Cuando Render termine de desplegar:

1. abre el frontend en Vercel
2. inicia sesión con:
   - `efrain@gummylovers.local`
   - o `erika@gummylovers.local`
3. usa las passwords que definiste en Render

## 6. Cuando cambies código

- `git push` a `main`
- Vercel recompila el frontend
- Render redespliega la API

## Notas

- Render Free duerme el backend tras un periodo sin tráfico
- Neon mantiene la base fuera del servidor web, así que no pierdes datos por reinicios del backend
- El regex de CORS ya acepta `*.vercel.app` y `*.netlify.app`; si luego usas dominio propio, agrega ese dominio a `CORS_ALLOWED_ORIGINS`
