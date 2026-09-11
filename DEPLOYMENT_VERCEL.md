# 🚀 Guía de Deployment a Vercel — Paseo Seguro

**Estado:** ✅ Listo para Producción  
**Fecha:** 2026-09-11  
**Arquitectura:** Next.js Backend + Vite Frontend (separados)

---

## 📋 Pre-Deployment Checklist

- [ ] `npm run typecheck` — 100% compilación exitosa
- [ ] `npm test` — Todos los tests pasando
- [ ] `.env.local` **NO** commiteado (está en `.gitignore`)
- [ ] `vercel.json` configurado
- [ ] `.env.example` actualizado con documentación
- [ ] Git branch limpia: `git status`
- [ ] Commits pusheados: `git push origin main`

---

## 🔐 Secretos: Configuración en Vercel

### Backend (Next.js en Vercel)

**Variables críticas (NUNCA en código):**

```
DATABASE_URL=postgresql://...
DEEPSEEK_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_... (o sk_live_ en prod)
STRIPE_WEBHOOK_SECRET=whsec_...
QUOTE_SIGNING_SECRET=<openssl rand -base64 32>
APP_URL=https://paseo-seguro.vercel.app
FRONTEND_URL=https://paseo-seguro.vercel.app
```

**Pasos en Vercel Dashboard:**

1. Crear proyecto: `Import Git Repository → Select main branch`
2. Framework: `Next.js` (auto-detectado)
3. Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Environment Variables:
   - Click "Environment Variables"
   - Agregar cada variable del `.env.example`
   - **NO** pegar en el código — Vercel las inyecta al build
5. Deploy: Click "Deploy"

### Frontend (Vite — Opción 1: Separado en Vercel)

**O alternativamente:**

1. Crear segundo proyecto Vercel
2. Framework: Custom
3. Root Directory: `frontend`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Environment Variables: (ninguna — frontend no tiene secretos)
7. Deploy

**O Opción 2: Servir desde Next.js**

```typescript
// next.config.ts
export default {
  rewrites: async () => [
    {
      source: '/static/:path*',
      destination: 'http://frontend-domain.vercel.app/assets/:path*',
    },
  ],
};
```

---

## ✅ Paso a Paso: Deployment

### 1. Preparar Repositorio

```bash
# Verificar estado limpio
git status
# Resultado esperado: "working tree clean"

# Verificar .gitignore tiene .env
grep ".env.local" .gitignore
# Resultado esperado: .env.local

# Hacer commit final si es necesario
git add .
git commit -m "Prod: Preparar deployment a Vercel"
git push origin main
```

### 2. Crear Cuenta Vercel

```bash
# Instalar CLI de Vercel
npm install -g vercel

# Autenticar
vercel login

# Verificar configuración
vercel --version
```

### 3. Configurar Proyecto en Vercel

**Opción A: Desde CLI**

```bash
# En la raíz del proyecto
vercel

# Seguir prompts:
# - Link existing project? → No (primera vez)
# - Project name → paseo-seguro
# - Directory → ./
# - Want to modify settings? → Yes
# - Database: Skip (usar variable DATABASE_URL)
```

**Opción B: Desde Dashboard**

1. Ir a [vercel.com](https://vercel.com)
2. New Project → Import Git Repository
3. Seleccionar repositorio
4. Configurar variables de entorno

### 4. Configurar Variables de Entorno

**En Vercel Dashboard:**

```
Project Settings → Environment Variables
```

Agregar cada variable:

| Variable | Valor | Ámbito |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Production |
| `DEEPSEEK_API_KEY` | `sk-...` | Production |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Production |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production |
| `QUOTE_SIGNING_SECRET` | `<32 chars>` | Production |
| `APP_URL` | `https://paseo-seguro.vercel.app` | Production |
| `FRONTEND_URL` | `https://paseo-seguro.vercel.app` | Production |
| `MOCK_STRIPE` | `false` | Production |

### 5. Deploy Automático

```bash
# Vercel automáticamente desplegará cuando pushs a main
git push origin main

# Ver estado del deploy
vercel logs

# O desde dashboard: Deployments tab
```

---

## 🌐 Configuración de Dominio (Opcional)

### Usar Dominio Personalizado

1. Comprar dominio (GoDaddy, Namecheap, etc.)
2. En Vercel Dashboard:
   - Project Settings → Domains
   - Add Domain
   - Seguir instrucciones de DNS
3. Cambiar `APP_URL` y `FRONTEND_URL` en env vars:
   ```
   APP_URL=https://midominio.com
   FRONTEND_URL=https://midominio.com
   ```

---

## 🔍 Verificación Post-Deploy

### 1. Acceder a la App

```bash
# Abrir URL
open https://paseo-seguro.vercel.app

# O desde CLI
vercel --prod
```

### 2. Verificar Variables de Entorno

```bash
# Ver configuración
vercel env pull .env.local.production

# Verificar que se cargaron
cat .env.local.production
```

### 3. Testear Endpoints

```bash
# Health check
curl https://paseo-seguro.vercel.app/api/tours

# Chat endpoint
curl -X POST https://paseo-seguro.vercel.app/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hola"}]}'
```

### 4. Revisar Logs

```bash
# Ver logs en tiempo real
vercel logs --follow

# O desde dashboard: Deployments → View Logs
```

---

## 🆘 Troubleshooting

### Error: "DEEPSEEK_API_KEY is not defined"

```bash
# Solución: Agregar variable en Vercel Dashboard
# Project Settings → Environment Variables
# DEEPSEEK_API_KEY=sk-...
```

### Error: "DATABASE_URL invalid"

```bash
# Verificar URL de PostgreSQL
# DATABASE_URL="postgresql://user:pass@host:port/db"

# Testear conexión local primero
npm run db:migrate
```

### Build fails: "Module not found"

```bash
# Ejecutar build localmente
npm run build

# Si funciona localmente pero falla en Vercel:
# - Verificar .gitignore (no excluye lo necesario)
# - Limpiar cache: vercel env pull && npm install
```

### Frontend no carga (404)

```bash
# Si frontend está en Vercel separado:
# Actualizar FRONTEND_URL en env vars del backend
FRONTEND_URL=https://frontend-domain.vercel.app

# Redeploy backend
vercel --prod
```

---

## 📊 Monitoreo en Producción

### Vercel Analytics

```bash
# Ir a: Project Settings → Analytics
# Revisar:
# - Response times
# - Error rates
# - Deployments
```

### Logs

```bash
# Stream logs
vercel logs --follow

# Ver errores
vercel logs --level error
```

### Alertas

Configurar en Vercel Dashboard:
- Integración Slack
- Error notifications
- Performance alerts

---

## 🔒 Seguridad Post-Deploy

### Checklist

- [ ] DEEPSEEK_API_KEY **NO** visible en navegador
- [ ] `.env.local` **NO** en repositorio
- [ ] HTTPS automático (Vercel lo incluye)
- [ ] CORS configurado (middleware.ts)
- [ ] Rate limiting activo
- [ ] Logging de eventos sospechosos

### Verificar Secretos

```bash
# Confirmar que no hay secretos en HTML
curl https://paseo-seguro.vercel.app | grep -i "sk-\|api.key"
# Resultado esperado: (sin coincidencias)
```

---

## 📦 Rollback (Si necesario)

```bash
# Ver historial de deployments
vercel list

# Rollback a versión anterior
vercel rollback

# O desde dashboard: Deployments → Select previous → Promote to Production
```

---

## ✅ Post-Deployment Tasks

1. **Notificar al equipo** — App en producción
2. **Configurar monitoreo** — Slack alerts, Sentry (opcional)
3. **Backup de BD** — Configurar backups automáticos
4. **SSL certificate** — Vercel automático (✅)
5. **Email alerts** — Errores de servidor
6. **Analytics** — Google Analytics, Vercel Analytics

---

## 📞 Contacto / Soporte

- **Vercel Support:** https://vercel.com/help
- **Next.js Docs:** https://nextjs.org/docs
- **DeepSeek API:** https://platform.deepseek.com/docs

---

**Deployment Guide preparado por:** Claude Code  
**Última actualización:** 2026-09-11  
**Estado:** LISTO PARA PRODUCCIÓN ✅
