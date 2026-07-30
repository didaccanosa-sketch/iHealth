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

## En cola (próximo)
- [ ] **Chat con IA para crear el mesociclo** — al pulsar "Build it with AI chat" en el chooser
      de creación: conversación libre sobre el objetivo, la IA hace 2-3 preguntas de
      seguimiento (días que entrenas, tiempo disponible, duración del meso), y al final
      propone el mesociclo completo (fase/nivel/duración/días/ejercicios) antes de crear
      nada, con opción de aceptarlo tal cual o pasar al wizard manual con esos datos
      precargados. Necesita una función serverless nueva (como `analyze-meal`) que reciba
      la conversación y devuelva el JSON de la estructura del meso. Diseño ya propuesto,
      pendiente de construir
- [ ] **Eliminar mesociclos** — de momento solo se pueden crear/terminar, no borrar
- [ ] **No permitir crear un mesociclo nuevo mientras haya uno en curso**
- [ ] **Menú de tipo de entrenamiento al entrar en Training** — tarjetas: Hipertrofia/Fuerza (lo ya construido), Cardio ("Coming soon"), Funcional/CrossFit ("Coming soon")
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

## Despliegue / acceso (informativo, sin construir todavía)
- [ ] **Android**: `eas build --platform android` genera un `.apk` instalable, funciona sin ordenador encendido. Gratis en el plan Free de Expo (15 builds/mes)
- [ ] **Actualizaciones sin recompilar**: `eas update` tras el build inicial — sube cambios de código JS sin generar un APK nuevo cada vez (gratis hasta 1.000 usuarios activos/mes)
- [ ] **iPhone**: requiere cuenta Apple Developer (99$/año) + TestFlight para compartir con amigos con iOS
- [ ] **Alternativa más simple para compartir con cualquiera**: exportar a web + hosting gratuito (Netlify) — un link, sin instalar nada, funciona en Android e iPhone por igual
- [ ] Antes de compartir con amigos: revisar límites del plan gratuito de Supabase, que el coste de la API de IA lo asumes tú, y si conviene reactivar la confirmación de email (ahora desactivada)

## Notas de arquitectura a tener en cuenta
- El motor (`lib/engine/`) debe seguir sin tocar Supabase ni UI — toda lógica nueva pasa por ahí primero
- Nunca subir `.env` a git (ya está en `.gitignore`)
- El esquema SQL (`supabase/schema.sql`) ya es seguro de re-ejecutar entero (todas las políticas llevan `drop policy if exists` antes)
- Al añadir una tabla nueva, verificar que expone los permisos correctos (`grant select, insert, update, delete ... to authenticated, anon`) — no basta con las políticas RLS
