import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const calendar = google.calendar("v3");

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/calendar"]
);

const calendarId = process.env.GOOGLE_CALENDAR_ID;
const timeZone = process.env.TIMEZONE || "America/New_York";

export async function listAvailableSlots(date, durationMinutes) {
  // Aqui você implementa sua lógica de buscar slots livres em 'date'
  // Exemplo MUITO simplificado:
  // - Buscar eventos existentes
  // - Criar uma lista de horários possíveis
  // - Retirar os que conflitam
  // Retornar algo como ["10:00", "11:30", "14:15"]

  // Placeholder:
  return ["10:00", "11:30", "14:15", "16:00"];
}

export async function createBooking({
  service,
  professional,
  date,
  time,
  clientName
}) {
  const [hour, minute] = time.split(":").map(Number);
  const startDateTime = new Date(date);
  startDateTime.setHours(hour, minute, 0);

  // Aqui você pode customizar a duração por serviço
  const durationMinutes = 45;
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

  await auth.authorize();

  const event = {
    summary: `${service} - ${professional} - ${clientName}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone
    },
    description: `Agendamento via chatbot WhatsApp. Cliente: ${clientName}`
  };

  const res = await calendar.events.insert({
    auth,
    calendarId,
    resource: event
  });

  return res.data;
}
