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

Corto y conversacional, no un formulario. Mínimo para dar una primera
recomendación (objetivo + 3-4 datos básicos: edad, sexo, altura, peso).
La primera recomendación se marca explícitamente como estimación de
partida ("no tengo datos tuyos todavía, se irá ajustando"). El resto de
personalización se recoge poco a poco, hablando, no de golpe.

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

## Preguntas abiertas / siguiente paso

- Orden de construcción: ¿cerrar primero el bucle del motor (predicción
  vs. resultado real) sobre cualquier interfaz, y rehacer la pantalla
  después — o ir directos a la pantalla nueva ya que la actual no se
  aprovecha para este enfoque?
- Diseñar el "router" del chat: qué pasos exactos sigue al recibir un
  mensaje, qué modelo usa en cada paso.
- Diseñar el esquema de "predicción guardada" en la base de datos (qué
  campos, cómo se compara después contra lo real).
