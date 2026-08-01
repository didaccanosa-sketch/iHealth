// User Model Engine — lógica pura (sin Supabase, sin UI). Ver
// docs/USER_MODEL.md. La UI nunca debe fabricar un Field a mano ni decidir
// cuándo algo pasa a "confirmed" — siempre a través de setField.
import { createEmptyUserModel, Field, UserModelData } from './types';

// Fusiona lo que venga de la base de datos con la forma actual del modelo,
// para que añadir un campo nuevo a `types.ts` no rompa las filas ya
// guardadas (les faltará el campo nuevo, pero se rellena como 'unknown').
export function hydrateUserModel(partial: unknown): UserModelData {
  const empty = createEmptyUserModel();
  if (!partial || typeof partial !== 'object') return empty;
  const data = partial as Record<string, unknown>;
  const result = empty as unknown as Record<string, Record<string, unknown>>;
  for (const category of Object.keys(empty) as (keyof UserModelData)[]) {
    const incomingCategory = data[category];
    if (!incomingCategory || typeof incomingCategory !== 'object') continue;
    const emptyCategory = empty[category] as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...emptyCategory };
    for (const key of Object.keys(emptyCategory)) {
      const incomingField = (incomingCategory as Record<string, unknown>)[key];
      if (
        incomingField &&
        typeof incomingField === 'object' &&
        'status' in (incomingField as Record<string, unknown>)
      ) {
        merged[key] = incomingField;
      }
    }
    result[category] = merged;
  }
  return result as unknown as UserModelData;
}

export function getField<C extends keyof UserModelData, K extends keyof UserModelData[C]>(
  model: UserModelData,
  category: C,
  key: K
): UserModelData[C][K] {
  return model[category][key];
}

export function isUnknown<C extends keyof UserModelData, K extends keyof UserModelData[C]>(
  model: UserModelData,
  category: C,
  key: K
): boolean {
  const field = model[category][key] as unknown as Field<unknown>;
  return field.status === 'unknown';
}

// Marca un campo como 'confirmed' con el valor dado. Se usa tanto para
// respuestas directas del Question Engine / pantalla de Perfil como para
// auto-relleno desde acciones reales en la app (ej. crear un mesocycle
// confirma training.daysPerWeek) — confirmed siempre pisa unknown, nunca al
// revés (no hay confidence score en v1, así que no hay más matices que eso).
export function setField<C extends keyof UserModelData, K extends keyof UserModelData[C]>(
  model: UserModelData,
  category: C,
  key: K,
  value: UserModelData[C][K] extends Field<infer T> ? T : never
): UserModelData {
  const nextField: Field<unknown> = {
    value,
    status: 'confirmed',
    updatedAt: new Date().toISOString(),
  };
  return {
    ...model,
    [category]: {
      ...model[category],
      [key]: nextField,
    },
  };
}

// Deshace una respuesta: repone el Field exacto que había antes (puede ser
// 'unknown' o un valor previamente confirmado), sin pasar por setField —
// esto no es "el usuario confirma algo nuevo", es un undo literal. Lo usa
// solo la flecha de "volver atrás" de la tarjeta de preguntas.
export function revertField<C extends keyof UserModelData, K extends keyof UserModelData[C]>(
  model: UserModelData,
  category: C,
  key: K,
  field: UserModelData[C][K]
): UserModelData {
  return {
    ...model,
    [category]: {
      ...model[category],
      [key]: field,
    },
  };
}

// Datos que hoy viven sueltos en `profiles` (ver TODO.md). Se usan una sola
// vez para rellenar el User Model la primera vez que se lee, sin tocar el
// esquema/consumidores existentes de `profiles` (TemplatePicker, Today
// siguen leyendo de ahí igual que antes).
export type LegacyProfileFields = {
  name: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  preferred_training_days: number | null;
};

export function hydrateFromLegacyProfile(model: UserModelData, legacy: LegacyProfileFields): UserModelData {
  let next = model;
  // `profiles.name` es un único campo de texto libre (nombre completo tal
  // cual se guardó al registrarse). Lo volcamos entero a firstName como
  // punto de partida — el usuario lo separa en nombre/apellidos la primera
  // vez que entra en Perfil, no lo intentamos adivinar aquí.
  if (isUnknown(next, 'identity', 'firstName') && legacy.name) {
    next = setField(next, 'identity', 'firstName', legacy.name);
  }
  if (isUnknown(next, 'identity', 'heightCm') && legacy.height_cm != null) {
    next = setField(next, 'identity', 'heightCm', legacy.height_cm);
  }
  if (isUnknown(next, 'identity', 'startingWeightKg') && legacy.starting_weight_kg != null) {
    next = setField(next, 'identity', 'startingWeightKg', legacy.starting_weight_kg);
  }
  if (isUnknown(next, 'training', 'daysPerWeek') && legacy.preferred_training_days != null) {
    next = setField(next, 'training', 'daysPerWeek', legacy.preferred_training_days);
  }
  return next;
}
