export type Macros = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

export type Meal = {
  id: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: 'chat' | 'photo' | 'template';
  meal_slot: number;
  logged_at: string;
  logged_time: string;
};

export type MacroGoals = Macros;

export type MacroStatus = {
  totals: Macros;
  goals: MacroGoals;
  remaining: Macros;
  pct: Record<keyof Macros, number>;
};

// ─── WORKOUT ENGINE ──────────────────────────────────────────────────────────

export type Level = 'principiante' | 'avanzado';
export type Phase = 'volumen' | 'mantenimiento' | 'definicion';

export type MuscleGroup =
  | 'pecho'
  | 'espalda'
  | 'lumbar'
  | 'core'
  | 'hombro'
  | 'biceps'
  | 'triceps'
  | 'cuadriceps'
  | 'isquios'
  | 'gluteo'
  | 'aductores'
  | 'abductores'
  | 'gemelos';

export type MesoExercise = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  sets: number;
  reps: string; // e.g. "8-12"
  sort_order: number;
};

export type MesoDay = {
  id: string;
  day_index: number;
  label: string;
  exercises: MesoExercise[];
};

export type Mesocycle = {
  id: string;
  height_cm: number | null;
  level: Level;
  phase: Phase;
  duration_weeks: number;
  days_per_week: number;
  current_index: number;
  started: boolean;
  finished: boolean;
  days: MesoDay[];
};

export type SessionSet = {
  exercise_id: string;
  set_index: number;
  kg: number | null;
  reps: number | null;
  is_pr: boolean;
};

export type MesoSession = {
  id: string;
  mesocycle_id: string;
  session_index: number;
  completed: boolean;
  sets: SessionSet[];
};

export type SessionDef = {
  week: number;
  isDeload: boolean;
  dayIndex: number;
  dayLabel: string;
  exercises: { id: string; name: string; sets: number; reps: string }[];
};

export type ProgressionSuggestion = { text: string };

export type PersonalRecord = {
  exercise_name: string;
  est_1rm: number;
  kg: number;
  reps: number;
};

