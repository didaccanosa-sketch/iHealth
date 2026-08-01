// Question Engine — librería declarativa de preguntas, sin IA (ver
// docs/USER_MODEL.md). Cubre las categorías con contenido (Goals, Training,
// Nutrition, Lifestyle, Motivation, Preferences, Body). Identity se edita a
// mano en la pantalla de Perfil, no aparece aquí. Adherence se infiere del
// comportamiento, tampoco se pregunta. Health se queda fuera (dato sensible,
// decisión aparte).
import { isUnknown, setField } from './user-model';
import { UserModelData } from './types';

export type AnswerOption = { label: string; value: unknown };

export type Question = {
  id: string;
  category: 'goals' | 'training' | 'nutrition' | 'lifestyle' | 'motivation' | 'preferences' | 'body';
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
      { label: 'Ganar fuerza', value: 'strength' },
      { label: 'Mejorar resistencia', value: 'stamina' },
      { label: 'Ganar movilidad', value: 'mobility' },
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
  {
    id: 'goals.targetExercise',
    category: 'goals',
    field: 'targetExercise',
    text: '¿En qué ejercicio quieres ganar fuerza?',
    answerType: 'text',
    priority: 70,
    condition: (m) => m.goals.type.value === 'strength',
  },
  {
    id: 'goals.targetExerciseKg',
    category: 'goals',
    field: 'targetExerciseKg',
    text: '¿Qué marca (1RM estimado, en kg) te gustaría alcanzar?',
    answerType: 'number',
    priority: 65,
    condition: (m) => m.goals.type.value === 'strength' && !isUnknown(m, 'goals', 'targetExercise'),
  },
  {
    id: 'goals.targetDate',
    category: 'goals',
    field: 'targetDate',
    text: '¿Tienes una fecha en mente para lograrlo?',
    answerType: 'text',
    priority: 30,
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
    id: 'training.trainingMonths',
    category: 'training',
    field: 'trainingMonths',
    text: '¿Cuántos meses llevas entrenando de forma constante?',
    answerType: 'number',
    priority: 94,
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
  {
    id: 'training.preferredExercises',
    category: 'training',
    field: 'preferredExercises',
    text: '¿Hay ejercicios que te gusten especialmente?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'No tengo preferencia', value: [] }],
    priority: 58,
  },
  {
    id: 'training.dislikedExercises',
    category: 'training',
    field: 'dislikedExercises',
    text: '¿Hay ejercicios que prefieras evitar?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'Ninguno en particular', value: [] }],
    priority: 57,
  },
  {
    id: 'training.preferredSplit',
    category: 'training',
    field: 'preferredSplit',
    text: '¿Prefieres rutinas full body o divididas por grupo muscular?',
    answerType: 'single_choice',
    options: [
      { label: 'Full body', value: 'full_body' },
      { label: 'Divididas por grupo', value: 'split' },
      { label: 'Sin preferencia', value: 'no_preference' },
    ],
    priority: 56,
  },
  {
    id: 'training.warmupHabit',
    category: 'training',
    field: 'warmupHabit',
    text: '¿Sueles calentar antes de entrenar?',
    answerType: 'single_choice',
    options: [
      { label: 'Siempre', value: 'always' },
      { label: 'A veces', value: 'sometimes' },
      { label: 'Casi nunca', value: 'rarely' },
    ],
    priority: 54,
  },
  {
    id: 'training.favoriteMuscleGroup',
    category: 'training',
    field: 'favoriteMuscleGroup',
    text: '¿Qué grupo muscular te gusta más entrenar?',
    answerType: 'text',
    isList: true,
    priority: 50,
  },
  {
    id: 'training.dislikedMuscleGroup',
    category: 'training',
    field: 'dislikedMuscleGroup',
    text: '¿Hay algún grupo muscular que te guste menos entrenar?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'Ninguno en particular', value: [] }],
    priority: 49,
  },
  {
    id: 'training.cardioPreference',
    category: 'training',
    field: 'cardioPreference',
    text: '¿Qué tipo de cardio prefieres?',
    answerType: 'single_choice',
    options: [
      { label: 'Correr', value: 'running' },
      { label: 'Bici', value: 'cycling' },
      { label: 'Nadar', value: 'swimming' },
      { label: 'Andar', value: 'walking' },
      { label: 'Elíptica', value: 'elliptical' },
      { label: 'Sin preferencia', value: 'no_preference' },
    ],
    priority: 48,
  },
  {
    id: 'training.socialPreference',
    category: 'training',
    field: 'socialPreference',
    text: '¿Entrenas mejor solo o te ayuda tener compañía?',
    answerType: 'single_choice',
    options: [
      { label: 'Solo', value: 'solo' },
      { label: 'Acompañado', value: 'group' },
      { label: 'Me da igual', value: 'indifferent' },
    ],
    priority: 47,
  },
  {
    id: 'training.pastRoutineDislikes',
    category: 'training',
    field: 'pastRoutineDislikes',
    text: '¿Hubo algo de una rutina anterior que no te funcionara o no te gustara?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'No, nada en especial', value: [] }],
    priority: 45,
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
  {
    id: 'nutrition.dislikedFoods',
    category: 'nutrition',
    field: 'dislikedFoods',
    text: '¿Hay alimentos que no te gusten?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'Como de todo', value: [] }],
    priority: 58,
  },
  {
    id: 'nutrition.cookingSkill',
    category: 'nutrition',
    field: 'cookingSkill',
    text: '¿Cómo dirías que es tu nivel en la cocina?',
    answerType: 'single_choice',
    options: [
      { label: 'Básico', value: 'basic' },
      { label: 'Medio', value: 'medium' },
      { label: 'Avanzado', value: 'advanced' },
    ],
    priority: 55,
  },
  {
    id: 'nutrition.cookingTimeAvailable',
    category: 'nutrition',
    field: 'cookingTimeAvailable',
    text: '¿Cuánto tiempo tienes normalmente para cocinar?',
    answerType: 'single_choice',
    options: [
      { label: 'Poco', value: 'low' },
      { label: 'Normal', value: 'medium' },
      { label: 'Mucho', value: 'high' },
    ],
    priority: 54,
  },
  {
    id: 'nutrition.eatingOutFrequency',
    category: 'nutrition',
    field: 'eatingOutFrequency',
    text: '¿Cuántas veces a la semana comes fuera de casa?',
    answerType: 'number',
    priority: 53,
  },
  {
    id: 'nutrition.snackingHabit',
    category: 'nutrition',
    field: 'snackingHabit',
    text: '¿Sueles picar entre horas?',
    answerType: 'single_choice',
    options: [
      { label: 'Sí', value: 'yes' },
      { label: 'No', value: 'no' },
      { label: 'A veces', value: 'sometimes' },
    ],
    priority: 52,
  },
  {
    id: 'nutrition.preferredCuisine',
    category: 'nutrition',
    field: 'preferredCuisine',
    text: '¿Qué tipo de cocina te gusta más?',
    answerType: 'text',
    isList: true,
    priority: 51,
  },
  {
    id: 'nutrition.mealPrepHabit',
    category: 'nutrition',
    field: 'mealPrepHabit',
    text: '¿Sueles preparar comida con antelación (meal prep)?',
    answerType: 'single_choice',
    options: [
      { label: 'Sí', value: 'yes' },
      { label: 'No', value: 'no' },
      { label: 'A veces', value: 'sometimes' },
    ],
    priority: 50,
  },
  {
    id: 'nutrition.cravings',
    category: 'nutrition',
    field: 'cravings',
    text: '¿Qué comidas te cuesta más controlar?',
    answerType: 'text',
    isList: true,
    options: [{ label: 'Ninguna en particular', value: [] }],
    priority: 49,
  },

  // ─── Lifestyle ──────────────────────────────────────────────────────────
  {
    id: 'lifestyle.workType',
    category: 'lifestyle',
    field: 'workType',
    text: 'Tu trabajo o día a día, ¿es más bien sedentario o activo?',
    answerType: 'single_choice',
    options: [
      { label: 'Sedentario', value: 'sedentary' },
      { label: 'Activo', value: 'active' },
      { label: 'Mixto', value: 'mixed' },
    ],
    priority: 48,
  },
  {
    id: 'lifestyle.occupation',
    category: 'lifestyle',
    field: 'occupation',
    text: '¿A qué te dedicas?',
    answerType: 'text',
    priority: 46,
  },
  {
    id: 'lifestyle.commuteType',
    category: 'lifestyle',
    field: 'commuteType',
    text: '¿Cómo te mueves normalmente en el día a día?',
    answerType: 'single_choice',
    options: [
      { label: 'Andando', value: 'walking' },
      { label: 'Coche', value: 'car' },
      { label: 'Transporte público', value: 'public_transport' },
      { label: 'Bici', value: 'bike' },
    ],
    priority: 44,
  },
  {
    id: 'lifestyle.travelFrequency',
    category: 'lifestyle',
    field: 'travelFrequency',
    text: '¿Viajas a menudo por trabajo u ocio?',
    answerType: 'single_choice',
    options: [
      { label: 'Nunca', value: 'never' },
      { label: 'A veces', value: 'sometimes' },
      { label: 'Mucho', value: 'often' },
    ],
    priority: 42,
  },
  {
    id: 'lifestyle.weekendRoutineDiffers',
    category: 'lifestyle',
    field: 'weekendRoutineDiffers',
    text: '¿Tu rutina de fin de semana es muy distinta a la del resto de la semana?',
    answerType: 'single_choice',
    options: [
      { label: 'Sí', value: true },
      { label: 'No', value: false },
    ],
    priority: 40,
  },
  {
    id: 'lifestyle.stressLevel',
    category: 'lifestyle',
    field: 'stressLevel',
    text: '¿Cómo dirías que es tu nivel de estrés habitual?',
    answerType: 'single_choice',
    options: [
      { label: 'Bajo', value: 'low' },
      { label: 'Medio', value: 'medium' },
      { label: 'Alto', value: 'high' },
    ],
    priority: 38,
  },
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

  // ─── Motivation ─────────────────────────────────────────────────────────
  {
    id: 'motivation.mainMotivation',
    category: 'motivation',
    field: 'mainMotivation',
    text: '¿Qué es lo que más te motiva a cuidarte?',
    answerType: 'text',
    isList: true,
    priority: 80,
  },
  {
    id: 'motivation.biggestObstacle',
    category: 'motivation',
    field: 'biggestObstacle',
    text: '¿Qué te ha impedido lograr este objetivo antes?',
    answerType: 'text',
    isList: true,
    priority: 78,
  },
  {
    id: 'motivation.pastSuccessExperience',
    category: 'motivation',
    field: 'pastSuccessExperience',
    text: '¿Has conseguido algo parecido antes? Cuéntame qué te funcionó',
    answerType: 'text',
    isList: true,
    priority: 40,
  },
  {
    id: 'motivation.accountabilityPreference',
    category: 'motivation',
    field: 'accountabilityPreference',
    text: '¿Cómo prefieres que te acompañe la app?',
    answerType: 'single_choice',
    options: [
      { label: 'Seguimiento diario', value: 'daily' },
      { label: 'Seguimiento semanal', value: 'weekly' },
      { label: 'Solo cuando pregunte', value: 'only_when_asked' },
    ],
    priority: 38,
  },
  {
    id: 'motivation.progressRewardStyle',
    category: 'motivation',
    field: 'progressRewardStyle',
    text: '¿Qué te motiva más al ver tu progreso?',
    answerType: 'single_choice',
    options: [
      { label: 'Números y gráficas', value: 'numbers' },
      { label: 'Cómo me siento', value: 'feeling' },
      { label: 'Cumplir un reto', value: 'challenge' },
    ],
    priority: 36,
  },

  // ─── Preferences ────────────────────────────────────────────────────────
  {
    id: 'preferences.unitSystem',
    category: 'preferences',
    field: 'unitSystem',
    text: '¿Prefieres kilos o libras?',
    answerType: 'single_choice',
    options: [
      { label: 'Kilos (kg)', value: 'kg' },
      { label: 'Libras (lb)', value: 'lb' },
    ],
    priority: 90,
  },
  {
    id: 'preferences.coachingTone',
    category: 'preferences',
    field: 'coachingTone',
    text: '¿Cómo prefieres que te hable la app cuando te motive o te corrija?',
    answerType: 'text',
    isList: true,
    priority: 42,
  },
  {
    id: 'preferences.reminderTime',
    category: 'preferences',
    field: 'reminderTime',
    text: '¿Cuándo prefieres recibir recordatorios?',
    answerType: 'single_choice',
    options: [
      { label: 'Mañana', value: 'morning' },
      { label: 'Mediodía', value: 'midday' },
      { label: 'Tarde', value: 'afternoon' },
      { label: 'Noche', value: 'evening' },
    ],
    priority: 34,
  },

  // ─── Body ───────────────────────────────────────────────────────────────
  {
    id: 'body.focusArea',
    category: 'body',
    field: 'focusArea',
    text: '¿En qué zona te gustaría notar más el cambio?',
    answerType: 'single_choice',
    options: [
      { label: 'Piernas', value: 'legs' },
      { label: 'Brazos', value: 'arms' },
      { label: 'Abdomen', value: 'abdomen' },
      { label: 'Espalda', value: 'back' },
      { label: 'General, todo el cuerpo', value: 'general' },
    ],
    priority: 56,
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
