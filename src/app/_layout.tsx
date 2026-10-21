import { useState, type ComponentProps } from 'react';
import { Platform, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { migrar } from '../db/schema';
import { colores, estilos } from '../ui/componentes';
import { SincronizacionAutomatica } from '../sync/automatica';
import { Bloqueo } from '../ui/Bloqueo';
import '../ui/alertas';

// La app abre en Sesiones aunque «Nueva cita» sea la primera pestaña.
export const unstable_settings = { initialRouteName: 'index' };

const icono = (nombre: ComponentProps<typeof Ionicons>['name']) => ({ tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={nombre} color={color as string} size={size} /> });

export default function RootLayout() {
  // En el móvil caben las siete pestañas con la letra más pequeña y dos nombres más cortos.
  const movil = useWindowDimensions().width < 600;
  const [errorBd, setErrorBd] = useState<string | null>(null);
  if (errorBd) {
    // En la web, la base de datos solo puede estar abierta en una pestaña a la vez.
    const otraPestana = Platform.OS === 'web' && /Access Handle/i.test(errorBd);
    return (
      <View style={[estilos.pantalla, { justifyContent: 'center', padding: 24, gap: 12 }]}>
        <Text style={[estilos.nombre, { fontSize: 20 }]}>{otraPestana ? 'Consulta ya está abierta' : 'No se pudieron abrir los datos'}</Text>
        <Text style={estilos.meta}>{otraPestana ? 'Ciérrala en la otra pestaña o ventana y vuelve a cargar esta página.' : errorBd}</Text>
      </View>
    );
  }
  return (
    <SQLiteProvider databaseName="consulta.db" onInit={migrar} onError={e => setErrorBd(e.message)}>
      <SincronizacionAutomatica />
      <Bloqueo>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colores.acento,
          headerStyle: { backgroundColor: colores.superficie },
          headerTintColor: colores.tinta,
          tabBarLabelStyle: movil ? { fontSize: 10, letterSpacing: -0.2 } : undefined,
        }}
      >
        <Tabs.Screen name="nueva-cita" options={{ title: 'Nueva cita', tabBarLabel: movil ? 'Nueva' : undefined, ...icono('add-circle-outline') }} />
        <Tabs.Screen name="index" options={{ title: 'Sesiones', ...icono('list-outline') }} />
        <Tabs.Screen name="calendario" options={{ title: 'Calendario', tabBarLabel: movil ? 'Agenda' : undefined, ...icono('calendar-outline') }} />
        <Tabs.Screen name="pacientes" options={{ title: 'Pacientes', ...icono('people-outline') }} />
        <Tabs.Screen name="pagos" options={{ title: 'Pagos', ...icono('wallet-outline') }} />
        <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', ...icono('settings-outline') }} />
        <Tabs.Screen name="resumen" options={{ title: 'Resumen', ...icono('stats-chart-outline') }} />
      </Tabs>
      </Bloqueo>
    </SQLiteProvider>
  );
}
