const { createSign } = require('crypto');
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// Leer credenciales desde Base64
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8')
);

// Genera un JWT firmado manualmente para autenticarse con Google
function generarJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${header}.${payload}.${signature}`;
}

// Obtiene un access token de Google usando el JWT
async function obtenerAccessToken() {
  const jwt = generarJWT();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener access token: ' + JSON.stringify(data));
  return data.access_token;
}

// Convierte fecha ISO sin zona horaria a formato con offset de Ciudad de México (-06:00)
function agregarZonaHoraria(fechaISO) {
  if (fechaISO.includes('+') || fechaISO.includes('Z') || /[+-]\d{2}:\d{2}$/.test(fechaISO)) {
    return fechaISO;
  }
  return fechaISO + '-06:00';
}

// Revisa si hay algo agendado en ese rango
async function verificarDisponibilidad(fechaHoraInicio, fechaHoraFin) {
  const token = await obtenerAccessToken();
  const params = new URLSearchParams({
    timeMin: agregarZonaHoraria(fechaHoraInicio),
    timeMax: agregarZonaHoraria(fechaHoraFin),
    singleEvents: 'true',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.items.length === 0; // true = disponible
}

// Crea una cita con verificación interna de disponibilidad
async function crearCita({ paciente, telefono, motivo, fechaHoraInicio, fechaHoraFin }) {
  const libre = await verificarDisponibilidad(fechaHoraInicio, fechaHoraFin);
  if (!libre) return { ocupado: true };

  const token = await obtenerAccessToken();
  const evento = {
    summary: `Cita: ${paciente}`,
    description: `Motivo: ${motivo}\nTeléfono: ${telefono}`,
    start: { dateTime: agregarZonaHoraria(fechaHoraInicio), timeZone: 'America/Mexico_City' },
    end: { dateTime: agregarZonaHoraria(fechaHoraFin), timeZone: 'America/Mexico_City' },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evento),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

module.exports = { crearCita, verificarDisponibilidad };


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
      dateTime: fechaHoraInicio,
      timeZone: 'America/Mexico_City',
    },
    end: {
      dateTime: fechaHoraFin,
      timeZone: 'America/Mexico_City',
    },
  };

  const respuesta = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    resource: evento,
  });

  return respuesta.data;
}

// Convierte fecha ISO sin zona horaria a formato con offset de Ciudad de México (-06:00)
function agregarZonaHoraria(fechaISO) {
  if (fechaISO.includes('+') || fechaISO.includes('Z') || /\d{2}:\d{2}$/.test(fechaISO.slice(-6))) {
    return fechaISO; // ya tiene zona horaria
  }
  return fechaISO + '-06:00';
}

// Revisa si hay algo agendado en ese rango (para validar disponibilidad)
async function verificarDisponibilidad(fechaHoraInicio, fechaHoraFin) {
  const respuesta = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin: agregarZonaHoraria(fechaHoraInicio),
    timeMax: agregarZonaHoraria(fechaHoraFin),
    singleEvents: true,
  });

  return respuesta.data.items.length === 0; // true = disponible
}

module.exports = { crearCita, verificarDisponibilidad };
