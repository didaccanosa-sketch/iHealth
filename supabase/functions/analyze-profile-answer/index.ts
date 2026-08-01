// Supabase Edge Function (Deno) — proxy seguro hacia la API de Anthropic.
// Convierte una respuesta de texto libre del Question Engine (User Model) en
// una lista corta de tags estructurados. Se usa solo para preguntas de tipo
// 'text' (lesiones, alergias...) — ver features/profile/engine/questions.ts
// y docs/USER_MODEL.md. Las preguntas de opción fija (single_choice) no
// pasan por aquí, no lo necesitan.
//
// Desplegar con:
//   supabase functions deploy analyze-profile-answer
// (usa el mismo secret ANTHROPIC_API_KEY que analyze-meal / analyze-cardio)

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
    const { text, question } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Missing answer text' }), {
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
          'You help build a structured fitness/nutrition user profile. The user answered a question in free text (Spanish or English), possibly with typos, and possibly describing more than one thing at once. Extract a short list of concise, lowercase, normalized tags capturing everything relevant they said (fix typos, use a consistent short term per item — e.g. "dolor de rodilla derecha" -> ["rodilla"], "soy alergico a los frutos secos y algo de lactosa" -> ["frutos secos","lactosa"]). Reply ONLY with JSON, no markdown, in this exact shape: {"items":["tag1","tag2"]}. Never return an empty list — if nothing usable was said, return the cleaned-up original text as a single item.',
        messages: [
          {
            role: 'user',
            content: question ? `Question: ${question}\nAnswer: ${text}` : text,
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
