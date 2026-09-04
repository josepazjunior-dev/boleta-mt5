import { adminClient, corsHeaders, json, validEmail } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const { email } = await req.json();
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!validEmail(normalized)) return json({ error: 'Informe um e-mail válido.' }, 400);

    const db = adminClient();
    const { data: order, error: insertError } = await db.from('pedidos').insert({ email: normalized }).select('id,token_cliente').single();
    if (insertError) throw insertError;

    const publicSite = (Deno.env.get('PUBLIC_SITE_URL') || '').replace(/\/$/, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const preference = {
      items: [{ id: 'boleta-mt5', title: 'Boleta MT5 - Controle de Perdas', quantity: 1, currency_id: 'BRL', unit_price: 19.90 }],
      payer: { email: normalized },
      external_reference: order.id,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
      back_urls: {
        success: `${publicSite}/?pedido=${order.token_cliente}`,
        pending: `${publicSite}/?pedido=${order.token_cliente}`,
        failure: `${publicSite}/?pedido=${order.token_cliente}`,
      },
      auto_return: 'approved',
      statement_descriptor: 'BOLETA MT5',
    };

    const mp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')}` },
      body: JSON.stringify(preference),
    });
    const mpData = await mp.json();
    if (!mp.ok || !mpData.init_point) {
      await db.from('pedidos').update({ status: 'cancelled' }).eq('id', order.id);
      console.error('Mercado Pago preference error', mp.status, mpData);
      return json({ error: 'Não foi possível abrir o pagamento agora.' }, 502);
    }
    await db.from('pedidos').update({ mercado_pago_preference_id: mpData.id }).eq('id', order.id);
    return json({ checkout_url: mpData.init_point });
  } catch (error) {
    console.error(error);
    return json({ error: 'Falha ao iniciar o pagamento.' }, 500);
  }
});
