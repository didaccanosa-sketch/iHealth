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
