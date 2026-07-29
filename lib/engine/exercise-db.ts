import { MuscleGroup } from './types';

export const EXERCISE_DB: Record<MuscleGroup, string[]> = {
  pecho: [
    'Bench press', 'Dumbbell bench press', 'Incline barbell press', 'Incline dumbbell press',
    'Decline press', 'Dumbbell flyes', 'Cable crossover', 'Machine chest press', 'Dips',
    'Pec deck', 'Push-ups', 'Weighted push-ups', 'Pullover', 'Close-grip bench press',
    'Svend press', 'Single-arm dumbbell press', 'Floor press', 'Landmine press',
  ],
  espalda: [
    'Pull-ups', 'Chin-ups', 'Weighted pull-ups', 'Lat pulldown', 'Close-grip pulldown',
    'Barbell row', 'Dumbbell row', 'Machine row', 'Low cable row', 'T-bar row', 'Face pull',
    'Pendlay row', 'Australian pull-up', 'Inverted row', 'Cable pullover', 'Straight-arm pulldown',
    'Barbell shrug', 'Meadows row',
  ],
  lumbar: [
    'Conventional deadlift', 'Romanian deadlift', 'Sumo deadlift', 'Stiff-leg deadlift',
    'Hyperextensions', 'Weighted hyperextensions', 'Good morning', 'Superman',
    'Machine back extension', 'Trap bar deadlift', 'Deficit deadlift', 'Kettlebell swing',
  ],
  core: [
    'Plank', 'Side plank', 'Weighted plank', 'Crunch', 'Cable crunch', 'Reverse crunch',
    'Leg raise', 'Hanging leg raise', 'Ab wheel rollout', 'Dead bug', 'Pallof press',
    'Russian twist', 'Mountain climbers', 'Hollow body hold', 'Sit-up', 'V-ups',
    'Bicycle crunch', 'Toes to bar',
  ],
  hombro: [
    'Barbell overhead press', 'Dumbbell shoulder press', 'Arnold press', 'Behind-the-neck press',
    'Lateral raise', 'Cable lateral raise', 'Front raise', 'Plate front raise', 'Reverse flyes',
    'Cable reverse flyes', 'Face pull', 'Upright row', 'Y-raise', 'Cuban press',
  ],
  biceps: [
    'Barbell curl', 'Dumbbell curl', 'Hammer curl', 'Cable curl', 'Concentration curl',
    'Preacher curl', 'Cable Bayesian curl', '21s curl', 'Incline curl', 'EZ-bar curl',
    'Spider curl', 'Reverse curl', 'Drag curl',
  ],
  triceps: [
    'Rope pushdown', 'Straight-bar pushdown', 'Skull crushers', 'Overhead dumbbell extension',
    'Overhead cable extension', 'Bench dips', 'Dips', 'Close-grip bench press', 'Tricep kickback',
    'Single-arm cable extension', 'JM press', 'Diamond push-up',
  ],
  cuadriceps: [
    'Back squat', 'Front squat', 'Hack squat', 'Bulgarian split squat', 'Goblet squat',
    'Sumo squat', 'Leg press', 'Single-leg press', 'Lunges', 'Walking lunges', 'Reverse lunges',
    'Leg extension', 'Step-up', 'Sissy squat', 'Zercher squat', 'Pause squat', 'Wall sit',
  ],
  isquios: [
    'Lying leg curl', 'Seated leg curl', 'Standing leg curl', 'Romanian deadlift',
    'Stiff-leg deadlift', 'Nordic curl', 'Good morning', 'Glute-ham raise',
    'Single-leg Romanian deadlift',
  ],
  gluteo: [
    'Hip thrust', 'Barbell hip thrust', 'Glute bridge', 'Single-leg glute bridge',
    'Cable glute kickback', 'Bulgarian split squat', 'Hip abduction', 'Sumo deadlift',
    'Weighted step-up', 'Frog pump', 'Cable pull-through',
  ],
  aductores: ['Adductor machine', 'Sumo squat', 'Copenhagen plank', 'Cable adduction', 'Side lunge', 'Cossack squat'],
  abductores: ['Abductor machine', 'Standing leg raise', 'Monster walk (band)', 'Cable hip abduction', 'Clamshell with band', 'Fire hydrant'],
  gemelos: ['Standing calf raise', 'Seated calf raise', 'Leg press calf raise', 'Single-leg calf raise', 'Smith machine calf raise'],
};
