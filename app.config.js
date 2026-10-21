// Añade a app.json lo que depende de credenciales externas.
// GOOGLE_IOS_URL_SCHEME: el «iOS URL scheme» del cliente OAuth de iOS (com.googleusercontent.apps.…),
// necesario para iniciar sesión con Google en iPhone y iPad. En Android no hace falta.
module.exports = ({ config }) => {
  const esquema = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    plugins: [
      ...config.plugins,
      ...(esquema ? [['@react-native-google-signin/google-signin', { iosUrlScheme: esquema }]] : []),
    ],
  };
};
