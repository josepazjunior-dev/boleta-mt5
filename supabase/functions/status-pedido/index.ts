import { adminClient, corsHeaders, json, safeToken } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const { token } = await req.json().catch(() => ({}));
  if (!safeToken(token)) return json({ error: 'Pedido inválido.' }, 400);
  const { data, error } = await adminClient().from('pedidos').select('status').eq('token_cliente', token).maybeSingle();
  if (error) { console.error(error); return json({ error: 'Não foi possível consultar o pedido.' }, 500); }
  if (!data) return json({ error: 'Pedido não encontrado.' }, 404);
  return json({ status: data.status });
});
