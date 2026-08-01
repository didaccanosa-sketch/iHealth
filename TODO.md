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
- **Actualizado (2026-08-01): el Recommendation Engine será el único camino**, no una capa de pago
  aparte (la idea de monetización se aparca, no se descarta — no es una decisión de ahora mismo).
  El wizard manual no desaparece: pasa a ser el paso de "editar antes de confirmar" dentro del
  propio flujo del motor (nunca se aplica nada sin que el usuario lo revise). Diseño completo en
  `docs/RECOMMENDATION_ENGINE.md`.

## User Model Engine — v1 construido (2026-08-01)
- [x] Tabla `user_model` (jsonb, status unknown/confirmed), motor en
      `features/profile/engine/` (tipos, get/setField/revertField, Question
      Engine declarativo con preguntas para goals/training/nutrition/
      lifestyle). Detalle completo en `docs/USER_MODEL.md`.
      Categorías Body/Motivation/Preferences/Health quedan definidas pero
      vacías (Health pendiente de una decisión aparte, dato sensible).
      Adherence se añadió a las categorías con contenido (se infiere del
      comportamiento — el enganche real a workout/nutrition engine para
      que se autorellene queda pendiente, no era parte de esta pasada).
- [x] Tres tipos de respuesta: `single_choice` (opciones fijas, sin
      ambigüedad — ej. equipo tiene "depende del día / mix" en vez de
      texto libre), `number` (input numérico, ej. peso objetivo) y `text`
      (libre, solo para lo genuinamente abierto: lesiones, alergias). Las
      de tipo `text` pasan por una función nueva con IA
      (`supabase/functions/analyze-profile-answer`, mismo patrón que
      `analyze-meal`) que las normaliza en tags limpios; si falla o no
      está desplegada, se guarda tal cual separado por comas como
      respaldo. **Pendiente: desplegarla** (`supabase functions deploy
      analyze-profile-answer`) — hasta entonces solo usa el respaldo.
- [x] Tarjeta de progressive profiling movida al final de Today, fina y
      compacta, con flecha atrás (deshace la última respuesta, incluida
      la posibilidad de deshacer un salto) y flecha adelante (salta la
      pregunta actual sin confirmarla). Historial solo en memoria de la
      sesión, no se persiste.
- [x] `app/profile.tsx`: cabecera con avatar (inicial, sin foto — queda
      fuera por ahora, necesita Supabase Storage aparte), nombre y
      apellidos (se sincronizan con `profiles.name` para que el saludo de
      Today se actualice solo), edad/sexo/altura/peso inicial, y una
      tarjeta "Settings" con Email/Password/Theme/Log out como
      placeholders "Coming soon" (ninguno funcional todavía).
- [x] "About you" pasa a ser de solo lectura por defecto — hay que tocar
      el botón de lápiz junto al avatar para entrar en modo edición (con
      Cancel/Save explícitos); antes se podía editar directamente sin querer.
- [x] **Log out funcional (2026-08-01)** — `supabase.auth.signOut()` con
      confirmación antes (`window.confirm` en web, `Alert.alert` en
      nativo). Arreglado de paso el motivo original: sin logout real, tras
      borrar un usuario de prueba en Supabase la sesión vieja se quedaba
      cacheada en el navegador y cualquier escritura nueva violaba la FK
      de `user_id` contra `profiles` — ya se puede cerrar sesión desde la
      propia app en vez de borrar el local storage a mano.
- [ ] Pendiente encima de esto: Goal Chat (ver sección dedicada más abajo),
      auto-relleno real desde otros engines hacia `user_model`,
      Recommendation Engine leyéndolo, y el resto de Settings (email,
      contraseña, tema, foto de perfil).
- [x] **Question Engine ampliado (2026-08-01)** — se pasó de 12 a ~42
      preguntas, porque se agotaban demasiado rápido en la tarjeta de
      progressive profiling. Categorías **Motivation**, **Preferences** y
      **Body** dejan de estar vacías y ganan contenido real:
      `mainMotivation`/`biggestObstacle`/`pastSuccessExperience` (texto
      libre, analizado con IA en tags, mismo patrón que lesiones/alergias),
      `accountabilityPreference`/`progressRewardStyle` en Motivation;
      `unitSystem`/`coachingTone`/`reminderTime` en Preferences; `focusArea`
      en Body (única zona estética que se pregunta, nada médico — Health
      sigue aparte y vacía, sin tocar). Se añadieron también preguntas para
      campos que ya existían en el modelo pero nunca se preguntaban
      (`goals.targetDate`, `training.preferredExercises`/`dislikedExercises`,
      `nutrition.dislikedFoods`, `lifestyle.workType`) y campos nuevos de
      contexto personal no sensible: ocupación, cómo te mueves en el día a
      día, frecuencia de viajes, si el fin de semana difiere mucho de la
      semana, nivel de estrés habitual, tiempo/nivel/hábitos de cocina,
      antojos, tipo de cardio preferido, entrenar solo o acompañado, grupo
      muscular favorito/evitado, qué no funcionó de una rutina anterior.
      Deliberadamente fuera por ahora: nada de dinero exacto, "con quién
      vives" (parecía demasiado personal) y fotos de progreso (ya está
      previsto aparte, no hacía falta preguntarlo). Solo tipos + preguntas
      del motor (`features/profile/engine/`) — sin tocar UI, Supabase, ni la
      función `analyze-profile-answer` (sigue pendiente de desplegar, ver
      arriba).

## Goal Chat — diseño (2026-08-01), pendiente de construir (sesión aparte)
Decidido hoy en el chat del Recommendation Engine, pero **se construye en
otra sesión/chat distinta** — esto es solo la especificación para que esa
sesión no tenga que redescubrirla.

- **Sustituye a los chips de objetivo**, no convive con ellos. Hoy
  `GoalCard.tsx` fija el objetivo eligiendo de una lista fija
  (`GOAL_TYPE_OPTIONS`) + campos sueltos (peso objetivo, ejercicio, fecha).
  La razón de pasar a texto libre: cualquier matiz nuevo de objetivo con
  los chips actuales significa añadir más chips/variables sin parar — con
  texto libre no hace falta anticipar cada caso.
- **Vive en Today, junto a la tarjeta de objetivo** — no es una pantalla ni
  un chat aparte navegable, es la forma de fijar/editar el objetivo desde
  ahí mismo.
- **Si la IA no puede interpretarlo, no adivina ni cae a los chips**: le
  dice al usuario que no lo ha entendido y le deja intentarlo de nuevo
  (reintentar el texto), igual que un malentendido en una conversación
  real — nunca fija un objetivo a medias o incorrecto en silencio.
- **Salida esperada de la interpretación**: mismo `GoalType` +
  `targetWeightKg`/`targetDate`/`targetExercise`/`targetExerciseKg` que ya
  usa `GoalsModel` (`features/profile/engine/types.ts`) — el texto libre
  solo cambia cómo se rellenan esos campos, no qué campos existen.
  Necesita una función nueva en el servidor (mismo patrón de proxy a
  Anthropic que `analyze-meal`/`analyze-profile-answer`/
  `recommendation-explain`), que reciba el texto y devuelva JSON
  estructurado — nunca texto libre suelto guardado tal cual.
- Sigue aplicando el principio del resto del motor: la IA interpreta/
  redacta, nunca decide ni calcula — una vez interpretado el objetivo, el
  resto (Goal Engine, Recommendation Engine) sigue funcionando exactamente
  igual que ahora, sin saber que vino de un chat en vez de unos chips.

## Goal Engine — v1 construido (2026-08-01)
- [x] Motor genérico en `lib/engine/goal-engine.ts` (lógica pura, sin
      Supabase/UI): recibe una serie temporal de una métrica cualquiera +
      un valor objetivo + fecha opcional, y calcula tendencia real
      (regresión lineal), veredicto (`insufficient_data / unsupported /
      reached / on_track / behind / off_track`) y fecha proyectada real —
      no inventa números con pocos datos, lo dice explícitamente. No sabe
      nada de nutrición/entrenamiento; el Recommendation Engine (pendiente)
      es quien debe leer su veredicto para decidir qué ajustar, no al revés.
- [x] `GoalType` ampliado a `lose_fat / gain_muscle / maintain / strength /
      stamina / mobility` (antes solo tenía `performance`, vago y sin uso).
      Preguntas nuevas en el Question Engine para el objetivo de fuerza
      (ejercicio + 1RM estimado objetivo).
- [x] Conectado de verdad a dos métricas: Peso (tabla `weight_logs`, que ya
      existía sin usar) y Fuerza (1RM estimado por sesión, reconstruido a
      partir de `meso_session_sets`/`meso_exercises`/`meso_sessions` con la
      fórmula de Epley que ya usaba Training). Stamina y Mobility se pueden
      elegir como objetivo, pero el motor responde "sin datos conectados"
      hasta que existan Cardio v2 / tracking de movilidad — enchufar esas
      fuentes no debería requerir tocar la lógica del motor.
- [x] Traducción pequeña objetivo→fase de mesociclo (`suggestPhaseForGoal`:
      lose_fat→definición, gain_muscle→volumen, maintain→mantenimiento),
      deliberadamente separada del vocabulario de objetivo del usuario para
      no forzar tipos como fuerza/resistencia/movilidad a encajar ahí.
- [x] UI en Progress (`components/goal/GoalCard.tsx`): fijar objetivo,
      tarjeta de veredicto con mini-gráfico de tendencia, input rápido para
      registrar peso del día.
- [x] Split Today/Progress: `components/goal/useGoalEvaluation.ts` (hook
      compartido con la carga del User Model + evaluación) y
      `components/goal/shared.tsx` (constantes/UI compartidas) para no
      duplicar lógica entre las dos vistas. Today usa `GoalSummaryCard`
      (solo lectura, glass, tapa a Progress); Progress usa `GoalCard`
      (fijar/editar objetivo, registrar peso, gráfico).
- [x] Halo de progreso en el `GoalSummaryCard` de Today (mismo estilo que
      el ring de Nutrition) — `progressFraction` nueva en `goal-engine.ts`.
      Es progreso de **valor** (cuánto llevas recorrido desde tu peso/marca
      de partida hasta el objetivo), no de tiempo — decisión explícita,
      dice lo que de verdad has avanzado sea cual sea el ritmo. Punto de
      partida: `identity.startingWeightKg` para peso, primer punto del
      histórico para fuerza.
- [x] **Peso: máximo un registro al día (2026-08-01)**. Antes se podía meter
      el peso varias veces el mismo día y quedaban todos guardados por
      separado. Ahora, si ya registraste hoy, el campo de Progress se
      rellena solo con lo que pusiste y el botón cambia a "Actualizar" —
      no hay forma de añadir uno segundo, solo corregir el de hoy.
      (**Pendiente: ejecutar el cambio de base de datos contra Supabase**,
      como con las demás tablas/cambios nuevos.)
- [x] Borradas las tablas `goals` y `goal_predictions` de `schema.sql` —
      restos del scaffolding original, duplicadas con `user_model.goals`,
      ningún código las usaba. `goal_predictions` dependía de `goals` por
      FK, así que en Supabase hay que borrarla a ella primero.
- [ ] Pendiente encima de esto: que el Recommendation Engine consulte el
      veredicto del Goal Engine al generar recomendaciones; conectar
      Stamina (cuando exista Cardio v2) y Mobility (cuando exista su
      tracking); fotos corporales para objetivos de composición corporal.

## Insight Engine (Nutrition) — ya construido, revisado hoy (2026-08-01)
- [x] Ya estaba construido de antes (el TODO estaba desactualizado y decía que no):
      hechos categóricos en `lib/engine/nutritionInsight.ts` (nunca números crudos) →
      función `nutrition-insight` que los redacta en una frase con Claude → caché en
      tabla `nutrition_insights` por firma de comidas → fallback a `nutritionCoachLine`
      (reglas fijas) si la IA falla o no responde a tiempo.
- [x] Firma de caché (`nutritionInsightSignature`) solo dependía de las comidas de hoy,
      no de la ventana de 3 días que también entra en el cálculo de `trend` — ahora
      incluye también los días recientes, así que cambiar una comida de ayer invalida
      bien la caché de hoy.
- [x] Enchufado también en el tab de Nutrition (antes solo estaba en Today) — mismo
      patrón: fallback instantáneo + sustitución en segundo plano si la IA responde.
- [ ] Pendiente confirmar si la función `nutrition-insight` está realmente desplegada
      en Supabase (`supabase functions deploy nutrition-insight`) — si no lo está, todo
      sigue funcionando pero siempre en modo fallback (reglas fijas), sin romper nada.

## Estimación genérica del día 1 — v1 construida (2026-08-01)
Problema: el Goal Engine exige mínimo 3 registros repartidos en 5+ días antes
de dar cualquier veredicto real — correcto, pero significa que un usuario
nuevo no ve nada útil el primer día.
- [x] `estimateFitnessBaseline`: nivel base (bajo/medio/alto) calculado —
      sin pregunta nueva — a partir de actividad diaria, días de
      entrenamiento/semana, experiencia y meses entrenando.
- [x] Pregunta nueva en Training: **meses entrenando de forma constante**
      (`training.trainingMonths`, tipo `number`) — más preciso que el
      binario `beginner`/`advanced` solo.
- [x] `goal-engine.ts`: campo `confidence: 'measured' | 'generic'` en
      `GoalEvaluation`. Si no hay tendencia real pero sí un punto de partida
      (peso inicial del perfil), usa una tasa genérica según objetivo +
      nivel base en vez de `insufficient_data`. Marcado explícitamente en
      el mensaje y con chip visual, nunca mezclado con datos reales.
      Arreglado de paso un caso borde: si el único dato disponible ya
      coincide con el objetivo (sin histórico ni ritmo), se devuelve
      `reached` en vez de `insufficient_data`.
- [x] Solo para Peso. Fuerza se queda sin genérico — decisión explícita, sin
      una marca real registrada no hay ninguna base honesta de la que partir.
- [x] Chip de confianza visible tanto en `GoalCard.tsx` (Progress) como en
      `GoalSummaryCard.tsx` (Today).
- [ ] **Pendiente, pero es tarea del chat "Recommendation Engine", no de
      este**: sustituir el ritmo genérico por perfil demográfico por uno
      basado en el déficit/superávit calórico real que ya calcula el
      Strategy Planner (`KCAL_ADJUSTMENT` en `recommendation-engine.ts`,
      construido) — mejor fundado que adivinar por edad/sexo/actividad,
      sigue sin ser `measured`. Como el Goal Engine no debe leer directamente
      de otro motor de dominio (esa conexión le toca al Recommendation
      Engine, el único orquestador que lee varios motores a la vez), esto
      se queda anotado aquí pero se construye en el otro chat.

## Onboarding real al registrarse — diseñado, pendiente de construir
Hoy todas las preguntas del User Model salen poco a poco en la tarjeta de
progressive profiling al final de Today — bien para preguntas secundarias,
pero un usuario recién registrado tarda en ver nada del Goal Engine porque
faltan datos básicos. Idea: una pantalla de onboarding real justo después
de registrarse, antes de entrar a Today, que reutiliza el Question Engine
que ya existe (no uno nuevo) pero solo con las preguntas mínimas para poder
dar la primera estimación:
- [ ] Detectar "usuario recién registrado, sin ningún campo de `user_model`
      confirmado todavía" y redirigir a la pantalla de onboarding en vez de
      a Today directamente (una sola vez, no se vuelve a mostrar después).
- [ ] Recorrido mínimo de la primera vez: objetivo (`goals.type`), peso
      objetivo si aplica, peso inicial (si no viene ya de `profiles`), meses
      entrenando, nivel de actividad diaria. Todo por el Question Engine
      existente, filtrando qué preguntas entran en este recorrido corto.
- [ ] Al terminar, aterriza en Today con el Goal Engine ya pudiendo mostrar
      su primera estimación genérica en Progress (ver sección de arriba).
- [ ] El resto de preguntas (nutrición, lesiones, preferencias, adherence...)
      se siguen preguntando poco a poco después, en Today, como hasta ahora
      — el onboarding no las incluye, solo lo mínimo para el primer
      estimado.
- [ ] Pendiente de decidir: qué pasa si el usuario cierra/sale del
      onboarding a medias (¿se puede saltar y completar luego desde Today,
      o es obligatorio terminarlo?).

## Recommendation Engine — diseño (2026-08-01), pendiente de construir
Diseño pensado en chat, repartido en **2 chats separados** para construirlo:
- **Chat "Workout Engine"** — 2 partes (contenedor combinado + qué pasa
  con las Piezas A-F ya en cola, ver más abajo)
- **Chat "Recommendation Engine"** — 1 parte (el motor orquestador en sí,
  con sus 3 puntos de entrada)

### Qué es
El único orquestador que puede leer más de un motor de dominio a la vez
(Goal, Recovery, Nutrition, Workout, Insight) — los motores de dominio
siguen sin conocerse entre sí, solo lo conoce él. Mismo patrón técnico que
Insight Engine: función pura en `lib/engine/` que calcula la prescripción
de forma determinista + una llamada a IA solo para redactarla, con
fallback a reglas fijas si falla. La IA nunca decide, solo redacta.

### Decisiones ya tomadas
- **Revisión antes de aplicar**: nunca se guarda nada automáticamente (ni
  objetivo de macros ni mesociclo) — el usuario ve la propuesta y
  confirma. El wizard manual no es un camino aparte: es este mismo paso
  de revisión/edición.
- **Se unifican 3 piezas sueltas del TODO** en este único motor, con
  distintas interfaces encima: "Chat con IA para crear el mesociclo",
  "Sugerencia de tipo de entrenamiento por IA" y "Sugerencia de comidas
  por IA" dejan de ser features separadas.
- **Sustituye la pieza "Estimación genérica del día 1"** (no convive con
  ella): en vez de que el Goal Engine adivine un ritmo por perfil
  demográfico (`estimateFitnessBaseline`), usa el déficit/superávit
  calórico y la estructura de entreno que el propio Recommendation Engine
  acaba de prescribir para proyectar el primer ritmo — sigue sin ser
  "measured", pero está mejor fundado que un genérico puro.
- **3 puntos de entrada**: Onboarding (primera propuesta de dieta +
  mesociclo de golpe), Nutrition (recalcular objetivo de macros bajo
  demanda), Workout (proponer/recalcular plan de entreno).
- **Diseño completo cerrado (2026-08-01)** — ver `docs/RECOMMENDATION_ENGINE.md`:
  pipeline interno de 6 pasos (interpretar objetivo → construir contexto
  → Strategy Planner → delegar a los motores → validar coherencia entre
  ellos → plan del día). El motor decide el "qué" (frecuencia, calorías,
  macros, prioridades de volumen); el split día a día lo sigue decidiendo
  el Workout Engine, no sube al Strategy Planner (para no duplicar el
  algoritmo de énfasis que ya funciona). Edición manual puntual no
  cambia nada a futuro; un patrón repetido de ediciones sí se guarda como
  preferencia (`Adherence` del User Model) y realimenta al Strategy
  Planner. Adaptación dinámica limitada a como mucho un replanteo por
  semana, y siempre explicando por qué si ajusta algo para resolver un
  conflicto de Validación.

### Orden de construcción (2026-08-01)
De lo que no depende de nada más a lo que depende de otras piezas:
1. [x] **Strategy Planner puro (2026-08-01)** — `lib/engine/recommendation-engine.ts`,
   `computeStrategyPlan()`. Sin Supabase ni IA. Recibe Goal Engine + User
   Model (ya desenvuelto, no el `UserModelData` en bruto), devuelve el set
   completo de targets: calorías/macros (Mifflin-St Jeor + ajuste por
   objetivo), comidas/día, frecuencia de entreno, fase, cardio/semana
   (con ajuste si `readiness === 'fatigued'`), y sueño/pasos como
   genéricos fijos por ahora (8h / 8000 pasos, sin personalizar todavía).
   Prioridad de volumen por grupo muscular queda fuera a propósito — no
   había con qué decidirla sin inventar precisión. Cada número trae su
   explicación en texto plano (`explanations`).
2. [x] **Validation (2026-08-01)** — `validateStrategyPlan()`, mismo
   archivo. Suelo calórico absoluto (1200 kcal), suelo más alto si hay
   ≥5 entrenos/semana (1500 kcal), tope de días/semana para principiante
   con <6 meses entrenando (máx. 4). Ningún ajuste es silencioso — todos
   quedan en `conflicts` y se añaden a `explanations`.
3. [x] **Persistencia del objetivo de macros (2026-08-01)** — tabla
   `macro_goals` nueva en `schema.sql` (histórico por fecha, RLS+grants
   igual que las demás), `fetchCurrentMacroGoal`/`saveMacroGoal` en
   `lib/data/nutrition.ts`. `index.tsx` y `nutrition.tsx` ya cargan el
   objetivo guardado del usuario y caen a `DEFAULT_GOALS` solo si no
   existe ninguno todavía (**pendiente: ejecutar la tabla nueva contra
   Supabase**, como con las demás). Sigue sin haber UI para guardar un
   objetivo — de momento nadie inserta filas, así que en la práctica
   sigue usando el genérico hasta el paso 4. **Decidido (2026-08-01, ver
   paso 8): no se edita a mano.** El objetivo se reajusta solo mediante
   feedback real (peso registrado vs. veredicto del Goal Engine), no
   desde una pantalla de edición — ver "Adaptación dinámica" más abajo.
4. **Delegación real** — conectar el output del paso 1 con Workout Engine
   (crear mesociclo) y Nutrition Engine (ya con el paso 3 hecho). El
   motor empieza a ser usable de verdad para las entradas Nutrition y
   Workout, pasando por el wizard/edición como paso de revisión.
   - [x] **Nutrition (2026-08-01)** — junta objetivo + histórico + estado de
     recuperación real del usuario y llama al Strategy Planner
     (`lib/data/recommendation.ts`, `getStrategyRecommendation`). Botón
     "Recalcular con el motor" en Nutrition: enseña la propuesta antes de
     nada, solo se guarda si confirmas. Si no hay objetivo fijado, avisa
     en vez de fallar.
   - [x] **Arreglado (2026-08-01): fallaba al aplicar** — "Could not find
     the 'mealsPerDay' column of 'macro_goals'". `saveMacroGoal`
     esparcía el objeto completo del Strategy Planner (que incluye
     `mealsPerDay`) directo al insert; ahora filtra explícitamente solo
     los 5 campos que existen en la tabla.
   - [x] **Arreglado (2026-08-01): la propuesta usaba diálogos nativos del
     navegador** (`window.confirm`/`Alert.alert`) — en web se veía como un
     aviso suelto de "localhost" en vez de parte de la app. Ahora Nutrition
     enseña la propuesta en una tarjeta propia (mismo patrón que el modal
     de comidas) y Workout muestra el aviso de "sin objetivo"/error dentro
     de la propia pantalla, no en un pop-up del navegador.
   - [x] **Arreglado (2026-08-01): el genérico sin perfil ignoraba el
     objetivo del todo** — sin edad/altura/peso rellenados, salían siempre
     las mismas calorías cambiaras lo que cambiaras el objetivo. Ahora el
     genérico también se ajusta según objetivo (solo deja de ser
     "measured" de verdad, no de ignorar el objetivo).
   - [x] **Botón de info en ambas propuestas (2026-08-01)** — icono "i" en
     la tarjeta de Nutrition y en la pantalla de revisión de Workout,
     despliega el porqué de cada número (`StrategyPlan.explanations`),
     nunca oculto por defecto pero tampoco intrusivo.
   - [x] **Workout (2026-08-01)** — `StrategyPlan.training` ahora incluye
     también `level` (de la experiencia del usuario, `lib/engine/recommendation-engine.ts`).
     Nueva opción "Recommend for me" en el selector de creación de rutina
     (aparte de "Build it with AI chat", que sigue siendo la pieza de chat
     conversacional, distinta y todavía sin construir). Genera los
     días/ejercicios con el mismo generador que ya usaba "Focused split"
     (`buildFocusSplit`, sin prioridad de grupo muscular por ahora) y entra
     directo a la pantalla de revisión del asistente — nada se crea sin
     confirmar. Si no hay objetivo fijado, avisa en vez de fallar.
5. [x] **Daily planning, versión mínima (2026-08-01)** —
   `computeDailyFocus` (`lib/engine/recommendation-engine.ts`): mira
   recuperación + entreno + nutrición a la vez y elige UNA cosa que
   destacar hoy (no una lista de todo), con prioridad fatiga > entreno
   pendiente > nutrición. Sustituye la tarjeta de Today que antes solo
   concatenaba la frase de nutrición + próxima sesión sin priorizar nada.
   Cuando el foco resulta ser nutrición, se sigue usando la frase real del
   Insight Engine (con IA) en vez de una genérica — no se pierde ese
   trabajo, solo se decide cuándo tiene sentido mostrarlo. Sin IA en la
   lógica de qué destacar (reglas fijas, como el resto del motor).
   - [ ] Pendiente: el resto del rediseño de Today que se vio en una
     imagen de referencia (agua, sueño, checklist con anillos, próxima
     comida con foto, tendencia de peso como tarjeta propia) — aparte,
     depende de piezas que no existen todavía (tracking de agua/sueño).
6. **Capa de IA**:
   - [x] **Redacción de cada propuesta (2026-08-01)** — nueva función
     `supabase/functions/recommendation-explain` (mismo patrón proxy que
     `analyze-meal`/`nutrition-insight`, **pendiente desplegar**:
     `supabase functions deploy recommendation-explain`). Recibe los
     hechos en español sencillo que ya calculaba el Strategy Planner
     (ahora separados por dominio, ver más abajo) y los redacta en un
     párrafo natural y personalizado — solo se pide al abrir el
     desplegable de info, no en cada recomendación, y si falla se queda
     el texto sencillo de siempre. Nutrition solo recibe/explica hechos de
     nutrición, Workout solo de entreno — nunca mezclados.
   - [x] **Explicaciones separadas por dominio (2026-08-01)** —
     `StrategyPlan.explanations` pasó de una lista única a
     `{ nutrition: string[], training: string[] }`; los conflictos de
     Validation también se reparten igual. De paso, todo el texto se
     reescribió en español sencillo (fuera "TDEE", "Mifflin-St Jeor",
     "measured/generic" tal cual).
   - [ ] **Interpretación de objetivo en texto libre (Goal Chat)** —
     diseño cerrado, ver sección dedicada "Goal Chat" más arriba. Se
     construye en otra sesión, no es parte de este chat del
     Recommendation Engine.
7. [x] **Tracking de agua/sueño/pasos (2026-08-01)** — construido, ver sección
   dedicada más abajo. Sigue pendiente el siguiente paso: que estos targets
   dejen de ser genéricos fijos y el Strategy Planner los compare contra lo
   registrado de verdad.
8. **Adaptación dinámica** — replanteo automático limitado (máx. 1/semana),
   necesita datos reales de adherencia fluyendo (workout/comidas →
   `Adherence` del User Model, ya pendiente aparte) más lo del paso 7.
   **Decidido (2026-08-01): así se reajusta el objetivo de Nutrition, no
   hay pantalla de edición manual.** Regla concreta: cuando el Goal
   Engine marca `behind`/`off_track` (ej. "has ganado más peso del que
   deberías"), el Strategy Planner reajusta las calorías/macros solo,
   sin que el usuario las toque a mano — mismo límite de 1 replanteo/
   semana y misma exigencia de explicar el porqué que ya tenía el resto
   del punto 8.
9. **Cardio y Funcional como motores reales** — amplía la Delegación del
   paso 4 a más modalidades; no bloquea nada de lo anterior, puede ir en
   paralelo cuando toque.

Los pasos 1 y 2 son los únicos sin ninguna dependencia — punto de partida.
  conflicto de Validación.

### Entrada Nutrition — falta la pieza base, no es un rediseño
Hoy `DEFAULT_GOALS` (`lib/engine/nutrition-engine.ts`) es una constante
fija (2900 kcal / 155g proteína) importada tal cual en `nutrition.tsx` e
`index.tsx`. **Resuelto (2026-08-01)**, ver paso 3 del "Orden de
construcción" más arriba:
- [x] Tabla `macro_goals` (con fecha, no solo el valor actual — para
      poder correlacionar después cambios de objetivo con cambios de
      ritmo en Progress). **Pendiente: ejecutar contra Supabase.**
- [x] `nutrition.tsx` e `index.tsx` cargan el objetivo del usuario, caen
      al genérico solo si no existe aún
- [x] **Decidido (2026-08-01): no se edita a mano.** El objetivo cambia
      solo vía "Adaptación dinámica" (paso 8 del Recommendation Engine) —
      reajuste automático cuando el feedback real (peso registrado) se
      desvía del veredicto esperado del Goal Engine, no una pantalla de
      edición aparte.

### Entrada Workout — posible cambio grande de estructura (Plan B)
Hoy Training es 3 modos independientes (Hipertrofia/Fuerza construido,
Cardio y Funcional "coming soon", cada uno su propio motor/tablas). Idea:
en vez de que el usuario elija un modo de un menú fijo, el objetivo decide
qué mezcla de modalidades tiene sentido — plan combinado real (ej. 3 días
de meso + 2 de cardio en la misma semana), no solo un enrutado más listo
hacia uno de los tres. Se elige esto sobre la opción más conservadora
porque **no hay usuarios reales todavía** — no hay coste de migración por
cambiar la estructura ahora.
- [x] **Contenedor `training_programs` construido (2026-08-01)**, envoltorio
      delgado — schema nuevo en `supabase/schema.sql` (**pendiente: ejecutar
      contra Supabase**, como con las demás tablas nuevas — no se ha
      desplegado desde aquí). `mesocycles.program_id` (nullable, `on delete
      cascade`). `createMesocycle` crea programa + mesocíclo 1:1.
      `startMesocycle` mueve la exclusividad a `training_programs.status =
      'active'` (mantiene también el chequeo antiguo sobre `mesocycles.started`
      por si hay mesociclos de antes de `program_id`, sin programa que los
      envuelva). `advanceMesocycle`/`endMesocycleEarly` reflejan `finished` en
      el programa (libera el hueco de exclusividad). `deleteMesocycle` borra
      desde el programa cuando existe (cascada limpia). Se rellena solo con
      un mesociclo por ahora — Cardio y Funcional entran en el mismo
      contenedor cuando se construyan, sin rehacer la estructura otra vez.
- [ ] Qué se rompe de lo ya construido, a repasar cuando se diseñe la mezcla
      real de modalidades: `fetchRecentSessionFeedback` del Recovery Engine
      (asume `session_index % days_per_week` de un único mesociclo), el
      widget "Up Next" de Today, Progress — hoy no se han tocado, siguen
      leyendo `mesocycles` directamente y funcionan igual que antes.
- [ ] **Idea propuesta (2026-08-01) para resolver el punto de arriba:** en
      vez de calcular "qué toca hoy" sobre la marcha con
      `session_index % days_per_week` (asume una sola modalidad
      secuencial), que el Recommendation Engine mantenga un calendario
      interno explícito — qué toca cada día, de qué modalidad — que se
      recalcula cada vez que pasa algo relevante (completar, saltarse un
      día, etc.), en vez de inferirlo cada vez. Con eso asignar sesiones
      de Cardio/Funcional al día que toque es más simple aunque esos
      motores todavía no existan — el calendario puede reservar el hueco
      igualmente. Sin diseñar el detalle todavía (¿tabla persistida o
      calculado al vuelo?, cómo interactúa con `training_programs`) —
      pendiente para el chat de Workout Engine.
- [x] **Decidido (2026-08-01)**: las Piezas A-F se construyen tal cual están,
      sin esperar al contenedor — ninguna toca la relación mesociclo↔programa.
      Al revisar, A/B/C ya estaban construidas y D se completó en esta misma
      pasada (ver sección "En cola" más abajo).
- [x] **`ProgramScreen` construida (2026-08-01)**: nueva pantalla
      (`components/training/ProgramScreen.tsx`), primera vista de la pestaña
      Training (sustituye a `TrainingTypeMenu`, ya borrada). Muestra el
      programa activo (resumen + progreso, tap para continuar) arriba, y
      debajo un único bloque "Start something" con tres filas siempre
      visibles — New routine / Cardio / Functional (coming soon) — en vez de
      un botón que aparece/desaparece más una fila suelta de Cardio. "New
      routine" se desactiva con nota explicativa si ya hay un programa activo;
      Cardio siempre queda accesible, esté o no en marcha un mesociclo (esto
      era importante no romperlo). Aclarado en la propia conversación: esto
      es orden visual, no facilita nada al Recommendation Engine — ese se
      conecta dentro de `CreateMesoChooser` (opción "Build it with AI chat"),
      no aquí.
- [x] **Orden decidido (2026-08-01, corregido)**: el contenedor
      `training_program` (envoltorio delgado, ver arriba) se puede construir
      independientemente — no necesita esperar a nada de Cardio. Se descartó
      la idea de un "motor de prescripción de Cardio" aparte: decidir cuánto
      cardio hacer según objetivo + días de fuerza + `readiness` de Recovery
      lee 4 dominios a la vez, que es exactamente la definición de
      `docs/SYSTEM_ARCHITECTURE.md` de lo que le toca al Recommendation
      Engine, no a un motor de dominio nuevo (los motores de dominio no se
      conocen entre sí). Orden real: **contenedor → Recommendation Engine**.
      La lógica de frecuencia de cardio queda documentada abajo, dentro de la
      entrada Workout del Recommendation Engine, en vez de como motor suelto.

#### Lógica de frecuencia de Cardio (para cuando se construya la entrada Workout)
Sesiones/semana sugeridas por tipo de objetivo (conservador, banda de
duración genérica 20-40 min, sin inventar precisión que no hay — mismo
principio que `confidence: 'generic'` del Goal Engine):
- `lose_fat`: 3-4/semana, sobre todo ritmo suave
- `stamina`: 3-4/semana, mezclando suave + 1 sesión más exigente (el único
  objetivo donde cardio es protagonista directo)
- `maintain`: 2/semana, ritmo suave
- `gain_muscle`: 1-2/semana, cortas y suaves (no competir con recuperación/superávit)
- `strength` / `mobility`: 0-1/semana, opcional, solo salud general

Si `readiness` (Recovery Engine) es `fatigued`, se baja un escalón o se
sugiere descanso en vez de empujar una sesión dura. No cierra el hueco de
`stamina` en el Goal Engine (`GOAL_METRICS.stamina = 'unsupported'`) — eso
necesita una métrica de progreso medible aparte, es un problema distinto a
prescribir esfuerzo.

## En cola (próximo) — Review de la última actualización (Cardio + Plantillas)

> **Decisión (2026-08-01):** estas piezas se construyen tal cual están,
> sin esperar al contenedor `training_program` — ninguna toca la
> relación mesociclo↔programa, así que no hay riesgo de rehacer trabajo
> después. El contenedor en sí queda pendiente de diseño aparte (ver
> "Recommendation Engine — diseño" más arriba).

- [x] **PIEZA A — Rehacer el flujo de creación con plantilla (bug de pregunta repetida)** —
      confirmado ya construido (2026-08-01): TemplatePicker recoge fase/nivel/duración en
      la misma pantalla, Focused split ya no está limitado a 4-7 días, y el wizard entra
      directo al paso 3 cuando viene de una plantilla.

- [x] **PIEZA B — Reordenar ejercicios en la revisión** — confirmado ya construido
      (botones ↑/↓ por ejercicio en el paso 3 del wizard).

- [x] **PIEZA C — Transiciones entre pantallas** — confirmado ya construido
      (`components/FadeIn.tsx`, enchufado en `training.tsx`, `TemplatePicker` y `MesoWizard`).

- [x] **PIEZA D — Feedback explicativo para splits generados por el algoritmo** (2026-08-01)
      Nueva `explainFocusChoices` en `workout-engine.ts`: cuando el split viene del
      generador de énfasis (Focused split), explica qué grupo se priorizó, cuántas veces
      aparece y con qué se emparejó cada día, más una nota proactiva de recuperación/deload.
      `NewMesoInput` gana `generatedFrom`/`focusPriority` (solo metadata de UI, no se
      persiste) para que el wizard sepa cuándo mostrar esta explicación en el paso 3.

- [ ] **PIEZA E — Rediseño visual del Draft Preview** — pendiente de propuesta de diseño
      concreta antes de construir (ver tarea abierta).
      Ahora mismo es texto plano ("parece escrito con Word"). Necesita más jerarquía
      visual: iconos por grupo muscular, tarjetas por día mejor diferenciadas, quizás
      una mini línea de tiempo semanal — pendiente de propuesta de diseño concreta

- [ ] **PIEZA F — Pulido visual de Cardio**
      Funciona bien pero se ve "convencional". Pendiente de propuesta de diseño
      concreta (tipografía más grande en el número hero, iconos por tipo de actividad,
      gráfico con más personalidad, tarjetas de sesión con color según actividad...) —
      pendiente de propuesta de diseño concreta antes de construir (ver tarea abierta).


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

## Recovery Engine — v1 construido (2026-08-01)
- [x] Motor genérico en `lib/engine/recovery-engine.ts` (lógica pura, sin
      Supabase/UI, mismo patrón que Goal Engine): recibe una lista de
      sesiones (fecha, grupos musculares entrenados, dificultad, dolor
      articular) y calcula un `readiness` general (fresh/moderate/fatigued)
      más un desglose interno por grupo muscular (`byMuscleGroup`), pensado
      para el User Model / futuro Recommendation Engine, no se muestra hoy.
      Recuperación esperada por grupo = días según dificultad reportada
      (facil/normal/dificil/limite → 1-4 días), +1 si hubo dolor articular
      en esa sesión. El readiness general es el peor estado entre los
      grupos entrenados recientemente.
- [x] `fetchRecentSessionFeedback` nuevo en `lib/data/workout.ts`: conecta
      por primera vez el feedback que ya se guardaba en `meso_sessions`
      (difficulty/joint_pain/joint) — antes no lo leía nada. Junta sesiones
      completadas de los últimos 14 días (across todos los mesociclos, no
      solo el activo) con qué grupos musculares tocó cada una (vía
      `session_index % days_per_week`, igual que `getSessionDef`).
- [x] Tarjeta temporal en Today mostrando solo el `readiness` general
      (marcada visualmente "PROVISIONAL") — el desglose por grupo muscular
      es solo interno por ahora, no tiene UI.
- [ ] Pendiente encima de esto: diseño definitivo de la tarjeta (hoy es
      provisional), mapear dolor articular a grupos musculares concretos
      (hoy el dolor se asocia a los grupos de esa sesión, no a la
      articulación en sí), y que el futuro Recommendation Engine lea el
      readiness para ajustar recomendaciones.

## Tracking de agua/sueño/pasos — v1 construido (2026-08-01)
- [x] Tres tablas nuevas: `water_logs` (ya existía en el esquema, sin usar y
      sin `grant` — bug arreglado de paso, mismo patrón que ya pasó con
      otras tablas), `sleep_logs` y `step_logs` (nuevas, un valor único por
      día vía `upsert`, mismo patrón que `weight_logs`). **Pendiente:
      ejecutar el esquema contra Supabase.**
- [x] Agua se registra a toques ("+vaso" = 250 ml), cada toque es una fila
      nueva — el total del día es la suma, no un valor que se sobrescribe.
      Sueño y pasos son un número manual una vez al día, sin integración con
      wearables (decisión explícita, no estaba planeado para esta pasada).
- [x] `lib/data/tracking.ts`: `addWater`/`logSleep`/`logSteps`/
      `fetchTodayTracking`.
- [x] Targets genéricos fijos (2500 ml / 8h / 8000 pasos) exportados desde
      `lib/engine/recommendation-engine.ts` — mismos que ya usaba el
      Strategy Planner internamente, ahora también visibles para el widget
      sin depender de tener un objetivo fijado.
- [x] Widget único en Today (`components/tracking/TrackingCard.tsx`),
      sustituye la card placeholder — sin pantalla propia ni histórico
      (decisión explícita para esta pasada).
- [ ] Pendiente encima de esto: que el Strategy Planner compare estos
      targets contra lo registrado de verdad en vez de quedarse en genérico
      fijo (ver paso 7 del Recommendation Engine más arriba).

## Piezas grandes que faltan (del documento de producto)
- [ ] **Recommendation Engine** de verdad (junta Workout+Nutrition+Goal+Recovery+Insight) — diseño ya hecho, ver sección dedicada arriba; se construye repartido en 2 chats ("Workout Engine" + "Recommendation Engine")
- [~] **Today** — pantalla principal: card de objetivo hecha (`GoalSummaryCard`, solo vistazo, tapas a Progress para editar/detalle), resumen y widget de Nutrición y widget "Up Next" de Entrenamiento ya existían. Falta: FAB centrado persistente en las 4 pestañas
- [~] **Perfil** (pantalla aparte, no pestaña) — `app/profile.tsx` ya existe con la sección de Identity (age/sex/height/starting weight). Falta: email, cambiar contraseña/email, cerrar sesión, mover aquí el toggle de tema (hoy en Progress)
- [x] **Agua, sueño y pasos** — tracker construido (2026-08-01), ver sección dedicada más abajo
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

### Antes de subir a Netlify — checklist (repaso 2026-08-01)
- [ ] Ejecutar contra Supabase los cambios de esquema pendientes: tabla de
      histórico de objetivos de nutrición (`macro_goals`), límite de un
      registro de peso al día, contenedor de programas de entrenamiento
      (`training_programs`)
- [ ] Desplegar las funciones de IA pendientes: corrección ortográfica en
      el análisis de comidas (`analyze-meal`), análisis de respuestas de
      perfil (`analyze-profile-answer`)
- [ ] Reactivar la confirmación de email (ahora desactivada) para evitar
      cuentas con emails falsos al repartir un link público
- [ ] Confirmar que el problema de permisos/caché de Supabase (404 en
      tabla nueva) no reaparece con ninguna tabla
- [ ] Revisar límites del plan gratuito de Supabase y coste esperado de la
      API de IA según cuánta gente reciba el link

## Notas de arquitectura a tener en cuenta
- El motor (`lib/engine/`) debe seguir sin tocar Supabase ni UI — toda lógica nueva pasa por ahí primero
- Nunca subir `.env` a git (ya está en `.gitignore`)
- El esquema SQL (`supabase/schema.sql`) ya es seguro de re-ejecutar entero (todas las políticas llevan `drop policy if exists` antes)
- Al añadir una tabla nueva, verificar que expone los permisos correctos (`grant select, insert, update, delete ... to authenticated, anon`) — no basta con las políticas RLS
