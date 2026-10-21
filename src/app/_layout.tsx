import { SQLiteProvider } from 'expo-sqlite';
import { Tabs } from 'expo-router/js-tabs';
import { migrar } from '../db/schema';
import { colores } from '../ui/componentes';
import { SincronizacionAutomatica } from '../sync/automatica';
import { Bloqueo } from '../ui/Bloqueo';

// La app abre en Sesiones aunque «Nueva cita» sea la primera pestaña.
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="consulta.db" onInit={migrar}>
      <SincronizacionAutomatica />
      <Bloqueo>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colores.acento,
          headerStyle: { backgroundColor: colores.superficie },
          headerTintColor: colores.tinta,
        }}
      >
        <Tabs.Screen name="nueva-cita" options={{ title: 'Nueva cita' }} />
        <Tabs.Screen name="index" options={{ title: 'Sesiones' }} />
        <Tabs.Screen name="calendario" options={{ title: 'Calendario' }} />
        <Tabs.Screen name="pacientes" options={{ title: 'Pacientes' }} />
        <Tabs.Screen name="pagos" options={{ title: 'Pagos' }} />
        <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
        <Tabs.Screen name="resumen" options={{ title: 'Resumen' }} />
      </Tabs>
      </Bloqueo>
    </SQLiteProvider>
  );
}
