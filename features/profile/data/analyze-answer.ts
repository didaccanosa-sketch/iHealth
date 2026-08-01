// Llama a la Edge Function que normaliza una respuesta de texto libre del
// Question Engine (ver supabase/functions/analyze-profile-answer). Solo se
// usa para preguntas answerType 'text' (lesiones, alergias...) — las de
// opción fija no lo necesitan.
import { supabase } from '../../../lib/supabase';

export async function analyzeFreeTextAnswer(text: string, questionText: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('analyze-profile-answer', {
    body: { text, question: questionText },
  });
  if (error) throw error;
  if (!data?.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('Empty response from analyze-profile-answer');
  }
  return data.items as string[];
}
