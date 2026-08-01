// User Model — tipos. Ver docs/USER_MODEL.md para el diseño completo.
//
// v1 usa solo dos estados por campo (nada de confidence score todavía,
// eso queda para más adelante si hace falta de verdad):
//   - 'unknown'   → no se sabe / no se ha preguntado nunca
//   - 'confirmed' → viene de una acción real del usuario (respuesta directa,
//                    edición manual, o inferido de una acción en la app)
export type FieldStatus = 'unknown' | 'confirmed';

export type Field<T> = {
  value: T | null;
  status: FieldStatus;
  updatedAt: string | null; // ISO date, null si status === 'unknown'
};

function unknownField<T>(): Field<T> {
  return { value: null, status: 'unknown', updatedAt: null };
}

// ─── IDENTITY — datos básicos, se editan a mano en la pantalla de Perfil,
// no pasan por el Question Engine ───────────────────────────────────────────
export type Sex = 'male' | 'female' | 'other';

export type IdentityModel = {
  firstName: Field<string>;
  lastName: Field<string>;
  age: Field<number>;
  sex: Field<Sex>;
  heightCm: Field<number>;
  startingWeightKg: Field<number>;
};

// ─── GOALS ──────────────────────────────────────────────────────────────────
// Cada tipo determina qué métrica observa el Goal Engine (ver
// lib/engine/goal-engine.ts, GOAL_METRICS): peso para lose_fat/gain_muscle,
// 1RM estimado para strength, y stamina/mobility quedan definidos pero sin
// fuente de datos real todavía (Cardio v2 / tracking de movilidad, piezas
// aparte) — el motor responde "insufficient_data" para esos hasta entonces.
export type GoalType = 'lose_fat' | 'gain_muscle' | 'maintain' | 'strength' | 'stamina' | 'mobility';

export type GoalsModel = {
  type: Field<GoalType>;
  targetWeightKg: Field<number>; // solo lose_fat / gain_muscle
  targetDate: Field<string>; // ISO date, opcional para cualquier tipo
  targetExercise: Field<string>; // solo strength — qué ejercicio
  targetExerciseKg: Field<number>; // solo strength — 1RM estimado objetivo
};

// ─── TRAINING ───────────────────────────────────────────────────────────────
export type Experience = 'beginner' | 'advanced';

export type TrainingModel = {
  experience: Field<Experience>;
  trainingMonths: Field<number>; // meses entrenando de forma constante — más preciso que experience solo
  daysPerWeek: Field<number>;
  equipment: Field<string[]>;
  preferredExercises: Field<string[]>;
  dislikedExercises: Field<string[]>;
  injuries: Field<string[]>;
  preferredSplit: Field<'full_body' | 'split' | 'no_preference'>;
  warmupHabit: Field<'always' | 'sometimes' | 'rarely'>;
  favoriteMuscleGroup: Field<string[]>; // texto libre analizado con IA en tags
  dislikedMuscleGroup: Field<string[]>; // texto libre analizado con IA en tags
  cardioPreference: Field<'running' | 'cycling' | 'swimming' | 'walking' | 'elliptical' | 'no_preference'>;
  socialPreference: Field<'solo' | 'group' | 'indifferent'>;
  pastRoutineDislikes: Field<string[]>; // texto libre analizado con IA en tags
};

// ─── NUTRITION ──────────────────────────────────────────────────────────────
export type DietaryPattern = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'other';

export type NutritionModel = {
  mealsPerDay: Field<number>;
  dislikedFoods: Field<string[]>;
  allergies: Field<string[]>;
  dietaryPattern: Field<DietaryPattern>;
  cookingSkill: Field<'basic' | 'medium' | 'advanced'>;
  cookingTimeAvailable: Field<'low' | 'medium' | 'high'>;
  eatingOutFrequency: Field<number>; // veces por semana
  snackingHabit: Field<'yes' | 'no' | 'sometimes'>;
  preferredCuisine: Field<string[]>; // texto libre analizado con IA en tags
  mealPrepHabit: Field<'yes' | 'no' | 'sometimes'>;
  cravings: Field<string[]>; // texto libre analizado con IA en tags
};

// ─── LIFESTYLE ──────────────────────────────────────────────────────────────
export type ActivityLevel = 'low' | 'medium' | 'high';
export type TrainingTime = 'morning' | 'afternoon' | 'evening';

export type LifestyleModel = {
  workType: Field<'sedentary' | 'active' | 'mixed'>;
  dailyActivity: Field<ActivityLevel>;
  sleepHours: Field<number>;
  preferredTrainingTime: Field<TrainingTime>;
  sessionLengthMin: Field<number>;
  occupation: Field<string>;
  commuteType: Field<'walking' | 'car' | 'public_transport' | 'bike'>;
  travelFrequency: Field<'never' | 'sometimes' | 'often'>;
  weekendRoutineDiffers: Field<boolean>;
  stressLevel: Field<'low' | 'medium' | 'high'>;
};

// ─── ADHERENCE — se infiere del comportamiento (sesiones completadas,
// comidas registradas...), nunca se pregunta directamente. El motor deja
// los campos listos; el enganche real a workout/nutrition engine para que
// se autorellenen es una pieza aparte, no de esta pasada ─────────────────────
export type AdherenceModel = {
  consistencyScore: Field<number>; // 0-1
  workoutsCompletedRatio: Field<number>; // 0-1
  mealsLoggedRatio: Field<number>; // 0-1
  currentStreakDays: Field<number>;
  lastActiveAt: Field<string>; // ISO date
};

// ─── MOTIVATION — nunca de acción directa en la app, solo de lo que cuenta
// el usuario; todo lo de texto libre se analiza con IA en tags (mismo
// patrón que lesiones/alergias) ─────────────────────────────────────────────
export type AccountabilityPreference = 'daily' | 'weekly' | 'only_when_asked';
export type ProgressRewardStyle = 'numbers' | 'feeling' | 'challenge';

export type MotivationModel = {
  mainMotivation: Field<string[]>;
  biggestObstacle: Field<string[]>;
  pastSuccessExperience: Field<string[]>;
  accountabilityPreference: Field<AccountabilityPreference>;
  progressRewardStyle: Field<ProgressRewardStyle>;
};

// ─── PREFERENCES — cómo quiere el usuario que la app se comporte con él ────
export type PreferencesModel = {
  coachingTone: Field<string[]>; // texto libre analizado con IA en tags
  unitSystem: Field<'kg' | 'lb'>;
  reminderTime: Field<'morning' | 'midday' | 'afternoon' | 'evening'>;
};

// ─── BODY — solo lo estético/estructural que el propio usuario define como
// objetivo, nada médico (eso sigue en Health, aparte) ────────────────────────
export type BodyModel = {
  focusArea: Field<string[]>; // texto libre analizado con IA en tags, no una lista cerrada de zonas
};

// ─── HEALTH — sin contenido todavía, dato sensible, decisión aparte ─────────
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type HealthModel = Record<string, never>;

export type UserModelData = {
  identity: IdentityModel;
  goals: GoalsModel;
  training: TrainingModel;
  nutrition: NutritionModel;
  lifestyle: LifestyleModel;
  adherence: AdherenceModel;
  body: BodyModel;
  motivation: MotivationModel;
  preferences: PreferencesModel;
  health: HealthModel;
};

export function createEmptyUserModel(): UserModelData {
  return {
    identity: {
      firstName: unknownField(),
      lastName: unknownField(),
      age: unknownField(),
      sex: unknownField(),
      heightCm: unknownField(),
      startingWeightKg: unknownField(),
    },
    goals: {
      type: unknownField(),
      targetWeightKg: unknownField(),
      targetDate: unknownField(),
      targetExercise: unknownField(),
      targetExerciseKg: unknownField(),
    },
    training: {
      experience: unknownField(),
      trainingMonths: unknownField(),
      daysPerWeek: unknownField(),
      equipment: unknownField(),
      preferredExercises: unknownField(),
      dislikedExercises: unknownField(),
      injuries: unknownField(),
      preferredSplit: unknownField(),
      warmupHabit: unknownField(),
      favoriteMuscleGroup: unknownField(),
      dislikedMuscleGroup: unknownField(),
      cardioPreference: unknownField(),
      socialPreference: unknownField(),
      pastRoutineDislikes: unknownField(),
    },
    nutrition: {
      mealsPerDay: unknownField(),
      dislikedFoods: unknownField(),
      allergies: unknownField(),
      dietaryPattern: unknownField(),
      cookingSkill: unknownField(),
      cookingTimeAvailable: unknownField(),
      eatingOutFrequency: unknownField(),
      snackingHabit: unknownField(),
      preferredCuisine: unknownField(),
      mealPrepHabit: unknownField(),
      cravings: unknownField(),
    },
    lifestyle: {
      workType: unknownField(),
      dailyActivity: unknownField(),
      sleepHours: unknownField(),
      preferredTrainingTime: unknownField(),
      sessionLengthMin: unknownField(),
      occupation: unknownField(),
      commuteType: unknownField(),
      travelFrequency: unknownField(),
      weekendRoutineDiffers: unknownField(),
      stressLevel: unknownField(),
    },
    adherence: {
      consistencyScore: unknownField(),
      workoutsCompletedRatio: unknownField(),
      mealsLoggedRatio: unknownField(),
      currentStreakDays: unknownField(),
      lastActiveAt: unknownField(),
    },
    body: {
      focusArea: unknownField(),
    },
    motivation: {
      mainMotivation: unknownField(),
      biggestObstacle: unknownField(),
      pastSuccessExperience: unknownField(),
      accountabilityPreference: unknownField(),
      progressRewardStyle: unknownField(),
    },
    preferences: {
      coachingTone: unknownField(),
      unitSystem: unknownField(),
      reminderTime: unknownField(),
    },
    health: {},
  };
}

// Categorías con campos reales (las que puede tocar el Question Engine y la
// pantalla de Perfil). Solo Health se queda definida pero vacía (dato
// sensible, decisión aparte).
export type FilledCategory =
  | 'identity'
  | 'goals'
  | 'training'
  | 'nutrition'
  | 'lifestyle'
  | 'adherence'
  | 'motivation'
  | 'preferences'
  | 'body';
