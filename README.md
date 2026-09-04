# Boleta MT5 — página de vendas

Projeto pronto para publicar gratuitamente no **GitHub Pages**, com pedidos e compradores registrados no **Supabase**, pagamento de **R$ 19,90 via Mercado Pago** e download protegido.

## Como funciona

1. O cliente digita um e-mail válido.
2. Uma Edge Function cria o pedido e o Checkout Pro do Mercado Pago.
3. O Mercado Pago chama o webhook após o pagamento.
4. O webhook consulta a API do Mercado Pago antes de marcar o pedido como aprovado.
5. O cliente recebe um botão de download. A função gera um link privado válido por 60 segundos.
6. Para conferir quem comprou, pesquise o e-mail na tabela `pedidos` do Supabase e verifique `status = approved`.

O e-mail não é marcado como comprador apenas por preencher o formulário. Isso evita prestar suporte a quem não pagou.

## 1. Criar o projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole todo o arquivo `supabase/schema.sql` e execute.
3. Em **Storage > produtos**, envie o EA compilado com o caminho:
   `boleta/BoletaMT5.ex5`
4. Mantenha o bucket privado.

## 2. Instalar e configurar a CLI do Supabase

No terminal, dentro desta pasta:

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

Cadastre os segredos (nunca coloque esses valores no GitHub):

```bash
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="SEU_ACCESS_TOKEN_PRODUCAO"
supabase secrets set PUBLIC_SITE_URL="https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO"
supabase secrets set PRODUCT_FILE_PATH="boleta/BoletaMT5.ex5"
```

O `SUPABASE_URL` e o `SUPABASE_SERVICE_ROLE_KEY` já são fornecidos automaticamente às Edge Functions.

Publique as funções:

```bash
supabase functions deploy criar-pagamento
supabase functions deploy mercado-pago-webhook --no-verify-jwt
supabase functions deploy status-pedido
supabase functions deploy baixar-produto --no-verify-jwt
```

## 3. Mercado Pago

1. Acesse **Mercado Pago Developers > Suas integrações**.
2. Crie uma aplicação de pagamentos online.
3. Copie o **Access Token de produção** e use no comando de segredo acima.
4. A preferência de pagamento e a URL de notificação são criadas automaticamente pelo sistema.

Use credenciais de teste primeiro. Só depois substitua pelo token de produção.

## 4. Configurar o site

No Supabase, abra **Project Settings > API**. Copie:

- Project URL
- chave pública `anon` / `publishable`

Edite `config.js` e substitua os dois valores. A chave pública pode ficar no site; a `service_role` jamais pode.

## 5. Publicar no GitHub Pages

1. Crie um repositório vazio no GitHub.
2. Envie todos os arquivos desta pasta para a branch `main`.
3. No repositório, abra **Settings > Pages**.
4. Em **Build and deployment > Source**, selecione **GitHub Actions**.
5. O workflow incluído publicará o site automaticamente.
6. Atualize o segredo `PUBLIC_SITE_URL` no Supabase com a URL exata informada pelo GitHub Pages.

## Consultar clientes para suporte

No Supabase, acesse **Table Editor > pedidos** e filtre:

- `email` igual ao e-mail informado pelo cliente;
- `status` igual a `approved`.

Também é possível executar:

```sql
select email, status, aprovado_em, mercado_pago_payment_id
from public.pedidos
where lower(email) = lower('cliente@exemplo.com')
order by criado_em desc;
```

## Trocar o arquivo vendido

Abra **Storage > produtos > boleta** no Supabase e substitua `BoletaMT5.ex5`. O site não precisa ser republicado.

## Segurança importante

- Não envie `.env`, Access Token do Mercado Pago ou `service_role` ao GitHub.
- A tabela não permite leitura pública; as consultas de suporte são feitas no painel autenticado do Supabase.
- O webhook nunca confia apenas na notificação recebida: ele consulta o pagamento na API do Mercado Pago.
- O link do arquivo é temporário e só é criado para pedidos aprovados.
- Faça uma compra de teste completa antes de aceitar pagamentos reais.

## Estrutura

```text
index.html                  página pública
styles.css                 identidade visual responsiva
app.js                     validação do e-mail e fluxo do pedido
config.js                  URL e chave pública do Supabase
assets/                    banner da Boleta MT5
supabase/schema.sql        banco e bucket privado
supabase/functions/        pagamento, webhook, status e download
.github/workflows/         publicação automática no GitHub Pages
```
