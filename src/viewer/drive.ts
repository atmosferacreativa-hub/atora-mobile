/**
 * Reproductor de Google Drive dentro de la app (WebView). Módulo puro, para Jest.
 *
 * 1.0.1: hasta la 1.0.0 solo se permitían google.com, googleusercontent.com,
 * gstatic.com y googlevideo.com. El reproductor de Drive carga ahora el video en
 * un iframe de youtube.googleapis.com, y en Android react-native-webview aplica
 * onShouldStartLoadWithRequest también a los iframes: el video quedaba en
 * blanco y solo servía "Abrir en el navegador". Se agregan los dominios de
 * Google que usa el reproductor; todo lo demás sigue bloqueado (y se registra).
 */
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com|gstatic\.com|googlevideo\.com|googleapis\.com|youtube\.com|youtube-nocookie\.com|ytimg\.com)(:\d+)?(\/|$|\?)/i;

export function allowDriveNavigation(url: string): boolean {
  return url === 'about:blank' || ALLOWED.test(url);
}
