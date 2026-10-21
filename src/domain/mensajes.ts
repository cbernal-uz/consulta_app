import type { Cita, Paciente, Terapeuta } from './types.ts';
import { fechaCorta, fechaLarga } from './reglas.ts';

// Los avisos nunca incluyen notas ni detalles clínicos: solo fecha, hora y lugar.

export function textoAviso(cita: Cita, paciente: Paciente, terapeuta: Terapeuta): string {
  const nombre = paciente.nombre.split(' ')[0];
  const lugar = cita.modalidad === 'presencial'
    ? `Lugar: ${terapeuta.direccion}`
    : 'Recibirás el enlace de la videollamada el mismo día.';
  return [
    `Hola ${nombre}, te recuerdo tu próxima sesión:`,
    '',
    `${fechaCorta(cita.fecha)} (${fechaLarga(cita.fecha)}) a las ${cita.hora}`,
    `Duración: ${cita.duracionMin} minutos`,
    lugar,
    '',
    'Si no puedes asistir, avísame con al menos 24 horas de antelación; si no, la sesión se cobra.',
    terapeuta.nombre,
  ].join('\n');
}

/** Enlace que abre WhatsApp con el mensaje ya escrito. El envío lo confirma el terapeuta. */
export function enlaceWhatsApp(telefono: string, texto: string): string {
  const digitos = telefono.replace(/\D/g, '');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

export function enlaceEmail(email: string, asunto: string, texto: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
}

export function asuntoAviso(cita: Cita): string {
  return `Tu cita del ${fechaCorta(cita.fecha)} a las ${cita.hora}`;
}

/** Evento de calendario (.ics) en hora de Madrid. */
export function eventoIcs(cita: Cita, terapeuta: Terapeuta, ahora: Date = new Date()): string {
  const [h, m] = cita.hora.split(':').map(Number);
  const inicio = h * 60 + m;
  const fin = inicio + cita.duracionMin;
  const dia = cita.fecha.replace(/-/g, '');
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`;
  const stamp = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Consulta//ES',
    'BEGIN:VEVENT',
    `UID:${cita.id}@consulta`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Madrid:${dia}T${hhmm(inicio)}`,
    `DTEND;TZID=Europe/Madrid:${dia}T${hhmm(fin)}`,
    `SUMMARY:Sesión con ${terapeuta.nombre}`,
    cita.modalidad === 'presencial' ? `LOCATION:${terapeuta.direccion}` : 'LOCATION:Online',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
