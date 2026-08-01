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

export type ChatResult = {
  reply: string;
};

type ChatContext = { goalSummary: string; planFacts: string[] };

async function buildChatContext(userId: string): Promise<ChatContext> {
  const ctx = await buildStrategyContext(userId);
  if (!ctx) {
    return { goalSummary: 'El usuario todavía no ha fijado un objetivo.', planFacts: [] };
  }

  const ev = ctx.goal.evaluation;
  const goalSummary = ev
    ? `Objetivo: ${ctx.goal.type}. Estado: ${ev.status}. Valor actual: ${ev.currentValue ?? 'desconocido'}. ` +
      `Valor objetivo: ${ev.targetValue ?? 'desconocido'}. Confianza: ${ev.confidence}.`
    : `Objetivo: ${ctx.goal.type}. Todavía sin suficientes datos para evaluar progreso.`;

  const plan = computeStrategyPlan(ctx);
  const validated = validateStrategyPlan(plan, ctx).plan;
  const planFacts = [...validated.explanations.nutrition, ...validated.explanations.training];

  return { goalSummary, planFacts };
}

// Mismo criterio que ya usaba Nutrition para añadir una comida nueva: el
// siguiente hueco libre, nunca se pisa una comida existente.
async function nextMealSlot(): Promise<number> {
  const meals = await fetchMealsForDate();
  return meals.length ? Math.max(...meals.map((m) => m.meal_slot)) + 1 : 1;
}

type ChatAssistantResponse = {
  intent: 'log_weight' | 'log_meal' | 'log_workout' | 'answer';
  weightKg: number | null;
  mealText: string | null;
  reply: string;
};

export async function sendChatMessage(userId: string, message: string): Promise<ChatResult> {
  const context = await buildChatContext(userId).catch(() => ({ goalSummary: '', planFacts: [] as string[] }));

  const { data, error } = await supabase.functions.invoke('chat-assistant', {
    body: { message, context },
  });
  if (error) throw error;

  const { intent, weightKg, mealText, reply } = data as ChatAssistantResponse;

  if (intent === 'log_weight' && typeof weightKg === 'number') {
    await logWeight(userId, weightKg);
    return { reply };
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
  return { reply };
}
