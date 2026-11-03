# NovaVest — actualización de balances individuales

## Archivos
- `index.html`: sustituye el archivo actual de GitHub por este.
- `novavest_balances.sql`: crea la tabla segura donde se guardan los saldos de cada usuario.

## Paso 1 — Crear la tabla en Supabase
1. Abre tu proyecto de Supabase.
2. Entra en **SQL Editor**.
3. Pulsa **New query**.
4. Abre `novavest_balances.sql`, copia todo su contenido y pégalo en el editor.
5. Pulsa **Run**.

La tabla aplica Row Level Security (RLS): cada usuario autenticado solo puede leer y modificar las filas cuyo `user_id` coincide con su propia sesión.

## Paso 2 — Reemplazar el HTML en GitHub
1. Abre el repositorio de NovaVest.
2. Entra en `index.html`.
3. Pulsa el lápiz **Edit** o elimina el archivo y sube este nuevo `index.html`.
4. Guarda con **Commit changes**.

## Paso 3 — Probarlo
- Abre la web y entra con una cuenta.
- Cada cuenta que no tenga saldos guardados recibe una asignación demo inicial aleatoria.
- Los saldos quedan guardados en Supabase y se mantienen al cerrar sesión y volver a entrar.
- Crea o usa otra cuenta: tendrá su propia asignación, separada de la primera.

## Importante
Todos los importes y cantidades son ficticios para pruebas. No representan dinero real, no procesan depósitos ni retiros y no están conectados a una blockchain. No pongas nunca una clave `service_role` o `sb_secret` en el HTML.
