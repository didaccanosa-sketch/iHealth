import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

// Envuelve un bloque de contenido y lo desvanece hacia adentro cada vez que
// `trigger` cambia (por ejemplo, el nombre de la vista o el paso del wizard).
export function FadeIn({ children, trigger }: { children: React.ReactNode; trigger: unknown }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [trigger]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
