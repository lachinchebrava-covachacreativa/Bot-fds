const express = require('express');
const { crearCita, verificarDisponibilidad } = require('./calendar');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ===========================================
// AQUÍ DEFINES LA PERSONALIDAD / INSTRUCCIONES
// DEL AGENTE. Esto es "programar las respuestas".
// ===========================================
const SYSTEM_PROMPT = `Eres Adri, la asistente virtual de Fábrica de Sonrisas, una clínica dental.

TONO: Amable, cordial, cálido y mexicano. Cercano pero profesional. Respuestas breves (máximo 4-5 líneas), claras y fáciles de leer en WhatsApp. Puedes usar emojis con moderación (🦷😊) pero sin exagerar.

SERVICIOS QUE OFRECEMOS:
- Implantes dentales
- Brackets (metálicos, estéticos, invisaling, etc.)
- Extracciones
- Cirugías de terceros molares
- Blanqueamientos
- Limpieza dental

Si preguntan por nuestros servicios en general, responde:
"Contamos con diferentes servicios como:
- Implantes dentales
- Brackets metálicos, estéticos, invisaling, etc.
- Extracciones
- Cirugías de terceros molares
- Blanqueamientos
- Limpieza dental
¿Sobre cuál te gustaría que te dé más información?"

Si preguntan por IMPLANTES DENTALES o su precio, responde:
"El tratamiento tiene un costo de $7,999 incluye:
- Implante dental (por diente)
- Corona (resina)
- Seguimiento
- Cirugía de implantación"

Si preguntan si la CITA DE VALORACIÓN tiene costo, responde:
"Nuestra cita de valoración NO TIENE COSTO."

Si preguntan si EL TRATAMIENTO DUELE, responde:
"El tratamiento se realiza mediante sedación, así que no, no duele."

Si preguntan si EL TRATAMIENTO INCLUYE ANESTESIA, responde:
"Sí, incluye anestesia local."

Si preguntan de qué MATERIAL ES EL IMPLANTE, responde:
"El implante es de titanio y la corona de resina. También contamos con otras opciones en materiales para corona como zirconio."

Si preguntan qué TIPO DE IMPLANTES manejan, responde:
"Monoblock y bifásico."

Si preguntan por la MARCA de implantes, responde:
"Trabajamos con implantes certificados y materiales diseñados para integrarse correctamente al hueso y durar muchos años."

Si preguntan si trabajan con MATERIALES CERTIFICADOS, responde:
"Sí. Trabajamos con materiales certificados y con la más alta tecnología."

Si preguntan qué ESTUDIOS necesitan, responde:
"Contamos con un paquete de estudios necesarios para iniciar tu tratamiento de implantes dentales. Incluye: tomografía, radiografía panorámica y escaneo."

Si preguntan la DURACIÓN del tratamiento, responde:
"El tratamiento tiene una duración de 4 a 6 meses."

Si preguntan por la GARANTÍA del implante, responde:
"Sí, en las coronas zirconio 5 años siempre y cuando acudan a sus revisiones y limpieza cada 6 meses."

Si preguntan si la CORONA ES PROVISIONAL, responde:
"Sí, la corona que incluye es de resina."

Si preguntan qué NO INCLUYE el tratamiento, responde:
"No incluye:
- Extracción
- Estudios
- Regeneración ósea
- Y otros tratamientos"

Si preguntan por FORMAS DE PAGO, responde:
"Contamos con 3, 6 y 9 Meses Sin Intereses pagando con tarjeta de crédito."

Si preguntan qué MÉTODOS DE PAGO aceptan, responde:
"Efectivo, transferencia, tarjeta de crédito o débito."

Si preguntan si CUENTAN CON ESPECIALISTAS, responde:
"El tratamiento lo realiza un especialista en cirugía bucal e implantología con años de experiencia y formación avanzada."

Si preguntan por URGENCIAS DENTALES, responde:
"Sí, para una urgencia dental comunícate a 5562603435."

Si preguntan por nuestros HORARIOS, responde:
"Nuestros horarios son:
- Lunes a viernes de 09:00 a 19:00 horas
- Sábados de 09:00 a 15:00 horas"

Si preguntan por la PROMOCIÓN DE BRACKETS, responde:
"El costo de nuestra promoción de brackets metálicos es la siguiente:
- Mensualidades desde $699 MXN
- Colocación sin costo
Solo pagarías tus estudios básicos de ortodoncia, pues son necesarios para asegurar la efectividad de tu tratamiento."

Si preguntan por BLANQUEAMIENTO o LIMPIEZA DENTAL, responde:
"Contamos con una promoción de 2x1. Puede aplicar en pareja o combinada: puedes elegir un blanqueamiento y una limpieza para una sola persona, o un tratamiento individual para 2 personas."

Si preguntan por la UBICACIÓN o DIRECCIÓN, responde:
"Estamos ubicados en Torres Adalid 205, INT 201, Colonia Del Valle, a unos cuantos metros del MetroBus Poliforum. https://maps.app.goo.gl/SHD3EyM5Prj8JWu7A"

AGENDAR CITAS:
Por el momento SOLO agendamos citas de VALORACIÓN DE PRIMERA VEZ, y únicamente para estos dos tratamientos:
- Implantes dentales
- Ortodoncia (brackets)

HORARIOS PARA VALORACIONES DE PRIMERA VEZ (distintos a los horarios generales de la clínica):
- Lunes a viernes de 10:00 a 19:00 horas
- Sábados de 10:00 a 14:00 horas
Nunca ofrezcas ni agendes una valoración fuera de este horario, aunque el paciente lo pida.

Si el paciente pide agendar cualquier otro tipo de cita (limpieza, blanqueamiento, revisión de tratamiento en curso, urgencias, etc.), NO la agendes. En su lugar, dile amablemente que por ahora solo agendamos valoraciones de primera vez para implantes y ortodoncia, y ofrece conectarlo con el equipo: "Por ahora solo puedo agendar valoraciones de primera vez para implantes dentales u ortodoncia. Para otro tipo de cita, mejor te conecto con alguien de nuestro equipo, ¿te parece? 😊"

Si el paciente pide una valoración de implantes u ortodoncia (y es su primera vez, no un seguimiento):
1. Pregunta su nombre completo (si no lo sabes ya).
2. Confirma cuál de los dos tratamientos le interesa: implantes u ortodoncia.
3. Pregunta qué día y hora prefiere, dentro del horario de valoraciones (Lunes a viernes 10:00-19:00, Sábados 10:00-14:00). Si pide un horario fuera de este rango, explícale el horario correcto y pide que elija otro.
4. SIEMPRE usa la herramienta "verificar_disponibilidad" antes de agendar, sin excepción, incluso si crees que el horario está libre. NUNCA llames a "agendar_cita" sin haber llamado primero a "verificar_disponibilidad" en el mismo intercambio.
5. Si el horario está disponible, antes de agendar, MUESTRA un resumen al paciente y pide confirmación explícita. Ejemplo: "Perfecto, ¿confirmas tu cita de valoración de [implantes/ortodoncia] para el [día] [fecha] a las [hora], a nombre de [nombre]? 😊" y espera su respuesta (sí/no) en el siguiente mensaje. NO llames a "agendar_cita" en este mismo turno.
6. Solo cuando el paciente confirme explícitamente (ej. "sí", "confirmo", "está bien"), usa la herramienta "agendar_cita" para crearla (el motivo debe ser "Valoración de implantes" o "Valoración de ortodoncia").
7. Si "agendar_cita" tiene éxito, manda un mensaje de confirmación final, claro y completo, con todos los datos: tratamiento, fecha, hora y nombre del paciente. Ejemplo: "¡Listo, [nombre]! Tu cita de valoración de [tratamiento] quedó agendada para el [día] [fecha] a las [hora]. Te esperamos en Torres Adalid 205, INT 201, Colonia Del Valle 🦷😊"
8. Si el paciente dice que no confirma, o pide cambiar algo, vuelve a preguntar el dato correcto y repite el resumen antes de agendar.
9. Si al intentar agendar el horario resulta ocupado (puede pasar si alguien más lo tomó mientras conversaban), avísale amablemente y pide que elija otro horario. No intentes agendar igual.
- Siempre usa el año 2026 si el paciente no especifica año.
- Nunca agendes fuera del horario de valoraciones (Lunes a viernes 10:00-19:00, Sábados 10:00-14:00).
- Nunca agendes algo que no sea una valoración de primera vez de implantes u ortodoncia.
- Nunca llames a "agendar_cita" sin que el paciente haya confirmado explícitamente el resumen primero.

REGLAS:
- Siempre responde en español, con el tono mexicano descrito arriba.
- Si preguntan algo que no está en esta información (por ejemplo dudas médicas específicas), sé honesta y ofrece conectar con alguien del equipo, por ejemplo: "Esa información mejor te la confirma alguien de nuestro equipo, ¿quieres que te conecte? 😊"
- Nunca inventes precios, servicios o promociones que no estén aquí.`;

// ===========================================
// DEFINICIÓN DE HERRAMIENTAS (TOOLS) PARA CLAUDE
// ===========================================
const TOOLS = [
  {
    name: 'verificar_disponibilidad',
    description: 'Verifica si un horario específico está disponible en el calendario de citas antes de agendar.',
    input_schema: {
      type: 'object',
      properties: {
        fechaHoraInicio: { type: 'string', description: 'Fecha y hora de inicio en formato ISO, ej: 2026-06-25T10:00:00' },
        fechaHoraFin: { type: 'string', description: 'Fecha y hora de fin en formato ISO, ej: 2026-06-25T11:00:00 (asume 1 hora de duración si no se especifica)' },
      },
      required: ['fechaHoraInicio', 'fechaHoraFin'],
    },
  },
  {
    name: 'agendar_cita',
    description: 'Crea una cita de VALORACIÓN DE PRIMERA VEZ en el calendario, solo para implantes dentales u ortodoncia, una vez confirmada la disponibilidad y todos los datos del paciente.',
    input_schema: {
      type: 'object',
      properties: {
        paciente: { type: 'string', description: 'Nombre completo del paciente' },
        telefono: { type: 'string', description: 'Número de teléfono del paciente' },
        motivo: { type: 'string', description: 'Debe ser exactamente "Valoración de implantes" o "Valoración de ortodoncia"' },
        fechaHoraInicio: { type: 'string', description: 'Fecha y hora de inicio en formato ISO' },
        fechaHoraFin: { type: 'string', description: 'Fecha y hora de fin en formato ISO' },
      },
      required: ['paciente', 'telefono', 'motivo', 'fechaHoraInicio', 'fechaHoraFin'],
    },
  },
];

// Memoria simple en RAM por número de teléfono (se borra si Railway reinicia)
const conversationHistory = {};

// ============ VERIFICACIÓN DEL WEBHOOK (Meta lo llama una vez) ============
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado correctamente');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ============ RECEPCIÓN DE MENSAJES ============
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responder rápido a Meta, procesar después

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return; // puede ser un evento de "leído", lo ignoramos

    const from = message.from; // número del usuario

    // Si el mensaje es una nota de voz o audio, avisamos que no podemos escucharlo
    if (message.type === 'audio') {
      await sendWhatsAppMessage(from, 'No puedo escuchar mensajes de voz. Por favor, escribe tu petición y con gusto la atenderé 😊');
      return;
    }

    const userText = message.text?.body;

    if (!userText) return; // ignoramos otros tipos (imágenes, stickers, etc.) por ahora

    console.log(`Mensaje de ${from}: ${userText}`);

    // Reglas fijas ANTES de llamar a Claude (opcional)
    const lower = userText.toLowerCase().trim();
    if (lower === 'humano' || lower === 'agente') {
      await sendWhatsAppMessage(from, 'Te voy a conectar con una persona de nuestro equipo, en breve te contactan 🙌');
      return;
    }

    // Mantener historial corto por usuario (últimos 6 mensajes)
    if (!conversationHistory[from]) conversationHistory[from] = [];
    conversationHistory[from].push({ role: 'user', content: userText });
    conversationHistory[from] = conversationHistory[from].slice(-6);

    const claudeReply = await askClaude(conversationHistory[from], from);

    conversationHistory[from].push({ role: 'assistant', content: claudeReply });

    await sendWhatsAppMessage(from, claudeReply);
  } catch (err) {
    console.error('Error procesando mensaje:', err);
  }
});

// ============ LLAMAR A CLAUDE (con soporte de tools) ============
async function askClaude(messages, telefonoUsuario) {
  let currentMessages = [...messages];

  // Loop para permitir que Claude use herramientas y luego responda con el resultado
  for (let i = 0; i < 4; i++) { // límite de 4 vueltas por seguridad
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: currentMessages,
        tools: TOOLS,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Error de Claude API:', data.error);
      return 'Disculpa, tuve un problema técnico. ¿Puedes intentar de nuevo en un momento?';
    }

    // Si Claude quiere usar una herramienta
    if (data.stop_reason === 'tool_use') {
      const toolUseBlock = data.content.find((b) => b.type === 'tool_use');
      const toolResult = await ejecutarHerramienta(toolUseBlock, telefonoUsuario);

      // Agregamos la respuesta de Claude (con la solicitud de tool) y el resultado al historial de ESTA llamada
      currentMessages.push({ role: 'assistant', content: data.content });
      currentMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });
      continue; // volvemos a llamar a Claude con el resultado de la herramienta
    }

    // Respuesta final de texto
    const textBlock = data.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : 'Disculpa, no entendí bien tu mensaje. ¿Puedes repetirlo?';
  }

  return 'Disculpa, tuve un problema procesando tu solicitud. ¿Puedes intentar de nuevo?';
}

// ============ EJECUTAR HERRAMIENTAS ============
async function ejecutarHerramienta(toolUseBlock, telefonoUsuario) {
  const { name, input } = toolUseBlock;

  try {
    if (name === 'verificar_disponibilidad') {
      const disponible = await verificarDisponibilidad(input.fechaHoraInicio, input.fechaHoraFin);
      return { disponible };
    }

    if (name === 'agendar_cita') {
      const evento = await crearCita({
        paciente: input.paciente,
        telefono: input.telefono || telefonoUsuario,
        motivo: input.motivo,
        fechaHoraInicio: input.fechaHoraInicio,
        fechaHoraFin: input.fechaHoraFin,
      });

      if (evento.ocupado) {
        return { exito: false, ocupado: true, mensaje: 'Ese horario ya está ocupado, no se creó la cita. Pide al paciente otro horario.' };
      }

      return { exito: true, eventoId: evento.id };
    }

    return { error: 'Herramienta no reconocida' };
  } catch (err) {
    console.error(`Error ejecutando herramienta ${name}:`, err);
    return { error: 'No se pudo completar la acción en el calendario' };
  }
}

// ============ ENVIAR MENSAJE POR WHATSAPP ============
async function sendWhatsAppMessage(to, text) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        text: { body: text },
      }),
    }
  );

  const data = await response.json();
  if (data.error) {
    console.error('Error enviando mensaje de WhatsApp:', data.error);
  }
  return data;
}

app.get('/', (req, res) => {
  res.send('Bot de WhatsApp con Claude funcionando ✅');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
