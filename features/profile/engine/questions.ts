// Question Engine — librería declarativa de preguntas, sin IA (ver
// docs/USER_MODEL.md). Empieza con las preguntas que ya cubren las
// categorías con contenido en v1 (Goals, Training, Nutrition, Lifestyle).
// Identity se edita a mano en la pantalla de Perfil, no aparece aquí.
// Adherence se infiere del comportamiento, tampoco se pregunta.
import { isUnknown, setField } from './user-model';
import { UserModelData } from './types';

export type AnswerOption = { label: string; value: unknown };

export type Question = {
  id: string;
  category: 'goals' | 'training' | 'nutrition' | 'lifestyle';
  field: string;
  text: string;
  // 'single_choice' — opciones fijas, sin ambigüedad, sin texto libre.
  // 'number' — un número escrito a mano (ej. peso objetivo).
  // 'text'   — texto libre para lo que no tiene sentido enumerar (lesiones,
  //            alergias...). Se guarda tal cual, sin IA — si `isList` es
  //            true se separa por comas en varios elementos.
  answerType: 'single_choice' | 'number' | 'text';
  options?: AnswerOption[]; // en 'text' funcionan como atajos rápidos (ej. "No, ninguna")
  isList?: boolean; // el campo destino es un array (string[])
  priority: number; // más alto = se pregunta antes
  // Preguntas que no tiene sentido hacer todavía (ej. equipo si no se sabe
  // que entrena). Si no hay condición, siempre está activa.
  condition?: (model: UserModelData) => boolean;
};

export const QUESTIONS: Question[] = [
  // ─── Goals ──────────────────────────────────────────────────────────────
  {
    id: 'goals.type',
    category: 'goals',
    field: 'type',
    text: '¿Cuál es tu objetivo principal ahora mismo?',
    answerType: 'single_choice',
    options: [
      { label: 'Perder grasa', value: 'lose_fat' },
      { label: 'Ganar músculo', value: 'gain_muscle' },
      { label: 'Mantenerme', value: 'maintain' },
      { label: 'Rendimiento', value: 'performance' },
    ],
    priority: 100,
  },
  {
    id: 'goals.targetWeightKg',
    category: 'goals',
    field: 'targetWeightKg',
    text: '¿Tienes un peso objetivo en mente?',
    answerType: 'number',
    priority: 70,
    condition: (m) => m.goals.type.value === 'lose_fat' || m.goals.type.value === 'gain_muscle',
  },

  // ─── Training ───────────────────────────────────────────────────────────
  {
    id: 'training.experience',
    category: 'training',
    field: 'experience',
    text: '¿Cuánta experiencia entrenando tienes?',
    answerType: 'single_choice',
    options: [
      { label: 'Soy principiante', value: 'beginner' },
      { label: 'Ya tengo experiencia', value: 'advanced' },
    ],
    priority: 95,
  },
  {
    id: 'training.daysPerWeek',
    category: 'training',
    field: 'daysPerWeek',
    text: '¿Cuántos días a la semana puedes entrenar?',
    answerType: 'single_choice',
    options: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: String(n), value: n })),
    priority: 90,
  },
  {
    id: 'training.equipment',
    category: 'training',
    field: 'equipment',
    text: '¿Dónde entrenas normalmente?',
    answerType: 'single_choice',
    options: [
      { label: 'Gimnasio completo', value: ['gym'] },
      { label: 'En casa, con poco material', value: ['home_minimal'] },
      { label: 'Solo peso corporal', value: ['bodyweight'] },
      { label: 'Depende del día (mix)', value: ['gym', 'home_minimal'] },
    ],
    priority: 60,
  },
  {
    id: 'training.injuries',
    category: 'training',
    field: 'injuries',
    text: '¿Tienes alguna lesión o molestia a tener en cuenta?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'No, ninguna', value: [] }],
    priority: 55,
  },

  // ─── Nutrition ──────────────────────────────────────────────────────────
  {
    id: 'nutrition.mealsPerDay',
    category: 'nutrition',
    field: 'mealsPerDay',
    text: '¿Cuántas comidas sueles hacer al día?',
    answerType: 'single_choice',
    options: [1, 2, 3, 4, 5].map((n) => ({ label: n === 5 ? '5+' : String(n), value: n })),
    priority: 85,
  },
  {
    id: 'nutrition.dietaryPattern',
    category: 'nutrition',
    field: 'dietaryPattern',
    text: '¿Sigues algún patrón de alimentación concreto?',
    answerType: 'single_choice',
    options: [
      { label: 'Como de todo', value: 'omnivore' },
      { label: 'Vegetariano', value: 'vegetarian' },
      { label: 'Vegano', value: 'vegan' },
      { label: 'Pescetariano', value: 'pescatarian' },
    ],
    priority: 65,
  },
  {
    id: 'nutrition.allergies',
    category: 'nutrition',
    field: 'allergies',
    text: '¿Tienes alguna alergia o intolerancia alimentaria?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'No', value: [] }],
    priority: 60,
  },

  // ─── Lifestyle ──────────────────────────────────────────────────────────
  {
    id: 'lifestyle.dailyActivity',
    category: 'lifestyle',
    field: 'dailyActivity',
    text: 'Fuera de entrenar, ¿cómo describirías tu actividad diaria?',
    answerType: 'single_choice',
    options: [
      { label: 'Bastante sedentaria', value: 'low' },
      { label: 'Normal, me muevo algo', value: 'medium' },
      { label: 'Muy activa', value: 'high' },
    ],
    priority: 50,
  },
  {
    id: 'lifestyle.preferredTrainingTime',
    category: 'lifestyle',
    field: 'preferredTrainingTime',
    text: '¿Cuándo prefieres entrenar?',
    answerType: 'single_choice',
    options: [
      { label: 'Mañana', value: 'morning' },
      { label: 'Mediodía/tarde', value: 'afternoon' },
      { label: 'Noche', value: 'evening' },
    ],
    priority: 40,
  },
  {
    id: 'lifestyle.sessionLengthMin',
    category: 'lifestyle',
    field: 'sessionLengthMin',
    text: '¿Cuánto tiempo tienes normalmente por sesión?',
    answerType: 'single_choice',
    options: [30, 45, 60, 90].map((n) => ({ label: `${n} min`, value: n })),
    priority: 45,
  },
  {
    id: 'lifestyle.sleepHours',
    category: 'lifestyle',
    field: 'sleepHours',
    text: '¿Cuántas horas sueles dormir de media?',
    answerType: 'single_choice',
    options: [5, 6, 7, 8, 9].map((n) => ({ label: `${n}h`, value: n })),
    priority: 35,
  },
];

// Progressive profiling: solo campos 'unknown', respeta condiciones,
// prioriza por `priority` y no abruma — el caller decide cuántas pedir
// a la vez (la tarjeta de Today pide 1).
export function getNextQuestions(model: UserModelData, count = 1): Question[] {
  return QUESTIONS.filter((q) => isUnknown(model, q.category, q.field as never))
    .filter((q) => !q.condition || q.condition(model))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count);
}

export function applyAnswer(model: UserModelData, questionId: string, value: unknown): UserModelData {
  const question = QUESTIONS.find((q) => q.id === questionId);
  if (!question) return model;
  return setField(model, question.category, question.field as never, value as never);
}
