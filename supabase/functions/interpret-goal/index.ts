// Supabase Edge Function (Deno) — proxy seguro hacia la API de Anthropic.
// Convierte el texto libre del Goal Chat en un objetivo estructurado
// (mismos campos que GoalsModel en features/profile/engine/types.ts). Ver
// TODO.md, sección "Goal Chat" para el diseño completo. Nunca adivina: si
// el texto no se puede interpretar con confianza, devuelve un error para
// que la UI deje reintentar en vez de guardar algo a medias.
//
// Desplegar con:
//   supabase functions deploy interpret-goal
// (usa el mismo secret ANTHROPIC_API_KEY que analyze-meal / analyze-cardio /
// analyze-profile-answer)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TYPES = ['lose_fat', 'gain_muscle', 'maintain', 'strength', 'stamina', 'mobility'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Missing goal text' }), {
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
        max_tokens: 300,
        system:
          'You help set a fitness/nutrition goal for a wellness app from a free-text description (Spanish or English, possibly with typos). Map it to exactly one of these goal types: "lose_fat" (losing body fat/weight), "gain_muscle" (building muscle/bulking), "maintain" (maintaining current weight/body), "strength" (getting stronger at a specific lift), "stamina" (cardio/endurance), "mobility" (flexibility/mobility). If a target weight in kg is mentioned or clearly implied, include targetWeightKg (convert lbs to kg if needed, round to 1 decimal). If a target date is mentioned, include targetDate as an ISO date (YYYY-MM-DD) — resolve relative dates like "in 3 months" using the date I give you as "today". For type "strength" only: if a specific exercise is named, include targetExercise (short name, e.g. "sentadilla", "press banca"); if a target weight/1RM for that exercise is mentioned, include targetExerciseKg. Only include fields that were actually stated or unambiguously implied — never invent a number that was not given. If the text is too vague or unrelated to a fitness goal to confidently pick ONE type (e.g. just "help me" or something off-topic), reply with {"error":"unclear"} instead of guessing. Reply ONLY with JSON, no markdown, no explanation, in this exact shape: {"type":"lose_fat","targetWeightKg":72,"targetDate":"2026-12-01","targetExercise":"sentadilla","targetExerciseKg":100} — omit any field not stated. On failure: {"error":"unclear"}.',
        messages: [
          {
            role: 'user',
            content: `Today's date: ${new Date().toISOString().slice(0, 10)}\nGoal text: ${text}`,
          },
        ],
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
    const raw = data.content[0].text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);

    if (result.error || !VALID_TYPES.includes(result.type)) {
      return new Response(JSON.stringify({ error: 'unclear' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error: ' + (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
