# NovaVest

Sitio web móvil de demostración con registro, inicio de sesión y recuperación de contraseña usando Supabase Auth.

## Archivos
- `index.html`: aplicación completa (HTML, CSS y JavaScript).
- `.nojekyll`: evita procesamiento innecesario de GitHub Pages.

## Publicar gratis con GitHub Pages
1. Crea un repositorio público llamado `novavest`.
2. Sube `index.html` y `.nojekyll` a la raíz del repositorio.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, elige **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
6. Espera a que GitHub muestre la URL publicada.

## Configurar Supabase después de publicar
En el panel de Supabase:
1. Abre **Authentication → URL Configuration**.
2. En **Site URL**, pega la URL exacta que te da GitHub Pages.
3. En **Redirect URLs**, añade esa misma URL y también `https://TU-USUARIO.github.io/novavest/**` si GitHub Pages publica el proyecto en esa ruta.
4. Guarda los cambios.
5. En **Authentication → Providers → Email**, revisa que Email esté habilitado. Para probar confirmación por correo, deja activada la confirmación de email.

## Seguridad
- La URL del proyecto y la `sb_publishable_...` se usan en el navegador y no son claves secretas.
- Nunca pongas `service_role`, `sb_secret_...` ni la contraseña de la base de datos en este repositorio.
- Este proyecto usa Supabase Auth para las cuentas. No crea tablas de balances ni procesa depósitos.
- Los precios, balances, direcciones de wallet, QR e historial son ficticios. No envíes criptomonedas ni dinero real.

## Nota
El archivo usa Supabase JS desde un CDN y Google Fonts desde su CDN; se necesita conexión a Internet para cargar esos recursos.
