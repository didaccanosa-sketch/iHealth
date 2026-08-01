// Chat v1 de la pantalla única (ver docs/SIMPLIFIED_VISION.md). Construye
// el contexto real del usuario (objetivo + plan actual, mismos motores que
// ya existen, sin duplicarlos), llama a la función de IA que clasifica el
// mensaje y redacta la respuesta, y ejecuta el registro correspondiente con
// las mismas funciones de datos que ya usaba el resto de la app. La IA
// nunca escribe directo en la base de datos — solo interpreta/redacta,
// igual que el resto del motor.
import { supabase } from '../supabase';
import { logWeight } from './weight-logs';
import { analyzeMealText, insertMeal, fetchMealsForDate } from './nutrition';
import { buildStrategyContext } from './recommendation';
import { computeStrategyPlan, validateStrategyPlan } from '../engine/recommendation-engine';
import { buildFocusSplit, ExercisePreferences } from '../engine/meso-templates';
import { EquipmentLevel } from '../engine/exercise-db';
import { createMesocycle, startMesocycle, NewMesoInput } from './workout';
import { loadUserModel, saveUserModel, syncIdentityToLegacyProfile } from '../../features/profile/data/user-model-data';
import { setField } from '../../features/profile/engine/user-model';
import { GoalType, Sex, HelpArea } from '../../features/profile/engine/types';
import { MuscleGroup } from '../engine/types';
import { computeDietPlan, DietPlan } from '../engine/diet-generator';

// Qué campos de preferencias de entreno todavía no sabemos — se calcula
// aquí (código, no IA) y se manda como hecho más en el contexto, para que
// la IA sepa exactamente qué le falta por preguntar, sin decidirlo ella.
// Orden fijo de prioridad — el chat pregunta estos de uno en uno, nunca
// combinados (regla general, ver docs/SIMPLIFIED_VISION.md). daysPerWeek va
// primero porque es imprescindible para generar cualquier rutina.
const TRAINING_PREF_KEYS = ['daysPerWeek', 'equipment', 'preferredExercises', 'dislikedExercises'] as const;

// Los únicos grupos que buildFocusSplit sabe priorizar de verdad (ver
// BIG_GROUPS en lib/engine/meso-templates.ts) — cualquier otro valor que la
// IA mande se filtra aquí, nunca se pasa uno inválido al generador.
const PRIORITIZABLE_GROUPS: MuscleGroup[] = ['pecho', 'espalda', 'hombro', 'biceps', 'triceps', 'cuadriceps', 'isquios', 'gluteo'];

export type WorkoutProposal = {
  input: NewMesoInput;
  summary: string;
};

export type DietProposal = {
  plan: DietPlan;
  summary: string;
};

export type ChatResult = {
  reply: string;
  proposal?: WorkoutProposal | null;
  dietProposal?: DietProposal | null;
  // Si el chat necesita un dato concreto para seguir (nunca dos a la vez —
  // regla general, ver docs/SIMPLIFIED_VISION.md). Si es un campo de
  // lib/data/chat-options.ts, la UI muestra botones en vez de dejar escribir.
  askField?: string | null;
};

const DEFAULT_MESO_DURATION_WEEKS = 6; // mismo valor por defecto que ya usaba el wizard manual

// Genera la propuesta de rutina de forma determinista (mismo generador que
// "Recommend for me" en Training, buildFocusSplit) — la IA solo detectó que
// el usuario quería una rutina (o un cambio sobre la que acaba de pedir) y,
// si los dio, cuántos días y qué priorizar. Nunca inventa ejercicios ni
// días. Devuelve null si todavía no hay objetivo fijado (sin eso no hay
// level/phase/días de los que partir).
async function buildWorkoutProposal(
  userId: string,
  requestedDaysPerWeek: number | null,
  requestedFocus: string[] | null
): Promise<WorkoutProposal | null> {
  const ctx = await buildStrategyContext(userId);
  if (!ctx) return null;

  const plan = computeStrategyPlan(ctx);
  const validated = validateStrategyPlan(plan, ctx).plan;

  const model = await loadUserModel(userId).catch(() => null);
  const prefs: ExercisePreferences = {
    equipmentLevel: (model?.training.equipment.value?.[0] as EquipmentLevel | undefined) ?? null,
    preferredExercises: model?.training.preferredExercises.value ?? [],
    dislikedExercises: model?.training.dislikedExercises.value ?? [],
  };

  const daysPerWeek = requestedDaysPerWeek ?? validated.training.daysPerWeek;
  const priority = (requestedFocus ?? []).filter((g): g is MuscleGroup => PRIORITIZABLE_GROUPS.includes(g as MuscleGroup));
  const days = buildFocusSplit(daysPerWeek, priority, prefs);

  const input: NewMesoInput = {
    level: validated.training.level,
    phase: validated.training.phase ?? 'mantenimiento',
    duration_weeks: DEFAULT_MESO_DURATION_WEEKS,
    days_per_week: daysPerWeek,
    days,
    generatedFrom: priority.length ? 'focus' : 'recommendation',
    focusPriority: priority.length ? priority : undefined,
  };

  const dayLabels = days.map((d) => d.label).join(', ');
  const focusNote = priority.length ? ` Prioridad: ${priority.join(', ')}.` : '';
  const summary = `${daysPerWeek} días/semana, ${DEFAULT_MESO_DURATION_WEEKS} semanas (${input.phase}): ${dayLabels}.${focusNote}`;

  return { input, summary };
}

// El usuario confirma la propuesta desde la UI (botón, no otra vuelta por
// IA) — se crea el mesociclo y se arranca directamente, porque la
// confirmación en el chat ya es la revisión (mismo principio que el wizard
// manual: nunca se guarda nada sin que el usuario lo vea antes).
export async function confirmWorkoutProposal(userId: string, input: NewMesoInput): Promise<void> {
  const mesoId = await createMesocycle(userId, input);
  await startMesocycle(mesoId, userId);
}

// Genera el menú de forma determinista (computeDietPlan, catálogo de
// categorías genéricas — ver lib/engine/food-db.ts) a partir de las mismas
// calorías/macros que ya calculó el Strategy Planner. La IA solo detectó
// que el usuario quería un menú (o un cambio) y, si lo dio, cuántas
// comidas — nunca elige qué comida proponer, eso sale del catálogo fijo.
async function buildDietProposal(userId: string, requestedMealsPerDay: number | null): Promise<DietProposal | null> {
  const ctx = await buildStrategyContext(userId);
  if (!ctx) return null;

  const plan = computeStrategyPlan(ctx);
  const validated = validateStrategyPlan(plan, ctx).plan;
  const model = await loadUserModel(userId).catch(() => null);
  const dietaryPattern = model?.nutrition.dietaryPattern.value ?? null;

  const mealsPerDay = requestedMealsPerDay ?? validated.nutrition.mealsPerDay;
  const dietPlan = computeDietPlan(
    {
      kcal: validated.nutrition.kcal,
      protein_g: validated.nutrition.protein_g,
      carbs_g: validated.nutrition.carbs_g,
      fat_g: validated.nutrition.fat_g,
      fiber_g: validated.nutrition.fiber_g,
      mealsPerDay,
    },
    dietaryPattern
  );

  const summary =
    `${mealsPerDay} comidas · objetivo ${validated.nutrition.kcal} kcal / ${validated.nutrition.protein_g}g proteína, ` +
    `propuesta ${dietPlan.totals.kcal} kcal / ${dietPlan.totals.protein_g}g proteína (aproximado).`;

  return { plan: dietPlan, summary };
}

// Igual que confirmWorkoutProposal, pero para dieta: se guarda como
// plantilla de día (mismo mecanismo que ya usa Nutrition al pulsar "Save as
// template") — no se registra como ya comido. El usuario la aplica desde
// Nutrition, comida a comida o de golpe, cuando quiera (ver conversación de
// diseño: nunca se marca nada como comido sin que el usuario lo haga).
export async function confirmDietProposal(userId: string, plan: DietPlan, name: string): Promise<void> {
  const { data: tmpl, error } = await supabase.from('day_templates').insert({ user_id: userId, name }).select('id').single();
  if (error) throw error;

  const rows = plan.meals.map((m) => ({
    day_template_id: tmpl.id,
    user_id: userId,
    meal_slot: m.slot,
    description: m.description,
    kcal: m.kcal,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    fiber_g: m.fiber_g,
  }));
  const { error: errMeals } = await supabase.from('day_template_meals').insert(rows);
  if (errMeals) throw errMeals;
}

type ChatContext = {
  goalSummary: string;
  planFacts: string[];
  todayDate: string;
  missingTrainingPrefs: string[];
  missingMealsPerDay: boolean;
};

async function buildChatContext(userId: string): Promise<ChatContext> {
  const todayDate = new Date().toISOString().slice(0, 10);

  // Qué preferencias de entreno todavía no sabemos — calculado aquí (código,
  // no IA), para que el chat solo pregunte por lo que de verdad falta, y
  // siempre una cosa a la vez (mismo principio para mealsPerDay).
  const model = await loadUserModel(userId).catch(() => null);
  const missingTrainingPrefs = model
    ? TRAINING_PREF_KEYS.filter((key) => model.training[key].status !== 'confirmed')
    : [...TRAINING_PREF_KEYS];
  const missingMealsPerDay = model ? model.nutrition.mealsPerDay.status !== 'confirmed' : true;

  const ctx = await buildStrategyContext(userId);
  if (!ctx) {
    return {
      goalSummary: 'El usuario todavía no ha fijado un objetivo.',
      planFacts: [],
      todayDate,
      missingTrainingPrefs,
      missingMealsPerDay,
    };
  }

  const ev = ctx.goal.evaluation;
  const goalSummary = ev
    ? `Objetivo: ${ctx.goal.type}. Estado: ${ev.status}. Valor actual: ${ev.currentValue ?? 'desconocido'}. ` +
      `Valor objetivo: ${ev.targetValue ?? 'desconocido'}. Confianza: ${ev.confidence}.`
    : `Objetivo: ${ctx.goal.type}. Todavía sin suficientes datos para evaluar progreso.`;

  const plan = computeStrategyPlan(ctx);
  const validated = validateStrategyPlan(plan, ctx).plan;
  const planFacts = [...validated.explanations.nutrition, ...validated.explanations.training];

  return { goalSummary, planFacts, todayDate, missingTrainingPrefs, missingMealsPerDay };
}

// El usuario cuenta su objetivo en texto libre (onboarding o más adelante) —
// la IA solo lo clasificó dentro de los tipos que ya existen (GoalType), el
// guardado en sí es directo sobre el User Model, mismo mecanismo que usa el
// resto de la app (setField). Nunca se inventa un campo que el usuario no
// dio: solo se escriben los que vienen no-nulos.
async function setGoalFromChat(
  userId: string,
  goal: { type: GoalType; targetWeightKg: number | null; targetDate: string | null; targetExercise: string | null; targetExerciseKg: number | null }
): Promise<void> {
  const model = await loadUserModel(userId);
  let next = setField(model, 'goals', 'type', goal.type);
  if (goal.targetWeightKg != null) next = setField(next, 'goals', 'targetWeightKg', goal.targetWeightKg);
  if (goal.targetDate) next = setField(next, 'goals', 'targetDate', goal.targetDate);
  if (goal.targetExercise) next = setField(next, 'goals', 'targetExercise', goal.targetExercise);
  if (goal.targetExerciseKg != null) next = setField(next, 'goals', 'targetExerciseKg', goal.targetExerciseKg);
  await saveUserModel(userId, next);
}

// Igual que setGoalFromChat pero para los datos básicos de identidad
// (edad/sexo/altura/peso) — necesarios para que el Strategy Planner calcule
// con tu BMR real en vez del genérico. El peso, además de guardarse como
// punto de partida, se registra también en el histórico (mismo criterio que
// log_weight) para que el Goal Engine tenga un primer dato real. También se
// copia a `profiles` (mismo patrón que ya usa la pantalla de Perfil, ver
// syncIdentityToLegacyProfile) para que los sitios que todavía leen de ahí
// directamente (TemplatePicker, el saludo de Today) vean el dato también,
// no solo el User Model.
// Exportada — también la usa directamente el formulario nativo del
// onboarding (ver app/onboarding.tsx), sin pasar por la IA: son datos
// estructurados que el usuario ya rellena en campos concretos, no texto
// libre que haga falta interpretar.
export async function saveIdentity(
  userId: string,
  identity: {
    firstName: string | null;
    lastName: string | null;
    ageYears: number | null;
    sex: Sex | null;
    heightCm: number | null;
    weightKg: number | null;
  }
): Promise<void> {
  const model = await loadUserModel(userId);
  let next = model;
  if (identity.firstName) next = setField(next, 'identity', 'firstName', identity.firstName);
  if (identity.lastName) next = setField(next, 'identity', 'lastName', identity.lastName);
  if (identity.ageYears != null) next = setField(next, 'identity', 'age', identity.ageYears);
  if (identity.sex) next = setField(next, 'identity', 'sex', identity.sex);
  if (identity.heightCm != null) next = setField(next, 'identity', 'heightCm', identity.heightCm);
  if (identity.weightKg != null) next = setField(next, 'identity', 'startingWeightKg', identity.weightKg);
  await saveUserModel(userId, next);
  if (identity.weightKg != null) await logWeight(userId, identity.weightKg);
  const fullName = [identity.firstName, identity.lastName].filter(Boolean).join(' ').trim();
  await syncIdentityToLegacyProfile(userId, {
    fullName: fullName || null,
    heightCm: identity.heightCm,
    startingWeightKg: identity.weightKg,
  });
}

// Preferencias de entreno declaradas por el usuario — hechos fijos, no de
// tendencia (ver conversación de diseño: esto se guarda tal cual, no se
// promedia). El equipo se sobrescribe (es una elección, no una lista que
// crece); los gustos/no-gustos se acumulan sin duplicar.
async function setTrainingPrefsFromChat(
  userId: string,
  training: { equipment: EquipmentLevel | null; preferredExercises: string[] | null; dislikedExercises: string[] | null }
): Promise<void> {
  const model = await loadUserModel(userId);
  let next = model;
  if (training.equipment) next = setField(next, 'training', 'equipment', [training.equipment]);
  if (training.preferredExercises && training.preferredExercises.length > 0) {
    const merged = Array.from(new Set([...(model.training.preferredExercises.value ?? []), ...training.preferredExercises]));
    next = setField(next, 'training', 'preferredExercises', merged);
  }
  if (training.dislikedExercises && training.dislikedExercises.length > 0) {
    const merged = Array.from(new Set([...(model.training.dislikedExercises.value ?? []), ...training.dislikedExercises]));
    next = setField(next, 'training', 'dislikedExercises', merged);
  }
  await saveUserModel(userId, next);
}

// En qué quiere que le ayude el chat sobre todo — pregunta de opción
// cerrada al final del onboarding (ver app/onboarding.tsx), se guarda
// directo, sin pasar por la IA (mismo criterio que saveIdentity: es una
// elección de una lista fija, no texto libre que interpretar).
export async function saveHelpAreas(userId: string, areas: HelpArea[]): Promise<void> {
  const model = await loadUserModel(userId);
  const next = setField(model, 'preferences', 'helpAreas', areas);
  await saveUserModel(userId, next);
}

// Mismo criterio que ya usaba Nutrition para añadir una comida nueva: el
// siguiente hueco libre, nunca se pisa una comida existente.
async function nextMealSlot(): Promise<number> {
  const meals = await fetchMealsForDate();
  return meals.length ? Math.max(...meals.map((m) => m.meal_slot)) + 1 : 1;
}

type ChatAssistantResponse = {
  intent: 'log_weight' | 'log_meal' | 'log_workout' | 'propose_workout' | 'propose_diet' | 'set_goal' | 'set_identity' | 'answer';
  weightKg: number | null;
  mealText: string | null;
  daysPerWeek: number | null;
  focusMuscleGroups: string[] | null;
  mealsPerDay: number | null;
  goal: { type: GoalType; targetWeightKg: number | null; targetDate: string | null; targetExercise: string | null; targetExerciseKg: number | null } | null;
  identity: {
    firstName: string | null;
    lastName: string | null;
    ageYears: number | null;
    sex: Sex | null;
    heightCm: number | null;
    weightKg: number | null;
  } | null;
  injuries: string[] | null;
  training: { equipment: EquipmentLevel | null; preferredExercises: string[] | null; dislikedExercises: string[] | null } | null;
  askField: string | null;
  reply: string;
};

export type ChatHistoryTurn = { role: 'user' | 'assistant'; text: string };

const CHAT_HISTORY_TURNS = 8; // suficiente para resolver un "sí"/"no" a lo que se acaba de preguntar, sin mandar la conversación entera

// Añade una lesión/limitación nueva a las ya guardadas (sin duplicar) — no
// pisa las que ya había, el registro de lesiones solo crece hasta que el
// usuario las edite a mano en Perfil.
async function setInjuriesFromChat(userId: string, injuries: string[]): Promise<void> {
  const model = await loadUserModel(userId);
  const existing = model.training.injuries.value ?? [];
  const merged = Array.from(new Set([...existing, ...injuries]));
  const next = setField(model, 'training', 'injuries', merged);
  await saveUserModel(userId, next);
}

// Si hay alguna lesión confirmada, devuelve la lista — se usa para bloquear
// la generación automática de rutina (ver sendChatMessage, intent
// "propose_workout"). Nunca se intenta excluir solo la zona afectada: por
// precaución, mientras haya una lesión en el perfil no se genera nada solo.
async function getConfirmedInjuries(userId: string): Promise<string[] | null> {
  const model = await loadUserModel(userId).catch(() => null);
  const field = model?.training.injuries;
  if (field?.status === 'confirmed' && field.value && field.value.length > 0) return field.value;
  return null;
}

export async function sendChatMessage(userId: string, message: string, history: ChatHistoryTurn[] = []): Promise<ChatResult> {
  const context = await buildChatContext(userId).catch(() => ({
    goalSummary: '',
    planFacts: [] as string[],
    todayDate: new Date().toISOString().slice(0, 10),
    missingTrainingPrefs: [...TRAINING_PREF_KEYS] as string[],
    missingMealsPerDay: true,
  }));
  const trimmedHistory = history.slice(-CHAT_HISTORY_TURNS).map((h) => ({ role: h.role, text: h.text }));

  const { data, error } = await supabase.functions.invoke('chat-assistant', {
    body: { message, context, history: trimmedHistory },
  });
  if (error) throw error;

  const { intent, weightKg, mealText, daysPerWeek, focusMuscleGroups, mealsPerDay, goal, identity, injuries, training, askField, reply } =
    data as ChatAssistantResponse;

  if (injuries && injuries.length > 0) {
    await setInjuriesFromChat(userId, injuries).catch(() => {});
  }
  if (training && (training.equipment || training.preferredExercises?.length || training.dislikedExercises?.length)) {
    await setTrainingPrefsFromChat(userId, training).catch(() => {});
  }

  if (intent === 'log_weight' && typeof weightKg === 'number') {
    await logWeight(userId, weightKg);
    return { reply };
  }

  if (intent === 'set_goal' && goal) {
    try {
      await setGoalFromChat(userId, goal);
      return { reply };
    } catch {
      return { reply: 'No he podido guardar tu objetivo — inténtalo de nuevo en un momento.' };
    }
  }

  if (intent === 'set_identity' && identity) {
    try {
      await saveIdentity(userId, identity);
      return { reply };
    } catch {
      return { reply: 'No he podido guardar esos datos — inténtalo de nuevo en un momento.' };
    }
  }

  if (intent === 'propose_workout') {
    try {
      const injuries = await getConfirmedInjuries(userId);
      if (injuries) {
        return {
          reply: `Tienes una lesión registrada (${injuries.join(', ')}) — por precaución no te genero una rutina automática. Sigue las indicaciones de tu médico/fisio y, mientras tanto, monta tu entreno a mano desde la pantalla de Training.`,
        };
      }
      const proposal = await buildWorkoutProposal(userId, daysPerWeek ?? null, focusMuscleGroups ?? null);
      if (!proposal) {
        return { reply: 'Todavía no tienes un objetivo fijado — necesito eso primero para proponerte una rutina.' };
      }
      return { reply, proposal };
    } catch {
      return { reply: 'No he podido preparar una propuesta ahora mismo — inténtalo de nuevo en un momento.' };
    }
  }

  if (intent === 'propose_diet') {
    try {
      const dietProposal = await buildDietProposal(userId, mealsPerDay ?? null);
      if (!dietProposal) {
        return { reply: 'Todavía no tienes un objetivo fijado — necesito eso primero para proponerte un menú.' };
      }
      return { reply, dietProposal };
    } catch {
      return { reply: 'No he podido preparar un menú ahora mismo — inténtalo de nuevo en un momento.' };
    }
  }

  if (intent === 'log_meal' && mealText) {
    try {
      const analyzed = await analyzeMealText(mealText);
      const slot = await nextMealSlot();
      await insertMeal(userId, {
        description: analyzed.desc,
        kcal: analyzed.kcal,
        protein_g: analyzed.p,
        carbs_g: analyzed.c,
        fat_g: analyzed.f,
        fiber_g: analyzed.fiber,
        source: 'chat',
        meal_slot: slot,
      });
      return { reply };
    } catch {
      return { reply: 'No he podido guardar esa comida — inténtalo de nuevo en un momento.' };
    }
  }

  // 'log_workout' y 'answer' no necesitan escritura adicional — el reply ya
  // lo cubre (aviso de "no disponible todavía" o la respuesta en sí).
  // askField solo importa aquí: es cuando el chat está preguntando algo
  // concreto antes de poder generar rutina/menú (ver chat-options.ts).
  return { reply, askField: askField ?? null };
}
