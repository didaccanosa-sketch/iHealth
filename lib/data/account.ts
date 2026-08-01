// Borrado de cuenta — llama a la función de servidor (única con permiso
// para borrar de auth.users), luego limpia la sesión local. Ver
// supabase/functions/delete-account: al borrar el usuario, todo lo demás
// (perfil, objetivo, histórico...) cae en cascada solo, no hay que borrar
// tabla por tabla desde aquí.
import { supabase } from '../supabase';

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', {});
  if (error) throw error;
  await supabase.auth.signOut();
}
