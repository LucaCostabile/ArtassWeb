# Artass WEB

Portal para un servidor de rol con Next.js + Supabase (gratuito en Vercel + Supabase Free).

## Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (Auth + Postgres + RLS)
- Tailwind CSS

## Requisitos implementados
- Autenticación con correo/contraseña (enlace para establecer contraseña desde Supabase)
- Roles: admin y jugador (permisos vía RLS)
- Gestión de usuarios (admin puede cambiar límite de personajes y rol)
- Gestión de personajes (jugador los ve, admin los edita)
- Noticias públicas (admin CRUD)
- Pagos semanales por personaje sin cron, mediante logs y ventana semanal (sábado 00:00)

## Configuración rápida
1) Crear proyecto en Supabase y obtener:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY (solo en servidor)
2) Copiar `.env.example` a `.env.local` y completar.
3) En Supabase SQL Editor, ejecutar `sql/supabase-schema.sql` para crear tablas, funciones y políticas RLS.
4) (Opcional) Habilitar confirmaciones de email o invitar usuarios desde la consola de Supabase.

## Desarrollo
```powershell
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

## Deploy en Vercel
- Importar el repo en Vercel y configurar variables de entorno:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (Server only)
  - NEXT_PUBLIC_SITE_URL (https://tuapp.vercel.app)

## Notas sobre pagos semanales
Se registra cada pago en `pagos_log`. El conteo semanal se calcula filtrando por la ventana desde el sábado 00:00 actual hasta el próximo sábado 00:00. No se requiere cron y funciona en el plan gratuito.

## Próximos pasos sugeridos
- Panel admin completo (formularios para editar usuarios/personajes/noticias)
- OAuth con Discord (opcional)
- Validaciones UI adicionales y tests
