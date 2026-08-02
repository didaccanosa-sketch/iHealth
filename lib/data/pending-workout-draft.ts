import { NewMesoInput } from './workout';

// Traspaso en memoria de la propuesta de rutina generada por el chat
// (pantalla única) hacia el wizard de Training, para que el usuario pueda
// revisar y editar ejercicios/sets/reps antes de crearla — nunca se crea
// directo desde el chat. No hace falta persistirlo entre reinicios de la
// app: si se pierde, el usuario simplemente vuelve a pedir la rutina.
let pendingDraft: NewMesoInput | null = null;

export function setPendingWorkoutDraft(input: NewMesoInput): void {
  pendingDraft = input;
}

// Se consume una sola vez — evita que un refresco o volver atrás a la
// pantalla de Training reabra el wizard con datos ya viejos.
export function consumePendingWorkoutDraft(): NewMesoInput | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}
