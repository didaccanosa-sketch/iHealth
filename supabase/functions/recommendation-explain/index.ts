// Supabase Edge Function (Deno) — proxy seguro hacia la API de Anthropic.
// La API key vive SOLO como "secret" de Supabase (nunca en el código de la app).
//
// Recibe los HECHOS ya calculados por el Strategy Planner (ver
// lib/engine/recommendation-engine.ts, StrategyPlan.explanations), separados
// por dominio — nunca datos en crudo del usuario ni una conversación libre.
// La IA aquí solo redacta un párrafo corto a partir de esos hechos, en
// español sencillo y personalizado; nunca decide ni inventa números.
//
// `domain` decide el tono: 'nutrition' solo habla de comida/calorías/macros,
// 'workout' solo habla de entreno/cardio — nunca se mezclan.
//
// Desplegar con:
//   supabase functions deploy recommendation-explain
// (usa el mismo secret ANTHROPIC_API_KEY que analyze-meal / nutrition-insight)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOMAIN_FRAMING: Record<string, string> = {
  nutrition: 'You only talk about food, calories and macros — never mention training, cardio or recovery.',
  workout: 'You only talk about training, frequency, phase and cardio — never mention calories or macros.',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { domain, facts } = await req.json();
    if (!facts || !Array.isArray(facts) || !domain || !DOMAIN_FRAMING[domain]) {
      return new Response(JSON.stringify({ error: 'Missing or invalid facts/domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system:
          'You are a friendly, knowledgeable coach speaking directly to the user inside a fitness app, in Spanish. ' +
          'You receive a short list of plain-language facts that a deterministic engine already calculated — never ' +
          'raw numbers you have to invent. Rewrite them as a short, warm, personalized paragraph (2-4 sentences, ' +
          'max ~400 characters) in natural Spanish that anyone can understand, as if explaining it to a friend. ' +
          DOMAIN_FRAMING[domain] +
          ' Never invent a fact that is not in the list, never add numbers that are not there. No exclamation-mark ' +
          'spam, no markdown, no bullet points. Reply with ONLY the paragraph — no quotes, no JSON.',
        messages: [{ role: 'user', content: JSON.stringify({ domain, facts }) }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'Anthropic error: ' + errText }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const text = (data.content[0].text as string).trim().replace(/^"|"$/g, '');

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error: ' + (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
