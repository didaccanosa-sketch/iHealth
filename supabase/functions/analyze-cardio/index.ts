// Supabase Edge Function (Deno) — proxy seguro hacia la API de Anthropic.
// Analiza texto libre sobre una sesión de cardio y devuelve datos estructurados.
//
// Desplegar con:
//   supabase functions deploy analyze-cardio
// (usa el mismo secreto ANTHROPIC_API_KEY ya configurado para analyze-meal)

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
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Missing cardio text' }), {
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
        max_tokens: 400,
        system:
          'You are a fitness tracker. The user describes a cardio session in free text (Spanish or English), possibly with typos. Reply ONLY with JSON, no markdown, in this exact shape: {"desc":"short clean description","activity_type":"running|cycling|elliptical|swimming|rowing|walking|other","duration_min":number,"distance_km":number,"kcal":number,"avg_heart_rate":number}. "desc" should be clean and well-capitalized. If a value is not mentioned or cannot be estimated, use 0 (or null for distance_km/avg_heart_rate if clearly not applicable, e.g. an elliptical session with no distance given — still try your best to estimate kcal from duration+activity_type if not given). Never invent an activity_type the user did not imply.',
        messages: [{ role: 'user', content: text }],
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
