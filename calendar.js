const { google } = require('googleapis');

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const auth = new google.auth.JWT(
  GOOGLE_CLIENT_EMAIL,
  null,
  GOOGLE_PRIVATE_KEY,
  ['https://www.googleapis.com/auth/calendar']
);

const calendar = google.calendar({ version: 'v3', auth });

// Crea una cita. fechaHoraInicio y fechaHoraFin en formato ISO, ej: "2026-06-25T10:00:00"
// Verifica disponibilidad internamente antes de crear, para nunca duplicar citas
// aunque el agente no haya llamado a verificarDisponibilidad antes.
async function crearCita({ paciente, telefono, motivo, fechaHoraInicio, fechaHoraFin }) {
  const libre = await verificarDisponibilidad(fechaHoraInicio, fechaHoraFin);

  if (!libre) {
    return { ocupado: true };
  }

  const evento = {
    summary: `Cita: ${paciente}`,
    description: `Motivo: ${motivo}\nTeléfono: ${telefono}`,
    start: {
      dateTime:
