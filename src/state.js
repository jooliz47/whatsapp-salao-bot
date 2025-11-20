// MUITO simples, apenas para teste
const sessions = {};

export function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      history: [],
      agendamento_parcial: null
    };
  }
  return sessions[phone];
}

export function updateSession(phone, data) {
  const session = getSession(phone);
  Object.assign(session, data);
}
