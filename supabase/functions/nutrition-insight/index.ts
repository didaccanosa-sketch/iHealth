// Supabase Edge Function (Deno) — proxy seguro hacia la API de Anthropic.
// La API key vive SOLO como "secret" de Supabase (nunca en el código de la app).
//
// Recibe los HECHOS ya calculados del día (ver lib/engine/nutritionInsight.ts),
// nunca las comidas en crudo ni una conversación libre — la IA aquí solo
// redacta una frase corta a partir de esos hechos, no decide ni inventa datos.
//
// Desplegar con:
//   supabase functions deploy nutrition-insight
// (usa el mismo secret ANTHROPIC_API_KEY que analyze-meal)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { facts } = await req.json();
    if (!facts) {
      return new Response(JSON.stringify({ error: 'Missing facts' }), {
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
        max_tokens: 150,
        system:
          'You are a friendly, concise nutrition coach speaking directly to the user inside a fitness app. ' +
          'You receive a small JSON object with CATEGORICAL facts about the user\'s nutrition today and a short-term ' +
          'trend — never raw numbers. Write exactly ONE short sentence (max ~160 characters) in English: a quick, ' +
          'warm but not corny read on how their day is going, and, when it fits naturally, one concrete nudge. ' +
          'Never invent specific numbers or quantities that are not in the facts — stay qualitative (e.g. "well ' +
          'above your protein target", "still short on fiber today"). No exclamation-mark spam. Reply with ONLY ' +
          'the sentence — no quotes, no markdown, no JSON.',
        messages: [{ role: 'user', content: JSON.stringify(facts) }],
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
    const line = (data.content[0].text as string).trim().replace(/^"|"$/g, '');

    return new Response(JSON.stringify({ line }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error: ' + (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
