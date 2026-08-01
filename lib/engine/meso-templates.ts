import { MuscleGroup } from './types';
import { EXERCISE_DB, EQUIPMENT_ELIGIBLE, EquipmentLevel } from './exercise-db';

type TemplateExercise = { name: string; muscle_group: MuscleGroup; sets: number; reps: string };
export type TemplateDay = { label: string; exercises: TemplateExercise[] };

// Preferencias fijas del perfil que puede tener en cuenta el generador —
// ninguna se inventa aquí, todas vienen ya guardadas en el User Model
// (TrainingModel.equipment/preferredExercises/dislikedExercises).
export type ExercisePreferences = {
  equipmentLevel: EquipmentLevel | null;
  preferredExercises: string[];
  dislikedExercises: string[];
};

type TemplateDayTheme = { label: string; groups: MuscleGroup[]; emphasis?: MuscleGroup[] };

export type MesoTemplateDef = { id: string; name: string; daysPerWeek: number };

const GROUP_LABELS: Record<MuscleGroup, string> = {
  pecho: 'Chest',
  espalda: 'Back',
  lumbar: 'Lower Back',
  core: 'Core',
  hombro: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  cuadriceps: 'Quads',
  isquios: 'Hamstrings',
  gluteo: 'Glutes',
  aductores: 'Adductors',
  abductores: 'Abductors',
  gemelos: 'Calves',
};

const LOWER_BODY_REP_RANGE = ['cuadriceps', 'isquios', 'gluteo', 'espalda', 'pecho'];

function pickExercises(group: MuscleGroup, count: number, sets: number, prefs?: ExercisePreferences): TemplateExercise[] {
  const all = EXERCISE_DB[group] || [];
  const disliked = new Set((prefs?.dislikedExercises || []).map((n) => n.toLowerCase()));
  const preferred = new Set((prefs?.preferredExercises || []).map((n) => n.toLowerCase()));

  let pool = all.filter((e) => !disliked.has(e.name.toLowerCase()));
  if (prefs?.equipmentLevel) {
    const eligible = EQUIPMENT_ELIGIBLE[prefs.equipmentLevel];
    const withEquipment = pool.filter((e) => eligible.includes(e.equipment));
    // Si filtrar por equipo deja el grupo sin ejercicios (catálogo corto en
    // ese grupo), mejor mantener alguno aunque no sea ideal que dejar el día
    // vacío — nunca bloquea la rutina entera.
    if (withEquipment.length > 0) pool = withEquipment;
  }

  // Los preferidos van primero (dentro del mismo orden del catálogo), el
  // resto detrás — nunca se inventa un ejercicio nuevo, solo se reordena.
  pool = [...pool.filter((e) => preferred.has(e.name.toLowerCase())), ...pool.filter((e) => !preferred.has(e.name.toLowerCase()))];

  const reps = LOWER_BODY_REP_RANGE.includes(group) ? '6-10' : '8-12';
  return pool.slice(0, count).map((e) => ({ name: e.name, muscle_group: group, sets, reps }));
}

function buildDayFromTheme(theme: TemplateDayTheme, prefs?: ExercisePreferences): TemplateDay {
  const groups = theme.groups;
  const perGroup = groups.length <= 2 ? 3 : groups.length <= 4 ? 2 : 1;
  const exercises: TemplateExercise[] = [];
  groups.forEach((g) => {
    const isEmphasis = !!theme.emphasis?.includes(g);
    exercises.push(...pickExercises(g, perGroup, isEmphasis ? 4 : 3, prefs));
  });
  return { label: theme.label, exercises };
}

const CATALOG_DEFS: (MesoTemplateDef & { themes: TemplateDayTheme[] })[] = [
  {
    id: 'full-body-1',
    name: 'Full Body',
    daysPerWeek: 1,
    themes: [{ label: 'Full Body', groups: ['pecho', 'espalda', 'hombro', 'cuadriceps', 'isquios', 'biceps', 'triceps'] }],
  },
  {
    id: 'full-body-upper-2',
    name: 'Full Body — Upper Focus',
    daysPerWeek: 2,
    themes: [
      { label: 'Full Body A', groups: ['pecho', 'espalda', 'hombro', 'cuadriceps', 'biceps', 'triceps'] },
      { label: 'Full Body B', groups: ['espalda', 'pecho', 'hombro', 'isquios', 'gluteo', 'biceps', 'triceps'] },
    ],
  },
  {
    id: 'full-body-lower-2',
    name: 'Full Body — Lower Focus',
    daysPerWeek: 2,
    themes: [
      { label: 'Full Body A', groups: ['cuadriceps', 'isquios', 'gluteo', 'pecho', 'espalda', 'hombro'] },
      { label: 'Full Body B', groups: ['cuadriceps', 'isquios', 'gluteo', 'pecho', 'espalda', 'biceps', 'triceps'] },
    ],
  },
  {
    id: 'full-body-3x',
    name: 'Full Body x3',
    daysPerWeek: 3,
    themes: [
      { label: 'Full Body A', groups: ['pecho', 'espalda', 'cuadriceps', 'hombro', 'biceps'] },
      { label: 'Full Body B', groups: ['espalda', 'pecho', 'isquios', 'hombro', 'triceps'] },
      { label: 'Full Body C', groups: ['cuadriceps', 'gluteo', 'pecho', 'espalda', 'biceps', 'triceps'] },
    ],
  },
  {
    id: 'ppl-3',
    name: 'Push · Pull · Legs',
    daysPerWeek: 3,
    themes: [
      { label: 'Push', groups: ['pecho', 'hombro', 'triceps'] },
      { label: 'Pull', groups: ['espalda', 'biceps'] },
      { label: 'Legs', groups: ['cuadriceps', 'isquios', 'gluteo', 'gemelos'] },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower x2',
    daysPerWeek: 4,
    themes: [
      { label: 'Upper A', groups: ['pecho', 'espalda', 'hombro', 'biceps', 'triceps'] },
      { label: 'Lower A', groups: ['cuadriceps', 'isquios', 'gluteo'] },
      { label: 'Upper B', groups: ['espalda', 'pecho', 'hombro', 'biceps', 'triceps'] },
      { label: 'Lower B', groups: ['isquios', 'gluteo', 'cuadriceps', 'gemelos'] },
    ],
  },
  {
    id: 'ppl-upper-4',
    name: 'Push · Pull · Legs · Upper',
    daysPerWeek: 4,
    themes: [
      { label: 'Push', groups: ['pecho', 'hombro', 'triceps'] },
      { label: 'Pull', groups: ['espalda', 'biceps'] },
      { label: 'Legs', groups: ['cuadriceps', 'isquios', 'gluteo'] },
      { label: 'Upper', groups: ['pecho', 'espalda', 'hombro', 'biceps', 'triceps'] },
    ],
  },
  {
    id: 'ppl-ul-5',
    name: 'Push · Pull · Legs · Upper · Lower',
    daysPerWeek: 5,
    themes: [
      { label: 'Push', groups: ['pecho', 'hombro', 'triceps'] },
      { label: 'Pull', groups: ['espalda', 'biceps'] },
      { label: 'Legs', groups: ['cuadriceps', 'isquios', 'gluteo'] },
      { label: 'Upper', groups: ['pecho', 'espalda', 'hombro'] },
      { label: 'Lower', groups: ['cuadriceps', 'isquios', 'gluteo', 'gemelos'] },
    ],
  },
  {
    id: 'bro-split-5',
    name: 'Bro Split',
    daysPerWeek: 5,
    themes: [
      { label: 'Chest', groups: ['pecho'] },
      { label: 'Back', groups: ['espalda'] },
      { label: 'Legs', groups: ['cuadriceps', 'isquios', 'gluteo'] },
      { label: 'Shoulders', groups: ['hombro'] },
      { label: 'Arms', groups: ['biceps', 'triceps'] },
    ],
  },
  {
    id: 'ppl-6',
    name: 'Push · Pull · Legs x2',
    daysPerWeek: 6,
    themes: [
      { label: 'Push A', groups: ['pecho', 'hombro', 'triceps'] },
      { label: 'Pull A', groups: ['espalda', 'biceps'] },
      { label: 'Legs A', groups: ['cuadriceps', 'isquios', 'gluteo'] },
      { label: 'Push B', groups: ['pecho', 'hombro', 'triceps'] },
      { label: 'Pull B', groups: ['espalda', 'biceps'] },
      { label: 'Legs B', groups: ['cuadriceps', 'isquios', 'gluteo', 'gemelos'] },
    ],
  },
  {
    id: 'arnold-6',
    name: 'Arnold Split x2',
    daysPerWeek: 6,
    themes: [
      { label: 'Chest & Back A', groups: ['pecho', 'espalda'] },
      { label: 'Shoulders & Arms A', groups: ['hombro', 'biceps', 'triceps'] },
      { label: 'Legs A', groups: ['cuadriceps', 'isquios', 'gluteo'] },
      { label: 'Chest & Back B', groups: ['pecho', 'espalda'] },
      { label: 'Shoulders & Arms B', groups: ['hombro', 'biceps', 'triceps'] },
      { label: 'Legs B', groups: ['cuadriceps', 'isquios', 'gluteo', 'gemelos'] },
    ],
  },
];

export function listBuiltinTemplates(): MesoTemplateDef[] {
  return CATALOG_DEFS.map(({ id, name, daysPerWeek }) => ({ id, name, daysPerWeek }));
}

export function instantiateBuiltinTemplate(id: string): TemplateDay[] {
  const def = CATALOG_DEFS.find((d) => d.id === id);
  if (!def) throw new Error('Template not found');
  return def.themes.map((t) => buildDayFromTheme(t));
}

// Generador: reparte los grandes grupos musculares en `daysPerWeek` días, dando
// una frecuencia extra (2x/semana) a los grupos priorizados.
const BIG_GROUPS: MuscleGroup[] = ['pecho', 'espalda', 'hombro', 'biceps', 'triceps', 'cuadriceps', 'isquios', 'gluteo'];

export function buildFocusSplit(daysPerWeek: number, priority: MuscleGroup[], prefs?: ExercisePreferences): TemplateDay[] {
  const slots: MuscleGroup[] = [];
  BIG_GROUPS.forEach((g) => {
    const count = priority.includes(g) ? 2 : 1;
    for (let i = 0; i < count; i++) slots.push(g);
  });

  let days: TemplateDayTheme[] = slots.map((g) => ({
    label: GROUP_LABELS[g],
    groups: [g],
    emphasis: priority.includes(g) ? [g] : undefined,
  }));

  while (days.length > daysPerWeek) {
    // Elige qué día quitar: preferiblemente uno que no sea prioritario, empezando por el final
    let removeIdx = -1;
    for (let i = days.length - 1; i >= 0; i--) {
      if (!days[i].groups.some((g) => priority.includes(g))) {
        removeIdx = i;
        break;
      }
    }
    if (removeIdx === -1) removeIdx = days.length - 1;

    const removed = days[removeIdx];

    // Busca, entre todos los días sin solape de grupo, el más pequeño — así el
    // reparto queda equilibrado en vez de amontonarse siempre en el mismo día
    let targetIdx = -1;
    let bestSize = Infinity;
    for (let i = 0; i < days.length; i++) {
      if (i === removeIdx) continue;
      const overlap = days[i].groups.some((g) => removed.groups.includes(g));
      if (overlap) continue;
      if (days[i].groups.length < bestSize) {
        bestSize = days[i].groups.length;
        targetIdx = i;
      }
    }
    if (targetIdx === -1) targetIdx = removeIdx === 0 ? 1 : removeIdx - 1;

    days.splice(removeIdx, 1);
    if (targetIdx > removeIdx) targetIdx -= 1;
    const target = days[targetIdx];
    removed.groups.forEach((g) => {
      if (!target.groups.includes(g)) target.groups.push(g);
    });
    if (removed.emphasis) target.emphasis = Array.from(new Set([...(target.emphasis || []), ...removed.emphasis]));
    target.label = target.groups.map((g) => GROUP_LABELS[g]).join(' & ');
  }

  while (days.length < daysPerWeek) {
    days.push({ label: 'Core & Mobility', groups: ['core'] });
  }

  return days.map((d) => buildDayFromTheme(d, prefs));
}
