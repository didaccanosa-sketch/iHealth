import { Tabs } from 'expo-router';

// Pantalla única: la barra de pestañas se oculta y solo "index" es el
// camino principal (ver docs/SIMPLIFIED_VISION.md). Las pantallas antiguas
// (nutrition, training, progress) se quedan como rutas válidas por si algo
// necesita enlazar a ellas puntualmente, pero ya no aparecen en la
// navegación principal.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}
