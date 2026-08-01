// Catálogo GENÉRICO de categorías de alimentos — no platos concretos, sino
// grupos ("proteína animal", "legumbre"...) con macros representativas por
// 100g. Es la base del generador de menú determinista (ver
// lib/engine/diet-generator.ts) — mismo papel que exercise-db.ts para las
// rutinas: elegir qué proponer nunca necesita IA, sale de esta tabla fija.
// Los números son aproximados a propósito (medias razonables de la
// categoría) — el objetivo es un punto de partida útil, no precisión de
// nutricionista.

export type FoodCategory =
  | 'animal_protein'
  | 'legume'
  | 'dairy_protein'
  | 'grain'
  | 'tuber'
  | 'fruit'
  | 'vegetable'
  | 'healthy_fat';

export type FoodCategoryInfo = {
  id: FoodCategory;
  label: string;
  examples: string;
  per100g: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
};

export const FOOD_CATEGORIES: Record<FoodCategory, FoodCategoryInfo> = {
  animal_protein: {
    id: 'animal_protein',
    label: 'proteína animal',
    examples: 'pollo, pescado, ternera magra, huevo',
    per100g: { kcal: 150, protein_g: 25, carbs_g: 0, fat_g: 5, fiber_g: 0 },
  },
  legume: {
    id: 'legume',
    label: 'legumbre',
    examples: 'lentejas, garbanzos, alubias',
    per100g: { kcal: 120, protein_g: 8, carbs_g: 20, fat_g: 1, fiber_g: 7 },
  },
  dairy_protein: {
    id: 'dairy_protein',
    label: 'lácteo proteico',
    examples: 'yogur griego, queso fresco, requesón',
    per100g: { kcal: 90, protein_g: 10, carbs_g: 4, fat_g: 3, fiber_g: 0 },
  },
  grain: {
    id: 'grain',
    label: 'cereal/grano',
    examples: 'arroz, pasta, pan, avena',
    per100g: { kcal: 130, protein_g: 3, carbs_g: 28, fat_g: 1, fiber_g: 1 },
  },
  tuber: {
    id: 'tuber',
    label: 'tubérculo',
    examples: 'patata, boniato',
    per100g: { kcal: 85, protein_g: 2, carbs_g: 20, fat_g: 0, fiber_g: 2 },
  },
  fruit: {
    id: 'fruit',
    label: 'fruta',
    examples: 'manzana, plátano, fruta de temporada',
    per100g: { kcal: 60, protein_g: 1, carbs_g: 15, fat_g: 0, fiber_g: 2 },
  },
  vegetable: {
    id: 'vegetable',
    label: 'verdura',
    examples: 'ensalada, verdura al vapor o salteada',
    per100g: { kcal: 25, protein_g: 2, carbs_g: 5, fat_g: 0, fiber_g: 2 },
  },
  healthy_fat: {
    id: 'healthy_fat',
    label: 'grasa saludable',
    examples: 'aceite de oliva, frutos secos, aguacate',
    per100g: { kcal: 600, protein_g: 10, carbs_g: 10, fat_g: 55, fiber_g: 5 },
  },
};
