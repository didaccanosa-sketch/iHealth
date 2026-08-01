// Supabase Edge Function (Deno) — proxy seguro hacia la API de Anthropic.
// La API key vive SOLO como "secret" de Supabase (nunca en el código de la app).
//
// Chat v1 de la pantalla única (ver docs/SIMPLIFIED_VISION.md). Recibe el
// mensaje libre del usuario + un resumen de HECHOS ya calculados (objetivo,
// veredicto del Goal Engine, StrategyPlan.explanations) — nunca inventa
// datos que no estén en ese resumen. Dos trabajos en una sola llamada:
//
// 1. Clasificar si el mensaje es un registro simple (peso/comida/entreno)
//    o una pregunta/consulta — interpretación básica, NO el router completo
//    pensado para más adelante (ver TODO.md).
// 2. Si es consulta, responder en lenguaje natural usando solo los hechos
//    recibidos. Terreno médico: reconoce el tema, es conservador, y deja
//    claro que no sustituye a un profesional — nunca diagnostica ni trata.
//
// El cliente (lib/data/chat.ts) es quien de verdad guarda el dato — esta
// función solo interpreta y redacta, igual que el resto del motor.
//
// Desplegar con:
//   supabase functions deploy chat-assistant
// (usa el mismo secret ANTHROPIC_API_KEY que analyze-meal / recommendation-explain)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a health/fitness coach chat assistant inside an app, speaking Spanish.

You receive: the user's message, a short summary of their current goal + progress, and a list of plain facts already computed by a deterministic engine (their current plan). You never invent numbers or facts that are not given to you.

Your job: decide what kind of message this is, and reply with ONLY JSON, no markdown, in this exact shape:
{"intent":"log_weight"|"log_meal"|"log_workout"|"answer","weightKg":number|null,"mealText":string|null,"reply":string}

Rules for classification:
- "log_weight": the user is reporting their current body weight with a clear number (e.g. "pesé 80kg hoy", "hoy 79.5"). Extract it into weightKg. Set reply to a short, warm confirmation (max 1 sentence).
- "log_meal": the user is describing something they ate (e.g. "comí una ensalada con pollo"). Put their raw description into mealText, unedited. Set reply to a short confirmation that you're logging it (max 1 sentence) — do not estimate calories yourself, another step does that.
- "log_workout": the user says they trained or did a workout (e.g. "hoy entrené piernas"). There is no way to save workout detail from chat yet — set reply to a short, honest message saying that logging workouts from chat isn't available yet and to use the Training screen, in a friendly tone. weightKg and mealText null.
- "answer": anything else — questions, general conversation, unclear/ambiguous data (e.g. a bare number with no context). Answer using ONLY the facts given to you. If you don't have enough information to answer, say so honestly instead of guessing.
- If the message is ambiguous between logging and asking, prefer "answer" and ask a short clarifying question instead of guessing.

Medical caution: if the topic touches a medical condition (diagnosis, medication, symptoms, chronic disease), be conservative in any suggestion, and clearly say this doesn't replace a healthcare professional — never diagnose or prescribe treatment.

Keep "reply" short (max ~400 characters), natural, no markdown, no bullet points, no exclamation-mark spam.`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();
    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ message, context: context ?? {} }) }],
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
    const raw = (data.content[0].text as string).replace(/```json|```/g, '').trim();
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
