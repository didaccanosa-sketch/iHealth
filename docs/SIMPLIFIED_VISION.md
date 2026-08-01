# Visión simplificada — notas de diseño (2026-08-01)

Rama de trabajo: `simplificado`. Nada de esto está construido todavía — es
la base de diseño para retomar antes de escribir código. No sustituye a
`docs/RECOMMENDATION_ENGINE.md` / `USER_MODEL.md` / `SYSTEM_ARCHITECTURE.md`
(siguen describiendo lo ya construido), pero es la referencia a seguir para
lo nuevo.

## Por qué esto existe

El proyecto se había ido llenando de piezas (motores de dominio separados,
User Model de 10 categorías, Question Engine de 42 preguntas, Goal Chat,
contenedor de programas, Cardio/Funcional como motores aparte...). Nada de
eso se borra ni se toca — se congela — pero deja de ser el plan por
defecto. A partir de aquí, el foco es solo tres piezas.

## El core

1. **Goal** — el usuario define su objetivo. Ya no una lista cerrada de
   tipos: cualquier objetivo de salud, desde estético/fitness hasta manejo
   de una condición médica (con distancia — ver sección "Terreno médico").
2. **Recommendation Engine (IA)** — genera la recomendación a partir del
   objetivo + histórico real. Compara predicción vs. resultado real con el
   tiempo y ajusta — eso es lo que lo hace "más accurate".
3. **Base de datos** — objetivo, histórico de datos reales, y cada
   recomendación pasada (para poder comparar).

Todo lo demás se retoma más adelante, solo si hace falta, no por defecto.

## Interfaz: chat + stats personalizados

Una sola pantalla, no las 4 pestañas actuales:

- **Chat como entrada principal** — objetivo, registrar datos, pedir
  recomendaciones, todo por conversación libre.
- **Franja de stats personalizada** — no igual para todos. Cada tipo de
  objetivo tiene una lista corta de métricas relevantes asociada
  (determinista, sin IA); de esa lista solo se muestran las que ya tienen
  datos reales. Evita tarjetas vacías y evita que la IA decida el layout
  (caro e impredecible).

Esto sustituye a las pantallas/wizards actuales (Today, Nutrition,
Training, Progress) como camino principal. El trabajo de motor de detrás
no cambia — solo cambia cómo se presenta.

## Onboarding

Implementado como dos pasos (`app/onboarding.tsx`), ajustado durante la
construcción — los hechos fijos y estructurados (nombre, edad, sexo,
altura, peso) resultan más naturales como formulario nativo que como
conversación uno-a-uno; la conversación libre se reserva para lo que de
verdad no tiene una respuesta con formato fijo:

1. **Formulario nativo** — nombre, apellidos (opcional), edad, sexo,
   altura, peso. No pasa por la IA (`saveIdentity` en `lib/data/chat.ts`,
   escritura directa al User Model).
2. **Chat, solo para lo abierto** — primero el objetivo (texto libre,
   `set_goal`), y una última pregunta de opción cerrada ("¿en qué quieres
   que te ayude sobre todo?" — rutinas / comidas / seguimiento de peso /
   todo) mostrada como botones, no como texto a escribir
   (`preferences.helpAreas`, `saveHelpAreas`). No se deja pasar a la app
   hasta que las tres cosas (formulario + objetivo + esta pregunta) están
   confirmadas.

La primera recomendación se sigue marcando como estimación de partida.
Regla general que salió de esto y vale para cualquier pregunta futura del
chat: si la respuesta tiene un formato fijo/estructurado, mejor un campo
normal o botones que texto libre; el chat libre es para lo que de verdad
no tiene una lista cerrada de respuestas.

## Terreno médico — con distancia

El alcance incluye condiciones médicas, pero:

- La IA debe reconocerlas y ser más conservadora en lo que recomienda
  alrededor de ellas.
- Nunca sustituye a un profesional — siempre deja claro ese límite cuando
  el tema lo requiere.
- Esto se implementa como un paso de clasificación aislado y barato
  ("¿esto toca terreno médico? sí/no") antes de generar cualquier
  respuesta — no mezclado dentro de cada prompt, para poder ajustar la
  regla sin tocar el resto del sistema.

## Principios de arquitectura (para escalar sin rehacer)

- **Una sola puerta de escritura.** Chat y cualquier futura interfaz
  llaman siempre a las mismas funciones de datos que ya existen — nunca
  caminos paralelos.
- **IA solo donde hace falta, lo más barata posible.** Paso 1: clasificar
  barato qué quiere el usuario (registro / pregunta / objetivo nuevo).
  Paso 2 (solo si hace falta razonar de verdad): modelo más potente para
  interpretar/explicar. La mayoría de mensajes no necesitan el paso 2.
- **La mayoría de usos de la app no tocan IA.** Ver el plan de hoy es
  lectura de datos ya calculados. Solo se llama a IA cuando algo cambia
  (nuevo dato, nuevo objetivo, se pide una explicación). Mismo patrón que
  ya existe en `nutrition_insights` (caché + fallback).
- **Cada recomendación se guarda como fila nueva, nunca se sobrescribe.**
  Necesario para el bucle de predicción vs. resultado real, y barato de
  escribir — el análisis de acierto puede hacerse aparte, en segundo
  plano.
- **Sin estado largo en memoria.** Cada mensaje se procesa como una
  llamada independiente que lee lo que hace falta de la base de datos.
  Mismo patrón que las funciones serverless ya existentes — escala solo.
- **Los motores de dominio siguen sin conocerse entre sí.** Es lo que
  permite añadir un dominio nuevo (ej. salud mental, sueño como área
  propia) sin tocar los que ya existen. No romper esta regla aunque el
  chat lo haga todo más flexible por fuera.

## Qué se aprovecha de lo ya construido

- **Tal cual, sin tocar**: Goal Engine (ya es genérico — cualquier métrica
  contra un objetivo), Recommendation Engine / Strategy Planner (cálculo
  determinista de qué recomendar), `recommendation-explain` (redacción en
  lenguaje natural), toda la base de datos actual (histórico de peso,
  agua, sueño, entrenos, objetivos).
- **Con ajuste pequeño**: el almacén de User Model (jsonb por categorías)
  sigue siendo buen sitio para guardar lo que salga de la conversación —
  solo cambia cómo se rellena. El diseño de "Goal Chat" (texto libre →
  objetivo estructurado) se abre de lista cerrada a algo más abierto.
- **Sustituido por el enfoque conversacional**: el Question Engine de 42
  preguntas fijas — su almacén de datos se queda, el mecanismo de
  "preguntar una por una en tarjeta" no.
- **Genuinamente nuevo, no existe hoy**: la interfaz de chat en sí, el
  paso que interpreta cada mensaje y decide qué función de datos llamar
  (el "router"), el bucle de predicción vs. resultado real, y el filtro de
  terreno médico.

## Estado actual (2026-08-02)

Todo lo del "core" (Goal, Recommendation Engine, bucle predicción vs.
resultado real) y la interfaz de chat + stats están construidos y en uso
en la rama `simplificado`. Resumen de lo que ya funciona — detalle
completo, con fechas, en `docs/CHANGELOG_FOR_AI.md`:

- Pantalla única (`app/(tabs)/index.tsx`) con chat + stats personalizados
  por objetivo, sin pestañas visibles (Training/Nutrition/Progress siguen
  existiendo como rutas, con botón atrás, pero no como navegación
  principal).
- Onboarding en dos pasos — ver sección "Onboarding" arriba.
- Chat con memoria de la conversación (últimos ~8 turnos, se manda al
  modelo en cada llamada) — sin esto no se pueden resolver respuestas
  cortas tipo "sí" a una pregunta que hizo el propio chat. Se reinicia
  cada día (`lib/data/chat.ts`, `supabase/functions/chat-assistant`).
- Registro por chat: peso, comidas, objetivo, identidad.
- Lesiones (`training.injuries`): se detectan y guardan solas, y bloquean
  la generación automática de rutina por chat mientras estén confirmadas
  (por precaución — no se intenta excluir solo la zona afectada).
- Rutina por chat: pregunta días/enfoque/equipo/gustos **una vez**, antes
  de generar (nunca un simple sí/no), lo guarda como hecho fijo y no
  vuelve a preguntar. El generador (`buildFocusSplit` /
  `lib/engine/meso-templates.ts`) ya respeta equipo disponible
  (`lib/engine/exercise-db.ts` tiene cada ejercicio etiquetado con qué
  material necesita) y evita/prioriza ejercicios según gustos.
- Menú por chat: genera un día de comidas desde un catálogo genérico de
  categorías de alimento (`lib/engine/food-db.ts` +
  `lib/engine/diet-generator.ts`), nunca inventa platos. Pendiente de
  mejorar — ver siguiente sección.
- Adherencia: los objetivos de calorías se ajustan solos (dentro de
  límites, máx. 1 vez/semana) si el Goal Engine dice que vas atrasado,
  siempre explicado, nunca en silencio.

## Próxima entrega planificada — menú con fiabilidad (no empezada)

Idea acordada, todavía sin código: el generador de menú hoy reparte las
calorías del día en partes iguales entre comidas, lo que las hace todas
idénticas y muy repetitivo de leer. Se cambia por:

1. **Preguntar antes de generar, como ya hace la rutina** — si no
   sabemos cuántas comidas haces al día (`nutrition.mealsPerDay`, campo
   ya existente, sin usar), preguntarlo antes de generar nada.
2. **Un "peso" por comida (ligero/normal/potente)** — campo nuevo,
   **no** es un hecho fijo tipo lesión/objetivo: es una tendencia que
   puede variar. Se guarda con un contador de observaciones — cada
   mención nueva ajusta el valor combinándolo con lo que ya había, en
   vez de sobrescribirlo entero; con pocas observaciones un dato nuevo
   pesa mucho, con muchas apenas mueve la estimación. Mismo principio
   que "se vuelve más fiable con el tiempo" del Recommendation Engine,
   pero por comida en vez de por objetivo. Requiere un tipo de campo
   nuevo en `features/profile/engine/types.ts` (algo tipo
   `TendencyField<T>`, distinto del `Field<T>` binario
   unknown/confirmed que usa el resto del modelo — ver comentario en la
   cabecera de ese archivo, ya deja hueco para esto).
3. **Decisión de diseño ya tomada, importante para no repetir la
   conversación**: la fiabilidad/tendencia **solo** aplica a este campo
   (peso de la comida). Todo lo demás del perfil (lesiones, alergias,
   gustos, objetivo, identidad, equipo de entreno) sigue siendo
   confirmado/desconocido tal cual, porque son declaraciones directas del
   usuario, no patrones de comportamiento inferidos — mezclar los dos
   tipos haría el comportamiento impredecible. Tampoco es la IA quien
   decide caso por caso si algo es "hecho fijo" o "tendencia" — esa
   distinción es fija, por campo, decidida en el código.
4. El generador (`computeDietPlan`) deja de repartir a partes iguales y
   usa esos pesos para las cantidades de cada comida. La UI que muestra
   la propuesta (`app/(tabs)/index.tsx`, bloque `dietProposal`) puede
   simplificarse a la vez: si las comidas ya no son todas iguales no hay
   que colapsar el texto, pero si alguna vez coinciden vale la pena no
   repetir el bloque completo.

## Otras preguntas abiertas

- Diseñar el esquema de "predicción guardada" en la base de datos (qué
  campos, cómo se compara después contra lo real) — el bucle actual
  ajusta calorías pero no guarda explícitamente cada predicción como fila
  para comparar más adelante.
