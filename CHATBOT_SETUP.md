# 🤖 Chatbot Asistente Turístico — Setup y Ejecución

## Resumen de Implementación

Se ha implementado un **Chatbot Asistente Turístico Inteligente ("Guía Paseo Seguro")** con:
- ✅ Backend (Next.js): Endpoint de streaming en `/api/v1/chat`
- ✅ Frontend (React + Vite): Widget flotante interactivo
- ✅ Integración con DeepSeek Chat API
- ✅ TypeScript: 100% tipado, tests pasando

---

## 🚀 Pasos para Ejecutar

### 1. Obtener clave de DeepSeek

1. Ve a [platform.deepseek.com](https://platform.deepseek.com)
2. Crea una cuenta o inicia sesión
3. Genera una **API Key** en la sección "API Keys"
4. Copia la clave (comienza con `sk-`)

### 2. Configurar variable de entorno

Abre `C:\Users\joels\Desktop\pase_seguro\.env.local` y agrega:

```bash
DEEPSEEK_API_KEY="sk-..."  # tu clave de DeepSeek aquí
```

### 3. Iniciar el backend

```bash
npm run dev
# Backend en http://localhost:3000
```

### 4. Iniciar el frontend (en otra terminal)

```bash
cd frontend
npm run dev
# Frontend en http://localhost:5173
```

### 5. Abrir la app en el navegador

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

---

## 🎨 Widget del Chat

- **Ubicación**: Esquina inferior derecha (botón flotante)
- **Botón**: 💬 "Guía Turístico"
- **Diseño**: Tema caribeño (azul `#0d5a73`, verde `#1c7554`)
- **Dispositivos**: Responsive (móvil, tablet, desktop)

### Características

✅ **Streaming en vivo**: Respuestas en tiempo real mientras se escriben  
✅ **Sugerencias rápidas**: Chips con preguntas frecuentes  
✅ **Tema oscuro**: Soporta preferencias del sistema  
✅ **Accesibilidad**: Focus management, ARIA labels  
✅ **Anti-parpadeo**: Scroll automático a últimos mensajes  

---

## 📋 Flujo de Conversación

**Usuario**: "Hola, quiero tours de playa para 2 personas"

**Guía**: "Con el mayor gusto puedo ayudarte a encontrar los mejores tours de playa. Para brindarte opciones más precisas, ¿en qué fecha te gustaría visitarlos? Así podré consultar el pronóstico del tiempo y confirmar si aplica nuestro descuento especial de lluvia..."

**Características del asistente**:
- 🌧️ Destaca descuentos por lluvia (> 60%)
- 📅 Consulta disponibilidad por fecha
- 👥 Valida pasajeros (1-20)
- 🚫 Rechaza preguntas fuera de alcance educadamente

---

## 🔧 Arquitectura

```
Backend (/api/v1/chat) — Streaming
    ↓
Vercel AI SDK + DeepSeek Claude
    ↓
Frontend (ChatWidget) — React Hook + useEffect
    ↓
Streaming SSE → Render en tiempo real
```

### Archivos Clave

**Backend**:
- `src/app/api/v1/chat/route.ts` — Endpoint de streaming
- `src/lib/env.ts` — Variables de entorno

**Frontend**:
- `frontend/src/components/chat/ChatWidget.tsx` — Widget principal (400+ líneas)
- `frontend/src/components/chat/ChatTourCard.tsx` — Tarjeta de tour
- `frontend/src/lib/chat-client.ts` — Cliente HTTP streaming
- `frontend/src/App.tsx` — Integración en layout

---

## 📝 System Prompt del Asistente

El chatbot opera bajo estas directrices:

1. **Identidad**: "Guía Paseo Seguro" — Asistente oficial de tours en RD
2. **Tono**: Profesional, formal pero cálido
3. **Ortografía**: Perfecta, con tildes y puntuación correcta
4. **Especialidad**: Descuentos automáticos por lluvia (20% si > 60%)
5. **Límites**: Solo tours, clima, disponibilidad (no vuelos, hoteles, etc.)
6. **Límites firmes**: Si pregunta algo fuera de alcance, redirige educadamente

---

## ⚙️ Variables de Entorno Necesarias

```bash
# Requeridas (ya existen)
DATABASE_URL="postgresql://paseo:paseo@localhost:5432/paseo_seguro"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Nueva para Chat (DeepSeek)
DEEPSEEK_API_KEY="sk-..."

# Opcionales (con defaults)
OPEN_METEO_BASE_URL="https://api.open-meteo.com/v1/forecast"
RAIN_THRESHOLD_PCT=60
WEATHER_DISCOUNT_BPS=2000
```

---

## 🧪 Testing

Las 43 pruebas incluyen:

- ✅ Availability capacity checking
- ✅ Pricing with weather discount
- ✅ Stripe webhook handling
- ✅ Weather forecast window validation
- ✅ Open-Meteo API parsing

Ejecutar:
```bash
npm test
npm test -- --watch
```

---

## 📈 Mejoras Futuras

1. **Function Calling (Tools)**  
   - Integrar búsqueda de tours desde el chat
   - Consultar clima en vivo
   - Verificar cupos disponibles

2. **Historial Persistente**  
   - Guardar conversaciones por usuario
   - Recuperar contexto previo

3. **Analytics**  
   - Tracked conversaciones → tours visitados
   - A/B testing de preguntas sugeridas

4. **Integraciones**
   - Copilot plugin para integración en terceros
   - WhatsApp Bot usando Twilio

---

## 🛟 Troubleshooting

### Error: "ANTHROPIC_API_KEY is required"

→ Verifica que `.env.local` tenga la clave y que sea válida

### Chat no aparece

→ Abre DevTools (F12) → Console
→ Verifica que el frontend esté en localhost:5173
→ Verifica que el backend esté en localhost:3000

### Respuestas lentas

→ Verifica conexión a internet (DeepSeek API)
→ Verifica cuota en console.anthropic.com

### Widget no responde

→ Limpia caché (Ctrl+Shift+Delete)
→ Recarga la página (F5)
→ Abre DevTools → Network → verifica POST a `/api/v1/chat`

---

## 📞 Soporte

Para preguntas técnicas, consulta:
- CLAUDE.md (instrucciones del proyecto)
- STARTUP.md (setup inicial)
- Código fuente comentado

---

**Implementado por**: Claude Code  
**Fecha**: 2026-09-11  
**Estado**: ✅ Listo para usar
