// Busca os pedidos de HOJE no Foody e devolve só totais (sem dados de clientes).
const TOKENS = {
  Barreirinha: process.env.FOODY_TOKEN_BARREIRINHA,
  Fazendinha: process.env.FOODY_TOKEN_FAZENDINHA,
  BR277: process.env.FOODY_TOKEN_BR277,
};
const ANDAM = ['open', 'ready', 'dispatched', 'accepted', 'onGoing'];
const FIM = ['delivered', 'closed'];
const mediana = (a) => { if (!a.length) return null; a.sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

async function loja(token, ini, fim) {
  if (!token) return { erro: 'token não configurado' };
  const url = `https://app.foodydelivery.com/rest/1.2/orders/?startDate=${encodeURIComponent(ini)}&endDate=${encodeURIComponent(fim)}`;
  const r = await fetch(url, { headers: { Authorization: token, 'Content-Type': 'application/json;charset=UTF-8' } });
  if (!r.ok) return { erro: 'Foody respondeu ' + r.status };
  const os = await r.json();
  const ent = os.filter((o) => FIM.includes(o.status));
  const tempos = ent.filter((o) => o.deliveryDate && o.date).map((o) => (new Date(o.deliveryDate) - new Date(o.date)) / 6e4).filter((m) => m > 0 && m <= 240);
  const horas = Array(24).fill(0);
  os.forEach((o) => { horas[(new Date(o.date).getUTCHours() + 21) % 24]++; });
  const valor = ent.reduce((s, o) => s + (o.orderTotal || 0), 0);
  return {
    total: os.length,
    andamento: os.filter((o) => ANDAM.includes(o.status)).length,
    entregues: ent.length,
    cancelados: os.filter((o) => o.status === 'cancelled').length,
    valor, ticket: ent.length ? valor / ent.length : 0,
    tempo: mediana(tempos), horas,
    limite: os.length >= 500,
  };
}

exports.handler = async (ev) => {
  if (process.env.DASH_KEY && (ev.queryStringParameters || {}).k !== process.env.DASH_KEY)
    return { statusCode: 401, body: JSON.stringify({ erro: 'chave inválida' }) };
  const hoje = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  const ini = hoje + 'T00:00:00-03:00', fim = hoje + 'T23:59:59-03:00';
  const lojas = {};
  for (const [n, t] of Object.entries(TOKENS)) {
    try { lojas[n] = await loja(t, ini, fim); } catch (e) { lojas[n] = { erro: 'falha ao consultar' }; }
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ atualizado: new Date().toISOString(), data: hoje, lojas }) };
};
