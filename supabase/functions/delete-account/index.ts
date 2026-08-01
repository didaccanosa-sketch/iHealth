// Supabase Edge Function (Deno) — borra la cuenta del usuario que llama y
// TODO su rastro. No usa la API de Anthropic, así que no necesita
// ANTHROPIC_API_KEY. Usa la service role key (auto-disponible en toda
// Edge Function de Supabase como SUPABASE_SERVICE_ROLE_KEY, sin configurar
// ningún secret nuevo) para borrar el usuario de auth.users — como todas
// las tablas de la app tienen `references profiles(id) on delete cascade`
// y `profiles.id references auth.users(id) on delete cascade` (ver
// schema.sql), borrar el usuario de auth borra en cascada absolutamente
// todo lo demás (perfil, objetivo, histórico de peso/comidas/entrenos...).
// No hay paso intermedio ni tabla que limpiar a mano.
//
// Seguridad: la service role key nunca sale de aquí ni llega al cliente.
// Antes de borrar nada, esta función valida con el token del propio
// usuario (Authorization header) quién es — solo puede borrarse a sí
// mismo, nunca a otro user_id.
//
// Desplegar con:
//   supabase functions deploy delete-account

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente "como el usuario" — solo para averiguar quién es de verdad a
    // partir de su propio token, nunca para confiar en un user_id que
    // mandara el propio cliente.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente admin — único con permiso para borrar usuarios.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error: ' + (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
