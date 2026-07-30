export type CardioSession = {
  id: string;
  description: string;
  activity_type: string | null;
  duration_min: number | null;
  distance_km: number | null;
  kcal: number;
  avg_heart_rate: number | null;
  logged_at: string;
};

export function totalKcal(sessions: CardioSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.kcal || 0), 0);
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // lunes como inicio de semana
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Barras para la vista "Week": una por día, últimos 7 días (hoy incluido)
export function weeklyBars(sessions: CardioSession[]): { label: string; kcal: number }[] {
  const dayLetters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const bars: { label: string; kcal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const kcal = sessions.filter((s) => s.logged_at === key).reduce((sum, s) => sum + (s.kcal || 0), 0);
    const li = d.getDay() === 0 ? 6 : d.getDay() - 1;
    bars.push({ label: dayLetters[li], kcal });
  }
  return bars;
}

// Barras para la vista "Month": una por semana, últimas 4-5 semanas
export function monthlyBars(sessions: CardioSession[]): { label: string; kcal: number }[] {
  const bars: { label: string; kcal: number }[] = [];
  const today = new Date();
  const currentWeekStart = startOfWeek(today);
  for (let i = 4; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const kcal = sessions
      .filter((s) => {
        const d = new Date(s.logged_at);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, s) => sum + (s.kcal || 0), 0);
    bars.push({ label: `S${5 - i}`, kcal });
  }
  return bars;
}

export function sessionsThisWeek(sessions: CardioSession[]): CardioSession[] {
  const start = startOfWeek(new Date());
  return sessions.filter((s) => new Date(s.logged_at) >= start);
}
