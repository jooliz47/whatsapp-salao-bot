import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import { sendWhatsAppMessage } from "./whatsapp.js";
import { callChatGPT } from "./openai.js";
import { listAvailableSlots, createBooking } from "./calendar.js";
import { getSession, updateSession } from "./state.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Verificação do webhook (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receber mensagens (POST)
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObject = value?.messages?.[0];

    if (!messageObject) {
      return res.sendStatus(200);
    }

    const from = messageObject.from; // telefone do cliente
    const text = messageObject.text?.body || "";

    console.log("Mensagem de", from, ":", text);

    const session = getSession(from);

    // Chama ChatGPT com o histórico + mensagem atual
    const aiResponse = await callChatGPT(session.history, text);

    const { tipo, mensagem_para_cliente, dados_agendamento } = aiResponse;

    // Atualiza histórico (conversa assistente/usuário)
    session.history.push({ role: "user", content: text });
    session.history.push({
      role: "assistant",
      content: JSON.stringify(aiResponse)
    });

    // Decisão pelo tipo
    if (tipo === "RESPOSTA" || tipo === "AGENDAMENTO_COLETAR_DADOS") {
      if (dados_agendamento) {
        session.agendamento_parcial = {
          ...session.agendamento_parcial,
          ...dados_agendamento
        };
      }

      await sendWhatsAppMessage(from, mensagem_para_cliente);
    } else if (tipo === "AGENDAMENTO_CHECAR_HORARIOS") {
      // aqui esperamos que service, professional, date já existam em dados_agendamento
      const { servicos, profissional, data } = dados_agendamento;

      // TODO: decidir duração com base no serviço
      const durationMinutes = 45;

      const slots = await listAvailableSlots(data, durationMinutes);

      if (!slots.length) {
        await sendWhatsAppMessage(
          from,
          "Não encontrei horários disponíveis nesse dia. Você gostaria de tentar outro dia?"
        );
      } else {
        const horariosStr = slots.join(", ");
        await sendWhatsAppMessage(
          from,
          `Para o dia ${data}, tenho estes horários disponíveis: ${horariosStr}. Qual você prefere?`
        );
      }

      session.agendamento_parcial = {
        ...session.agendamento_parcial,
        ...dados_agendamento
      };
    } else if (tipo === "AGENDAMENTO_CONFIRMAR") {
      const { servicos, profissional, data, horario, nome_cliente } =
        dados_agendamento;

      // para simplificar, usamos apenas o primeiro serviço
      const service = servicos?.[0] || "Serviço";

      const event = await createBooking({
        service,
        professional: profissional || "Primeira disponibilidade",
        date: data,
        time: horario,
        clientName: nome_cliente || from
      });

      await sendWhatsAppMessage(
        from,
        `Perfeito, ${nome_cliente || ""}! Seu horário para ${service} em ${data} às ${horario} está reservado com ${profissional ||
          "nosso time"}. Qualquer mudança é só me chamar aqui. 😊`
      );

      session.agendamento_parcial = null;
    } else {
      // fallback
      await sendWhatsAppMessage(
        from,
        mensagem_para_cliente ||
          "Tive uma dificuldade para processar seu pedido. Pode tentar novamente?"
      );
    }

    updateSession(from, session);

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
