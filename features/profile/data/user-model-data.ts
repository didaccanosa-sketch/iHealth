// Supabase reads/writes para `user_model` — sin lógica de negocio aquí,
// eso vive en features/profile/engine/user-model.ts.
import { supabase } from '../../../lib/supabase';
import { fetchPreferredTrainingDays, fetchProfile, savePreferredTrainingDays } from '../../../lib/data/profile';
import { UserModelData } from '../engine/types';
import { hydrateFromLegacyProfile, hydrateUserModel } from '../engine/user-model';

export async function fetchUserModel(userId: string): Promise<UserModelData> {
  const { data, error } = await supabase.from('user_model').select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return hydrateUserModel(data?.data ?? null);
}

export async function saveUserModel(userId: string, model: UserModelData): Promise<void> {
  const { error } = await supabase
    .from('user_model')
    .upsert({ user_id: userId, data: model, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

// Carga el User Model y, la primera vez, lo rellena con lo que ya hubiera
// suelto en `profiles` (height_cm, starting_weight_kg, preferred_training_days)
// — así un usuario que ya tenía esos datos no tiene que volver a
// introducirlos. `profiles` sigue existiendo tal cual, esto es solo una
// migración de lectura de un solo sentido (profiles → user_model).
export async function loadUserModel(userId: string): Promise<UserModelData> {
  const [model, legacyProfile, legacyDays] = await Promise.all([
    fetchUserModel(userId),
    fetchProfile(userId).catch(() => null),
    fetchPreferredTrainingDays(userId).catch(() => null),
  ]);
  const hydrated = hydrateFromLegacyProfile(model, {
    name: legacyProfile?.name ?? null,
    height_cm: legacyProfile?.height_cm ?? null,
    starting_weight_kg: legacyProfile?.starting_weight_kg ?? null,
    preferred_training_days: legacyDays ?? null,
  });
  if (hydrated !== model) {
    saveUserModel(userId, hydrated).catch(() => {
      // si falla el guardado de la migración no pasa nada grave — se
      // reintenta en la próxima carga, el modelo en memoria ya es correcto
    });
  }
  return hydrated;
}

// La pantalla de Perfil escribe primero en user_model (fuente de verdad),
// y de paso mantiene `profiles` al día para no romper a quien todavía lee
// de ahí directamente (TemplatePicker, Today).
export async function syncIdentityToLegacyProfile(
  userId: string,
  fields: {
    fullName?: string | null;
    heightCm?: number | null;
    startingWeightKg?: number | null;
    daysPerWeek?: number | null;
  }
): Promise<void> {
  const updates: Record<string, number | string> = {};
  if (fields.fullName != null) updates.name = fields.fullName;
  if (fields.heightCm != null) updates.height_cm = fields.heightCm;
  if (fields.startingWeightKg != null) updates.starting_weight_kg = fields.startingWeightKg;
  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', userId);
  }
  if (fields.daysPerWeek != null) {
    await savePreferredTrainingDays(userId, fields.daysPerWeek);
  }
}
