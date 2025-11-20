import axios from "axios";
import { SYSTEM_PROMPT } from "./config/prompt.js";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function callChatGPT(conversationHistory, userMessage) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: "user", content: userMessage }
  ];

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.4
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data.choices[0].message.content;

  // O modelo vai responder em JSON (string), então fazemos parse
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error("Erro ao fazer JSON.parse da resposta do ChatGPT:", e);
    // fallback para uma resposta simples
    json = {
      tipo: "RESPOSTA",
      mensagem_para_cliente:
        "Desculpa, tive um probleminha aqui. Pode repetir sua mensagem?",
      dados_agendamento: null
    };
  }

  return json;
}
