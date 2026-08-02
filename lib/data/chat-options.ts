// Opciones cerradas para preguntas del chat — se muestran como botones en
// vez de pedir texto libre (regla general, ver docs/SIMPLIFIED_VISION.md):
// todo campo de opciones cerradas se pregunta con botones, uno a la vez,
// nunca combinado con otra pregunta. Los campos abiertos (ejercicios
// preferidos/no preferidos, alergias, gustos, etc.) siguen en texto libre.
export type ChatOption<T> = { value: T; label: string };

export const DAYS_PER_WEEK_OPTIONS: ChatOption<number>[] = [
  { value: 2, label: '2 días' },
  { value: 3, label: '3 días' },
  { value: 4, label: '4 días' },
  { value: 5, label: '5 días' },
  { value: 6, label: '6 días' },
];

export const EQUIPMENT_OPTIONS: ChatOption<'gym' | 'home_basic' | 'bodyweight_only'>[] = [
  { value: 'gym', label: 'Gimnasio completo' },
  { value: 'home_basic', label: 'Mancuernas/bandas en casa' },
  { value: 'bodyweight_only', label: 'Sin material' },
];

export const MEALS_PER_DAY_OPTIONS: ChatOption<number>[] = [
  { value: 2, label: '2 comidas' },
  { value: 3, label: '3 comidas' },
  { value: 4, label: '4 comidas' },
  { value: 5, label: '5 comidas' },
  { value: 6, label: '6 o más' },
];

// Registro de qué campos que el chat puede preguntar tienen opciones
// cerradas — usado por la UI para saber cuándo mostrar botones en vez de
// dejar escribir. Si un campo no está aquí, se pregunta en texto libre.
export const CLOSED_CHAT_FIELDS = {
  daysPerWeek: DAYS_PER_WEEK_OPTIONS,
  equipment: EQUIPMENT_OPTIONS,
  mealsPerDay: MEALS_PER_DAY_OPTIONS,
} as const;

export type ClosedChatField = keyof typeof CLOSED_CHAT_FIELDS;

export function isClosedChatField(field: string | null | undefined): field is ClosedChatField {
  return !!field && field in CLOSED_CHAT_FIELDS;
}

// Última pregunta antes de generar una rutina (qué grupo priorizar, si
// alguno) — es un caso aparte de CLOSED_CHAT_FIELDS: al tocar un botón no
// se manda a la IA para interpretarlo (ver finalizeWorkoutProposal en
// lib/data/chat.ts), se resuelve directo. Mismos valores exactos que
// PRIORITIZABLE_GROUPS en lib/data/chat.ts — si se añade un grupo ahí, hay
// que añadirlo aquí también.
export const FOCUS_MUSCLE_OPTIONS: ChatOption<string[]>[] = [
  { value: ['pecho'], label: 'Pecho' },
  { value: ['espalda'], label: 'Espalda' },
  { value: ['hombro'], label: 'Hombros' },
  { value: ['biceps'], label: 'Bíceps' },
  { value: ['triceps'], label: 'Tríceps' },
  { value: ['cuadriceps'], label: 'Cuádriceps' },
  { value: ['isquios'], label: 'Isquios' },
  { value: ['gluteo'], label: 'Glúteo' },
  { value: [], label: 'Sin prioridad' },
];
