import { SQLiteProvider } from 'expo-sqlite';
import { Tabs } from 'expo-router/js-tabs';
import { migrar } from '../db/schema';
import { colores } from '../ui/componentes';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="consulta.db" onInit={migrar}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colores.acento,
          headerStyle: { backgroundColor: colores.superficie },
          headerTintColor: colores.tinta,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Sesiones' }} />
        <Tabs.Screen name="sin-cobrar" options={{ title: 'Sin cobrar' }} />
        <Tabs.Screen name="pacientes" options={{ title: 'Pacientes' }} />
        <Tabs.Screen name="facturas" options={{ title: 'Facturas' }} />
        <Tabs.Screen name="trimestre" options={{ title: 'Trimestre' }} />
        <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
        <Tabs.Screen name="nueva-cita" options={{ title: 'Nueva cita', href: null }} />
      </Tabs>
    </SQLiteProvider>
  );
}
