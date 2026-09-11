# 🚀 Guía de Inicio — Paseo Seguro

Esta guía te muestra exactamente cómo levantar el proyecto completo con todos los servicios necesarios.

---

## 📋 Requisitos Previos

- ✅ PostgreSQL 16 instalado (`postgresql-x64-16` como servicio Windows)
- ✅ Node.js instalado
- ✅ npm instalado
- ✅ El proyecto clonado en: `C:\Users\joels\Desktop\pase_seguro`

---

## 🔧 Paso 1: Verificar/Iniciar PostgreSQL

### Desde PowerShell (como administrador)

```powershell
# Ruta: Cualquier ubicación (PowerShell)
# Verificar estado del servicio
Get-Service postgresql-x64-16 | Select-Object Status

# Si Status = "Running" ✅ → Continúa al Paso 2
# Si Status = "Stopped" → Ejecuta:
Start-Service postgresql-x64-16

# Verificar nuevamente
Get-Service postgresql-x64-16 | Select-Object Status
# Debería mostrar: Status: Running ✅
```

**Conexión de prueba:**
```powershell
psql -U paseo -d paseo_seguro -h localhost
# Contraseña: paseo
# Si entra sin errores → ✅ BD funcionando
# Escribe \q para salir
```

---

## 💻 Paso 2: Backend (Next.js)

### Terminal 2 - PowerShell o CMD

```powershell
# Ruta de ejecución:
C:\Users\joels\Desktop\pase_seguro

# Comandos:
cd C:\Users\joels\Desktop\pase_seguro
npm run dev

# Output esperado:
# ▲ Next.js 15.5.25
# - Local:        http://localhost:3000
# - Network:      http://192.168.x.x:3000
# ✓ Ready in 3s
```

**Verifica que el backend esté listo:**
```
Abre en el navegador: http://localhost:3000/api/tours
Debería devolver un JSON con los tours disponibles
```

---

## 🎨 Paso 3: Frontend (Vite + React)

### Terminal 3 - PowerShell o CMD

```powershell
# Ruta de ejecución:
C:\Users\joels\Desktop\pase_seguro\frontend

# Comandos:
cd C:\Users\joels\Desktop\pase_seguro\frontend
npm run dev

# Output esperado:
# ▄▄▄▄▄▄▄▄▄ VITE v6.4.3
# ➜ Local:   http://localhost:5173
# ➜ Network: use --host to expose
```

**Verifica que el frontend esté listo:**
```
Abre en el navegador: http://localhost:5173
Debería ver la landing page con el hero "Si el pronóstico anuncia lluvia..."
```

---

## 📊 Paso 4: Verificar Todo Funciona

### En el Navegador

```
1. Abre http://localhost:5173
2. Haz clic en "Ver tours disponibles"
3. Selecciona un tour (ej. "27 Charcos de Damajagua")
4. Elige fecha, franja horaria, cantidad de pasajeros
5. Verifica que aparezca el precio y los cupos disponibles
6. Haz clic en "Pagar y reservar"
7. Debería redirigir a http://localhost:3000/mock-pago/[bookingId]
8. Completa el pago (usa tarjeta 4242 4242 4242 4242)
9. Debería redirigir a http://localhost:5173/reservas/confirmacion
10. El estado debe cambiar a "Listo" en unos segundos ✅
```

---

## 🔌 Paso 5: Servicios Opcionales

### Prisma Studio (Inspeccionar Base de Datos)

```powershell
# Ruta:
C:\Users\joels\Desktop\pase_seguro

# Comando:
npm run db:studio

# Abre en navegador:
http://localhost:5555

# Puedes ver/editar datos de:
# - Tours
# - Bookings
# - ProcessedWebhookEvents
# - Users (si tienes datos de seed)
```

### Stripe Webhook Listener (Solo si activaste Stripe real)

```powershell
# Ruta:
C:\Users\joels\Desktop\pase_seguro

# Comando:
npm run stripe:listen

# Output esperado:
# > Forwarding events to http://localhost:3000/api/webhooks/stripe
# > Ready! Your webhook signing secret is whsec_...

# Escucha webhooks en tiempo real
```

---

## 📋 Setup Completo (Resumen)

| # | Servicio | Ruta | Comando | Puerto | URL |
|---|---|---|---|---|---|
| 1 | PostgreSQL | `Get-Service postgresql-x64-16` | `Start-Service postgresql-x64-16` | 5432 | localhost:5432 |
| 2 | Backend | `C:\Users\joels\Desktop\pase_seguro` | `npm run dev` | 3000 | http://localhost:3000 |
| 3 | Frontend | `C:\Users\joels\Desktop\pase_seguro\frontend` | `npm run dev` | 5173 | http://localhost:5173 |
| ✨ | Prisma Studio | `C:\Users\joels\Desktop\pase_seguro` | `npm run db:studio` | 5555 | http://localhost:5555 |
| 🔐 | Stripe Webhooks | `C:\Users\joels\Desktop\pase_seguro` | `npm run stripe:listen` | - | localhost:3000/api/webhooks/stripe |

---

## 🛑 Troubleshooting

### PostgreSQL no inicia
```powershell
# Verificar que está instalado
Get-Service postgresql-x64-16

# Si no existe, instala PostgreSQL 16 desde:
# https://www.postgresql.org/download/windows/

# Si está instalado pero no arranca:
# 1. Abre Services (services.msc)
# 2. Busca "postgresql-x64-16"
# 3. Click derecho → Properties
# 4. Startup type: Automatic
# 5. Start service
```

### Backend falla en `npm run dev`
```bash
# Opción 1: Limpiar caché
cd C:\Users\joels\Desktop\pase_seguro
rm -r node_modules .next
npm install
npm run dev

# Opción 2: Verificar que PostgreSQL está corriendo
Get-Service postgresql-x64-16 | Select-Object Status
```

### Frontend falla en `npm run dev`
```bash
# Opción 1: Limpiar caché
cd C:\Users\joels\Desktop\pase_seguro\frontend
rm -r node_modules
npm install
npm run dev

# Opción 2: Si puerto 5173 está en uso
npm run dev -- --port 5174
```

### La BD está vacía (sin tours)
```bash
# Ejecutar seed
cd C:\Users\joels\Desktop\pase_seguro
npm run db:seed

# Verifica en Prisma Studio
npm run db:studio
```

### No puedo conectar a la BD
```bash
# Verifica credenciales en .env.local
cat .env.local | grep DATABASE_URL

# Debería ser:
# DATABASE_URL="postgresql://paseo:paseo@localhost:5432/paseo_seguro"

# Prueba conexión manual
psql -U paseo -d paseo_seguro -h localhost
# Contraseña: paseo
```

---

## 🔍 Comandos Útiles de Desarrollo

### Desde `C:\Users\joels\Desktop\pase_seguro`

```bash
# Verificar tipos TypeScript
npm run typecheck

# Ejecutar tests
npm test

# Ejecutar tests en watch mode
npm run test:watch

# Linter
npm run lint

# Reset total de BD (cuidado: borra datos)
npm run db:reset

# Generar cliente Prisma (después de cambiar schema)
npm run db:generate

# Ejecutar migraciones pendientes
npm run db:migrate
```

---

## 📱 URLs de Acceso Rápido

```
🌐 Frontend (App)              http://localhost:5173
🔌 Backend API (REST)          http://localhost:3000
📊 Prisma Studio (BD)          http://localhost:5555
🗄️ PostgreSQL                   localhost:5432 (psql -U paseo -d paseo_seguro)
🎯 Webhook Stripe (en escucha)  localhost:3000/api/webhooks/stripe
```

---

## ✅ Checklist Final

Antes de considerar que todo está listo:

```
☐ PostgreSQL está corriendo (Status: Running)
☐ Backend levantado en http://localhost:3000 (Ready in X segundos)
☐ Frontend levantado en http://localhost:5173 (Local: http://localhost:5173)
☐ Abrir http://localhost:5173 en navegador → Ver landing page
☐ Hacer clic en "Ver tours disponibles" → Cargar catálogo
☐ Seleccionar un tour → Ver disponibilidad y precios
☐ Hacer una reserva simulada → Completar flujo sin errores
☐ En Prisma Studio (http://localhost:5555) → Ver booking en BD
```

---

## 📞 Notas Importantes

1. **Mantener terminales abiertas**: No cierres las 3 terminales (PostgreSQL, Backend, Frontend) mientras estés desarrollando.

2. **Hot reload**: 
   - Backend (Next.js): Cambios se recargan automáticamente
   - Frontend (Vite): Cambios se recargan automáticamente

3. **Variables de entorno**: Están en `.env.local` (NO commitear)
   - `DATABASE_URL`: Conexión a PostgreSQL
   - `STRIPE_SECRET_KEY`: (configurar cuando actives Stripe real)
   - `MOCK_STRIPE=true`: Modo simulado (actual)

4. **Base de datos**: 
   - Automáticamente se crea con `npm run db:migrate`
   - Seed inicial con `npm run db:seed`

---

**¡Listo! 🎉 Tu proyecto está completamente funcional.**

Cualquier duda, revisa `CLAUDE.md` para arquitectura y decisiones de diseño.
