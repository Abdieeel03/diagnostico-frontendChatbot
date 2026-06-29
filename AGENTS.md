# AGENTS.md — diagnostico-frontendChatbot

Frontend del chatbot (React + Vite). Escucha en :5173. Lee primero el `AGENTS.md` del repo padre para contexto global.

## 1. Stack

- **Node 24** (`node:24-alpine` en Docker).
- **Vite 8** + `@vitejs/plugin-react 6.0.1`.
- **React 19.2** + **ReactDOM 19.2**.
- **TypeScript ~6.0.2** (estricto).
- **pnpm** (vía corepack) + `pnpm-lock.yaml`.
- **react-markdown 10.1** + **remark-gfm 4.0.1** para render Markdown del asistente.
- ESLint 10 + `typescript-eslint 8.59` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`.
- Sin Tailwind, sin state library (sólo `useState`/`useRef`/`useEffect`).

## 2. Estructura

```
vite.config.ts          → proxy /api → $VITE_API_TARGET (default localhost:9000)
index.html
eslint.config.js
tsconfig*.json / pnpm-lock.yaml / pnpm-workspace.yaml / package.json
Dockerfile              → CMD ["pnpm","dev","--host","0.0.0.0"]  (no prod-ready)
src/
  main.tsx              → entrypoint (StrictMode + App)
  App.tsx               → componente principal (~500 LOC). Maneja TODO el estado.
  App.css / index.css   → estilos con variables CSS --medical-*
  components/
    Sidebar.tsx         → chat sessions (historial, nueva, eliminar)
    DiagnosticPanel.tsx → panel colapsable con síntomas + tarjetas % coincidencia
  assets/
```

## 3. Convenciones Frontend

- **TypeScript estricto**. Nada de `any` salvo en refs típicamente (ver gotcha).
- Componentes **funcionales** (Function Components con `React.FC<Props>` o función flecha tipada).
- Props con interfaces explícitas, defaults via destructuring.
- Path alias implícito desde `src/` (importe relativo como `./components/Synthax`).
- Estilos en `App.css` / `index.css` con variables CSS (`--medical-primary`, `--medical-warning`, `--medical-muted`, etc.). **Sin Tailwind**.
- Estados React: `useState`. Mezclar múltiples estados en `App.tsx` se acepta hoy, pero es candidato a extraer a hooks.
- Llamadas HTTP sólo a `/api/chat` (nunca al backend directo) para respetar el proxy de Vite.
- Markdown del asistente se renderiza con `<ReactMarkdown remarkPlugins={[remarkGfm]}>`.
- Nombres de enfermedades: llegan en `snake_case` desde el backend; formatear a **Title Case** en UI (`formatDiseaseName` en `DiagnosticPanel.tsx`).

## 4. Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `VITE_API_TARGET` | `http://localhost:9000` | URL del backend Scala para el proxy `/api` |

> La variable se lee en `vite.config.ts` y se aplica al proxy del dev server. En build de producción, el frontend harus servirse desde un servidor estático con un reverse-proxy a Scala.

## 5. Estado de la app (`App.tsx`)

Estados:
- `sessions: ChatSession[]` — lista de sesiones en el sidebar.
- `activeSessionId: string` — sesión visible.
- `messagesBySession: MessagesMap` — { sessionId: Message[] }.
- `inputValue: string` — input del formulario.
- `isGenerating: boolean` — flag de loading.
- `isMobileSidebarOpen: boolean` — visibility del sidebar en móvil.

Refs:
- `messagesEndRef` — para auto-scroll.
- `currentIntervalRef` — interval del typing effect.

Tipos principales (`App.tsx`):
```ts
interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  displayedText?: string;
  diagnosticData?: DiagnosticData;
  isFinished: boolean;
  isError?: boolean;
}
interface DiagnosticData {
  response: string;
  symptoms: string[];
  diagnosticos: Diagnostic[];
}
interface Diagnostic {
  coincidencias: number;
  enfermedad: string;
  score: number;
}
```

Tipos de `Sidebar.tsx`:
```ts
interface ChatSession { id: string; title: string; timestamp: string; }
```

## 6. Flujo de `handleSendMessage`

1. Si input vacío o `isGenerating` → return.
2. Si es primer mensaje del usuario → actualiza el `title` de la sesión con un slice del texto.
3. Push del `Message` user + `Message` assistant placeholder (`text: ""`, `isFinished: false`).
4. `fetch("/api/chat", POST, { message })`.
5. Si `!response.ok` o `!json.success || !json.data` → marcar el assistant msg como `isError: true` con mensaje de error.
6. Else → setea `text` y `diagnosticData` del assistant msg, dispara `triggerTypingEffect`.
7. `triggerTypingEffect(fullText, messageId, 15ms, onComplete)`: typea 2 chars por tick, al terminar setea `isFinished: true` y llama `onComplete` (que setea `isGenerating: false`).

## 7. UI

- `Sidebar` (izquierda): logo "Médico AI", botón "Nueva Consulta", lista de sesiones (active state, eliminar), disclaimer pie.
- Header del chat: título "Asistente Diagnóstico" + botón menú móvil.
- `chat-messages`: burbujas user vs assistant, con nombre "Paciente" / "Asistente Médico".
- Burbuja assistant: Markdown + cursor pulsante si no terminó + `DiagnosticPanel` colapsable al pie (síntomas como tags + tarjetas con barra de progreso %).
- Indicador de carga "Analizando síntomas con la API..." (3 typing dots) cuando el último msg es placeholder.
- Sugerencias rápidas cuando la sesión está vacía (3 prompts médicos ejemplo).
- Formulario inferior con input + botón send.

Colores (variables `--medical-*`): `--medical-primary` (≥60%), `--medical-warning` (≥40%), `--medical-muted` (<40%) para score %.

## 8. Gotchas (no reintroducir)

1. **Estado 100% en memoria** → se pierde al refrescar (F5). No hay `localStorage`. Candidato a persistencia básica de `sessions` y `messagesBySession`.
2. **`triggerTypingEffect` captura `activeSessionId` por closure** → si el usuario cambia de sesión a mitad del typing, el efecto actualiza la sesión nueva (corrompe el mensaje placeholder de la otra sesión). El `clearInterval` que existe en `handleSelectSession` corta el typing pero no cancela el callback de `onComplete`.
3. **IDs de mensaje con `Date.now()`** → colisiones si dos mensajes ocurren en el mismo ms (probable con sugerencias). Usar `crypto.randomUUID()` o un counter.
4. **Dockerfile usa `pnpm dev`** → no es build de prod. Debería: `pnpm build` → servir `dist/` con un servidor estático + reverse-proxy `/api` a Scala.
5. **`currentIntervalRef = useRef<any>(null)`** pierde tipado. Tipar como `useRef<ReturnType<typeof setInterval> | null>(null)` o similar.
6. **`App.tsx` ~500 LOC** con 5 estados + 2 refs + lógica de typing + deletar sesiones. Refactor pendiente:
   - `useChatSessions()` hook (sessions + handlers).
   - `useTypingEffect()` hook (typing + cleanup).
   - `useChatApi()` hook (fetch + state messages).
7. **Sin tests** (Vitest no configurado). Configurar `vitest` + `@testing-library/react` para tests de componentes.
8. **Accesibilidad**: botones con SVG y sin `aria-label` en algunos casos (ej. `mobile-menu-btn`, send button).
9. **React 19**: `React` import default no es estrictamente necesario con el nuevo JSX runtime (`react-jsx` del tsconfig). Hoy se importa `React` por compatibilidad — se puede limpiar.
10. **Storybook/a11y**: no configurados.

## 9. Cómo extender

- **Nuevo componente**: `src/components/<Name>.tsx`. Tipar props con interface, exportar como `export const Name: React.FC<NameProps> = (...) => (...)`.
- **Nuevo hook** (refactor recomendado): `src/hooks/<useXxx>.ts`.
- **Cambiar proxy o backend target**: `vite.config.ts`, `VITE_API_TARGET` (env en docker-compose).
- **Cambiar estilos**: `App.css` / `index.css` con variables `--medical-*`. No introducir Tailwind ni CSS-in-JS sin confirmar con el usuario.
- **Añadir una nueva llamada HTTP**: sólo a `/api/*` (proxy). No a `localhost:8000` o `localhost:9000` directo.
- **Formato de enfermedad**: usar `formatDiseaseName` de `DiagnosticPanel.tsx` (snake_case → Title Case). Si se muda a un helper, exportar desde `src/utils/`.

## 10. Verificación

| Comando | Uso |
|---|---|
| `pnpm install` | instalar deps (usa corepack) |
| `pnpm dev` | dev server en :5173 (con proxy) |
| `pnpm build` | build prod (`tsc -b && vite build`) → `dist/` |
| `pnpm lint` | ESLint |
| `pnpm exec tsc -b` | typecheck |
| `pnpm preview` | servir build local |

Sin Vitest configurado (preguntar al usuario antes de invocar).

Smoke test manual:
- `pnpm dev` + abrir http://localhost:5173 + escribir "tengo fiebre y tos" + verificar typing effect + panel colapsable.

## 11. Docker

```dockerfile
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
```

Mejoras pendientes:
- **Multi-stage**: stage1 `pnpm build`, stage2 `nginx:alpine` (o similar) sirviendo `dist/` + reverse-proxy `/api` a Scala.
- Pinnear base image por digest.
- `HEALTHCHECK` con `wget --spider http://localhost:5173/`.

## 12. Reglas para agentes (específicas)

- No agregues Tailwind ni CSS-in-JS sin confirmar con el usuario.
- No cambies la `snake_case → Title Case` del backend por Title Case en el backend; el formateo va en UI.
- Toda llamada HTTP a `/api/*` (proxy), nunca a URLs directas.
- Cualquier nueva UI visible debe reforzar el disclaimer (en el mensaje del asistente o en el panel).
- Componentes nuevos: fonctional + TS estricto + props tipadas.
- Si tocas `App.tsx`, ejectura `pnpm lint` + `pnpm exec tsc -b` antes de declarar tarea completada.
- No agregues dependencias sin verificar `package.json` y confirmar con el usuario.
- Mantén IDs estables usando `crypto.randomUUID()` o un counter, no `Date.now()`.
- Si se refactoriza el typing effect, NO capturar `activeSessionId` por closure — pasarlo como parámetro al `triggerTypingEffect` o usar un ref.