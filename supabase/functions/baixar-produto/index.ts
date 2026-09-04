import { adminClient, corsHeaders, json, safeToken } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = new URL(req.url).searchParams.get('token');
  if (!safeToken(token)) return json({ error: 'Link inválido.' }, 400);
  const db = adminClient();
  const { data: order } = await db.from('pedidos').select('status').eq('token_cliente', token).maybeSingle();
  if (!order || order.status !== 'approved') return json({ error: 'Download ainda não liberado.' }, 403);

  const path = Deno.env.get('PRODUCT_FILE_PATH') || 'boleta/BoletaMT5.ex5';
  const { data, error } = await db.storage.from('produtos').createSignedUrl(path, 60, { download: true });
  if (error || !data?.signedUrl) { console.error(error); return json({ error: 'Arquivo temporariamente indisponível.' }, 503); }
  return Response.redirect(data.signedUrl, 302);
});
