import { Alert } from 'react-native';

// En la web, Alert.alert de react-native-web no hace nada: se usan las ventanas del navegador.
Alert.alert = (titulo, mensaje, botones) => {
  const texto = [titulo, mensaje].filter(Boolean).join('\n\n');
  const cancelar = botones?.find(b => b.style === 'cancel');
  const opciones = botones?.filter(b => b !== cancelar) ?? [];
  if (!opciones.length) {
    window.alert(texto);
    return cancelar?.onPress?.();
  }
  // Con varias opciones se pregunta por cada una, de la primera a la última.
  for (const b of opciones) {
    if (window.confirm(opciones.length > 1 ? `${texto}\n\n${b.text}?` : texto)) return b.onPress?.();
  }
  cancelar?.onPress?.();
};
