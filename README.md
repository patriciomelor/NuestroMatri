# NuestroMatri

Aplicación privada para planificar la boda de Pato y Andrea, con panel de organización, invitados, RSVP público y PWA.

## Requisitos

- Node.js compatible con Next.js 16.
- Un proyecto Supabase.

## Activar Supabase

1. Copia las variables de Supabase en `.env.local`:

	```env
	NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
	```

	La publishable key está diseñada para usarse en el navegador; nunca pongas una secret/service-role key en una variable `NEXT_PUBLIC_`.

2. En Supabase, abre **SQL Editor** y ejecuta completa [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Crea el esquema, las políticas RLS, RPC del RSVP, bucket privado y categorías iniciales.

3. En **Authentication → Users**, crea las dos cuentas de la pareja. La app no ofrece registro público.

4. Inicia sesión con cada cuenta y entra a **Ajustes** para asignar el lado de la cuenta: Pato o Andrea. La fecha inicial es el 22 de marzo de 2027 y se puede modificar ahí.

5. Para habilitar roles y las invitaciones desde **Ajustes**, ejecuta también [`supabase/migrations/0002_user_roles.sql`](supabase/migrations/0002_user_roles.sql) y configura `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor. Agrega la URL de despliegue terminada en `/auth/set-password` a **Authentication → URL Configuration → Redirect URLs** de Supabase. La pareja puede invitar wedding planners (invitados, confirmaciones, tareas, cronograma y mesas) y damas de honor (tareas y cronograma).

## Desarrollo y validación

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Antes de desplegar, ejecuta:

```bash
npm run lint
npm run build
```

El RSVP general vive en `/confirmar`; los enlaces personales usan `/confirmar/CODIGO` y se generan por grupo desde **Invitados** o **Confirmaciones**. Los CSV se pueden abrir con Excel; las vistas con **Imprimir / PDF** permiten guardar una copia desde el diálogo del navegador.

## Notificaciones push (opcional)

Para registrar dispositivos y enviar notificaciones entre usuarios, configura en el entorno local y en Vercel:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:correo-verificado@example.com
```

Genera un par VAPID propio y conserva `VAPID_PRIVATE_KEY` solo en el servidor. Después de ejecutar la migración `0002_user_roles.sql`, cada usuario puede activar avisos desde **Ajustes** (pareja) o **Tareas** (planner y damas). Las operaciones del panel notifican a los demás usuarios con dispositivos suscritos. Las confirmaciones RSVP públicas se detectan mientras el panel **Confirmaciones** está abierto.

## Despliegue en Vercel

Configura las variables de Supabase (y opcionalmente VAPID) en **Project Settings → Environment Variables**. Vercel también requiere que el autor de cada commit use un email verificado en GitHub. Para actualizarlo globalmente:

```bash
git config --global user.email "tu-correo-verificado-en-github"
```

Luego crea un commit nuevo para activar el despliegue. `.env.local` está ignorado por Git y no debe añadirse al repositorio.
