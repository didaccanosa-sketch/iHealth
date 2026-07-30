# To-do — iHealth

## ✅ Arreglado hoy (sesión de interfaz/bugs de Training y Nutrition)
- [x] Training: `loadMenu`/`openMeso` sin manejo de errores (se quedaba cargando para siempre en vez de avisar)
- [x] Bug de texto suelto en el buscador de ejercicios del wizard (`query.trim()` como string vacío)
- [x] `schema.sql` con políticas no idempotentes (fallaba al re-ejecutar el archivo entero)
- [x] Feedback de sesión ahora es una pantalla modal aparte, no sustituye el botón en la misma tarjeta
- [x] Peso/reps se pisaban entre sí al guardar (condición de carrera) — cada fila de serie ahora tiene estado propio
- [x] No se veían los pesos/reps de semanas anteriores al navegar (faltaba forzar recreación del campo)
- [x] Sugerencia de progresión daba frases vagas ("1-2 more reps") — ahora da un número concreto
- [x] Botón de volver en la sesión era casi invisible — ahora tiene fondo e icono
- [x] Días de entrenamiento/semana: de escribir un número a elegir con chips (1-7)
- [x] Sugerencias de ejercicios no parecían pulsables — añadido icono, borde y feedback al tocar
- [x] Añadir/quitar series por ejercicio (+/-), con opción de aplicar "solo esta sesión" o "todo el mesociclo" (tabla nueva `meso_session_overrides`)
- [x] Error 404 de `meso_session_overrides` — la tabla nunca se llegó a crear (versión desactualizada del esquema pegada); resuelto repegando el archivo completo + permisos explícitos (`grant`)
- [x] Guardar series no funcionaba en el navegador — `onEndEditing` no se dispara en web, cambiado a `onBlur`
- [x] Nutrition: botón de "guardar como plantilla" fallaba en silencio — ahora avisa de error y confirma visualmente (icono verde) cuando funciona
- [x] Eliminar/duplicar comida sin manejo de errores — arreglado
- [x] La IA de análisis de comidas ahora corrige ortografía/mayúsculas en la descripción (pendiente **redesplegar la función** para que tenga efecto: `supabase functions deploy analyze-meal`)
- [x] Borrar mesociclos (confirmación en la propia tarjeta)
- [x] Se puede crear más de un mesociclo, pero solo uno "empezado" (started) a la vez — los demás quedan como borrador hasta que termines o descartes el activo
- [x] Menú de tipo de entrenamiento al entrar en Training (Hipertrofia/Fuerza / Cardio "Coming soon" / Funcional "Coming soon")
- [x] Selector de cómo crear el meso (desde cero / plantilla "Coming soon" / chat IA "Coming soon")
- [x] Feedback de la rutina en prosa natural, no lista de viñetas
- [x] Quitado el campo de altura del wizard (irá en el perfil)
- [x] Duplicar comida se añadía en el mismo meal_slot de origen — ahora va al siguiente hueco libre
- [x] Efecto glass real en las tarjetas hero (antes eran planas sin desenfoque) — `expo-blur` en móvil, `backdrop-filter` CSS en web

## Decisión de arquitectura: Goals
- **No hay un objetivo único y rígido.** Cada módulo (Nutrición, Entrenamiento) mantiene su propio
  objetivo simple, que se puede fijar a mano **o** pedir de recomendación puntual a la IA para ese
  módulo en concreto (ej. el "sugerir fase según objetivo" ya diseñado para Training).
- **Today los presenta juntos** aunque por debajo sean datos independientes — la sensación de
  "un solo objetivo" es una capa visual, no una restricción de arquitectura.
- **Idea de monetización futura** (no construir todavía, solo dejar anotado): una versión de pago
  que coordina Dieta+Entrenamiento+Recuperación juntos de forma continua — el Recommendation
  Engine completo del documento de producto. El motor manual actual (mesociclos, wizard) sigue
  siendo la base "gratis" de control total, no se sustituye.

## En cola (próximo) — Review de la última actualización (Cardio + Plantillas)

- [ ] **PIEZA A — Rehacer el flujo de creación con plantilla (bug de pregunta repetida)**
      Ahora mismo, al usar cualquier plantilla (catálogo fijo, propia, o Focused split),
      se pasa por el wizard normal desde el paso 1 — que vuelve a preguntar días/semana,
      fase, nivel, duración, aunque ya se hayan elegido en el TemplatePicker. Arreglo:
        - El TemplatePicker (las 3 pestañas) recoge fase + nivel + duración del meso
          en la misma pantalla, junto con la elección de plantilla/split — no en una
          pantalla aparte después
        - En "Focused split": quitar la restricción de 4-7 días fijos — campo libre,
          el algoritmo ya soporta cualquier número
        - El wizard, cuando viene de una plantilla (`initial` ya viene relleno), entra
          **directo a la pantalla de revisión** (lo que hoy es el paso 3), no vuelve a
          empezar por el paso 1 — así solo se pregunta una vez todo
        - El camino "Start from scratch" (manual) se queda exactamente igual que ahora

- [ ] **PIEZA B — Reordenar ejercicios en la revisión**
      En la pantalla de revisión (antes de crear el meso), poder subir/bajar cada
      ejercicio de posición dentro de su día — botones arriba/abajo, no hace falta
      drag-and-drop completo

- [ ] **PIEZA C — Transiciones entre pantallas**
      Los cambios de pantalla (wizard, menús, etc.) son instantáneos/secos ahora mismo.
      Añadir una transición suave (fade o slide) al navegar, en vez de un corte directo

- [ ] **PIEZA D — Feedback explicativo para splits generados por el algoritmo**
      Cuando el split viene del generador de énfasis, el feedback debería explicar el
      *porqué* de las decisiones (ej. "le diste prioridad a pecho, así que aparece 2
      veces por semana; lo emparejé con glúteo el segundo día para repartir mejor el
      resto"), y añadir recomendaciones proactivas (core, recuperación/descarga) en vez
      de solo avisar cuando falta algo

- [ ] **PIEZA E — Rediseño visual del Draft Preview**
      Ahora mismo es texto plano ("parece escrito con Word"). Necesita más jerarquía
      visual: iconos por grupo muscular, tarjetas por día mejor diferenciadas, quizás
      una mini línea de tiempo semanal — pendiente de propuesta de diseño concreta

- [ ] **PIEZA F — Pulido visual de Cardio**
      Funciona bien pero se ve "convencional". Pendiente de propuesta de diseño
      concreta (tipografía más grande en el número hero, iconos por tipo de actividad,
      gráfico con más personalidad, tarjetas de sesión con color según actividad...)


- [ ] **Chat con IA para crear el mesociclo** — al pulsar "Build it with AI chat" en el chooser
      de creación: conversación libre sobre el objetivo, la IA hace 2-3 preguntas de
      seguimiento (días que entrenas, tiempo disponible, duración del meso), y al final
      propone el mesociclo completo (fase/nivel/duración/días/ejercicios) antes de crear
      nada, con opción de aceptarlo tal cual o pasar al wizard manual con esos datos
      precargados. Necesita una función serverless nueva (como `analyze-meal`) que reciba
      la conversación y devuelva el JSON de la estructura del meso. Diseño ya propuesto,
      pendiente de construir
- [ ] **Sugerencia de tipo de entrenamiento por IA según objetivo** — al entrar en Training, preguntar el objetivo (texto libre o presets: ganar músculo / perder grasa / mejorar movilidad / rendimiento general), una función de IA recomienda tipo+fase+nivel, con opción de aceptar (rellena el wizard) o elegir manualmente. Diseño propuesto, pendiente de confirmar/ajustar con Didac antes de construir
- [ ] **Cardio** — nuevo motor + tablas + pantallas (distancia/tiempo/ritmo/pulsaciones, tendencia simple)
- [ ] **Funcional/CrossFit** — nuevo motor + tablas + pantallas (WOD: movimientos + resultado por tiempo/rondas/peso, sin RIR ni mesociclo)

## Pendiente de revisar
- [ ] Confirmar que el problema de caché/permisos de Supabase quedó resuelto de forma duradera (no volver a aparecer 404 en otra tabla)
- [ ] Probar en el móvil de verdad (pendiente por firewall/red — funciona bien en navegador de PC)

## Construido pero incompleto
- [ ] `fetchMealTemplates` existe pero no hay UI en Nutrition para *usar* una plantilla guardada (solo se puede guardar, no elegir una ya guardada al añadir una comida)
- [ ] Tendencia semanal de peso por ejercicio (existía en la versión web) no está construida en esta versión de Training

## Piezas grandes que faltan (del documento de producto)
- [ ] **Goal Engine** — objetivo de peso/fecha con cálculo real de ETA
- [ ] **Insight Engine real (IA)** — el resumen corto de Nutrition (`nutritionCoachLine`) es reglas fijas, no IA todavía
- [ ] **Recovery Engine** — hoy solo se registra feedback de sesión, no se usa para nada automatizado
- [ ] **Recommendation Engine** de verdad (junta Workout+Nutrition+Goal+Recovery+Insight)
- [ ] **Today** — pantalla principal: card de objetivo, resumen, widget de Nutrición (anillo único + frase, sin números crudos), widget "Up Next" de Entrenamiento, FAB centrado persistente en las 4 pestañas
- [ ] **Perfil** (pantalla aparte, no pestaña) — email, cambiar contraseña/email, cerrar sesión, mover aquí el toggle de tema (hoy en Progress)
- [ ] **Agua y sueño** — no se registran todavía
- [ ] **Fotos de comida** — analizar con IA y descartar la imagen después
- [ ] **Fotos corporales** para estimar % graso aproximado (Progreso)
- [ ] **Sugerencia de comidas por IA según historial** — pieza futura del Insight Engine
- [ ] Comunidad y AI Coach — descartados del alcance por ahora (decisión explícita)

## Despliegue / acceso — EN CURSO
- [~] **Android vía EAS Build**: en proceso de compilar el primer APK instalable.
      Problemas encontrados y ya resueltos: `app.json` tenía `newArchEnabled` (obsoleto en
      SDK 55+, se quitó), versiones de `@react-native-async-storage/async-storage` y
      `react-native-safe-area-context` desincronizadas del SDK (corregidas), conflicto de
      peer deps de React en `npm ci` en el servidor de EAS (arreglado con `.npmrc` con
      `legacy-peer-deps=true`). Probado localmente con `npm ci` limpio — pendiente de que
      la build en el servidor de Expo confirme que todo pasa de verdad.
- [ ] **Actualizaciones sin recompilar**: `eas update` tras el build inicial — sube cambios
      de código JS sin generar un APK nuevo cada vez (gratis hasta 1.000 usuarios activos/mes)
- [ ] **iPhone**: requiere cuenta Apple Developer (99$/año) + TestFlight para compartir con amigos con iOS
- [ ] **Alternativa más simple para compartir con cualquiera**: exportar a web + hosting gratuito (Netlify) — un link, sin instalar nada, funciona en Android e iPhone por igual
- [ ] Antes de compartir con amigos: revisar límites del plan gratuito de Supabase, que el coste de la API de IA lo asumes tú, y si conviene reactivar la confirmación de email (ahora desactivada)

## Notas de arquitectura a tener en cuenta
- El motor (`lib/engine/`) debe seguir sin tocar Supabase ni UI — toda lógica nueva pasa por ahí primero
- Nunca subir `.env` a git (ya está en `.gitignore`)
- El esquema SQL (`supabase/schema.sql`) ya es seguro de re-ejecutar entero (todas las políticas llevan `drop policy if exists` antes)
- Al añadir una tabla nueva, verificar que expone los permisos correctos (`grant select, insert, update, delete ... to authenticated, anon`) — no basta con las políticas RLS
