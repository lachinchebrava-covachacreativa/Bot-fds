const { createSign } = require('crypto');

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8')
);

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

function agregarZonaHoraria(fechaISO) {
  if (fechaISO.includes('+') || fechaISO.includes('Z') || /[+-]\d{2}:\d{2}$/.test(fechaISO)) {
    return fechaISO;
  }
  return fechaISO + '-06:00';
}

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
  return data.items.length === 0;
}

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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(evento),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

module.exports = { crearCita, verificarDisponibilidad };
