import { adminClient, corsHeaders, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    if (!paymentId) return json({ received: true });

    // Não confiamos no conteúdo do webhook: consultamos o pagamento diretamente
    // no Mercado Pago usando o token secreto antes de aprovar qualquer pedido.
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')}` },
    });
    if (!response.ok) return json({ error: 'Pagamento não localizado.' }, 404);
    const payment = await response.json();
    const orderId = payment.external_reference;
    if (!orderId) return json({ received: true });

    const paymentMatchesProduct = payment.currency_id === 'BRL' && Number(payment.transaction_amount) === 19.90;
    const statusMap: Record<string, string> = { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled', refunded: 'refunded' };
    const status = paymentMatchesProduct ? (statusMap[payment.status] || 'pending') : 'pending';
    const updates: Record<string, unknown> = { status, mercado_pago_payment_id: String(payment.id) };
    if (status === 'approved') updates.aprovado_em = new Date().toISOString();
    const { error } = await adminClient().from('pedidos').update(updates).eq('id', orderId).eq('valor_centavos', 1990);
    if (error) throw error;
    return json({ received: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'Falha ao processar notificação.' }, 500);
  }
});
