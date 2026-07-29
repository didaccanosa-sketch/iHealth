# iHealth

Interfaz + motor de recomendaciones, construidos siguiendo la arquitectura del
documento de producto: la interfaz nunca decide nada, solo pinta lo que
`lib/engine/` calcula. Los datos viven en Supabase.

## Qué hay ya construido

- **Login/registro** (email + contraseña) — sin esto ninguna pantalla puede
  leer ni guardar datos, porque las tablas de Supabase exigen un usuario
  autenticado (Row Level Security)
- **Nutrition** de verdad: Meal 1 / Meal 2 / Meal 3..., barras de progreso de
  calorías/proteína/carbos/grasas/fibra, añadir comida por chat con IA,
  editar, eliminar, duplicar y guardar como plantilla
- **Training** y **Progress**: siguen siendo placeholders, van en el siguiente
  paso
- **Today**: placeholder, se construye al final porque junta datos de las
  demás piezas

## Pasos para arrancarlo (una sola vez)

### 1. Instalar dependencias

```
npm install --legacy-peer-deps
```

### 2. Crear las tablas en Supabase

1. Ve a tu proyecto en supabase.com → **SQL Editor**
2. Copia todo el contenido de `supabase/schema.sql` de esta carpeta y pégalo ahí
3. **Run**

(Si ya habías ejecutado una versión anterior de este archivo, puedes volver a
pegar y ejecutar el archivo entero sin problema — usa `create table if not
exists`, no borra nada que ya tuvieras.)

### 3. Configurar tus claves

Copia `.env.example` a `.env` y rellena con tu Project URL y anon key
(Supabase → Project Settings → API).

### 4. Desactivar la confirmación de email (solo para pruebas rápidas)

Por defecto, Supabase exige confirmar el email antes de poder iniciar sesión.
Para ir más rápido mientras probamos:

1. Supabase → **Authentication → Sign In / Providers → Email**
2. Desactiva **"Confirm email"**
3. Guarda

(Cuando esto sea una app de verdad para más gente, esto se vuelve a activar.)

### 5. Arrancar la app

```
npx expo start
```

Escanea el QR con Expo Go, o pulsa `w` para abrirla en el navegador de tu
ordenador.

Al abrir la app te pedirá **crear una cuenta** (email + contraseña) — es tu
cuenta dentro de la app, no tiene que ver con tu email real de verdad, puedes
usar cualquier email de prueba. Una vez dentro, ya puedes usar Nutrition.

## Desplegar la función de IA (necesario para "Analyze with AI")

El botón de analizar comidas llama a una función que corre en el servidor de
Supabase (nunca expone tu API key de Anthropic al móvil). Para activarla:

1. Instala la CLI de Supabase (una vez):
   ```
   npm install -g supabase
   ```
2. Inicia sesión:
   ```
   supabase login
   ```
3. Vincula esta carpeta a tu proyecto (te pedirá el project ref, que es la
   parte `kyqqwvojcezabgglcuke` de tu Project URL):
   ```
   supabase link --project-ref TU_PROJECT_REF
   ```
4. Configura tu API key de Anthropic como secreto (nunca va en el código):
   ```
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui
   ```
5. Despliega la función:
   ```
   supabase functions deploy analyze-meal
   ```

Hasta que hagas esto, el botón "Analyze with AI" en Nutrition dará error —
es normal, es el único paso que falta.

## Qué es cada carpeta

- `app/` — pantallas (Expo Router)
- `lib/engine/` — el Recommendation Engine: lógica pura, sin Supabase ni UI
- `lib/data/` — todas las llamadas a Supabase, separadas del motor
- `lib/auth-context.tsx` — sesión de usuario
- `lib/theme-context.tsx` — modo claro/oscuro
- `lib/supabase.ts` — cliente de Supabase
- `constants/theme.ts` — colores/tokens del sistema de diseño
- `components/` — piezas reutilizables (Card, Screen, MacroBar, AuthScreen)
- `supabase/schema.sql` — tablas de la base de datos
- `supabase/functions/` — funciones que corren en el servidor de Supabase

