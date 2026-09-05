
(function(){
  const cfg=window.BOLETA_CONFIG||{};
  const form=document.getElementById('checkout-form');
  const email=document.getElementById('email');
  const error=document.getElementById('email-error');
  const button=document.getElementById('pay-button');
  const statusBox=document.getElementById('order-status');
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function configured(){
    return cfg.SUPABASE_URL &&
      !cfg.SUPABASE_URL.includes('SEU-PROJETO') &&
      cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_ANON_KEY.includes('SUA_CHAVE');
  }

  async function invoke(name,body){
    const response=await fetch(
      `${cfg.SUPABASE_URL}/functions/v1/${name}`,
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${cfg.SUPABASE_ANON_KEY}`,
          'apikey':cfg.SUPABASE_ANON_KEY
        },
        body:JSON.stringify(body)
      }
    );

    const data=await response.json().catch(()=>({}));

    if(!response.ok){
      throw new Error(
        data.error || 'Não foi possível continuar. Tente novamente.'
      );
    }

    return data;
  }

  function showStatus(html,type=''){
    statusBox.className=`order-status show ${type}`;
    statusBox.innerHTML=html;
  }

  async function downloadFile(token){
    const downloadButton=document.getElementById('download-button');

    if(downloadButton){
      downloadButton.disabled=true;
      downloadButton.textContent='PREPARANDO DOWNLOAD...';
    }

    try{
      const response=await fetch(
        `${cfg.SUPABASE_URL}/functions/v1/boleta-api?acao=download&token=${encodeURIComponent(token)}`,
        {
          headers:{
            'Authorization':`Bearer ${cfg.SUPABASE_ANON_KEY}`,
            'apikey':cfg.SUPABASE_ANON_KEY
          }
        }
      );

      if(!response.ok){
        const data=await response.json().catch(()=>({}));

        throw new Error(
          data.error || 'Não foi possível baixar o arquivo.'
        );
      }

      const blob=await response.blob();
      const fileUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');

      link.href=fileUrl;
      link.download='BoletaMT5.ex5';

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(()=>{
        URL.revokeObjectURL(fileUrl);
      },1000);

      if(downloadButton){
        downloadButton.disabled=false;
        downloadButton.textContent='BAIXAR NOVAMENTE';
      }
    }catch(e){
      showStatus(
        `<strong>Pagamento aprovado.</strong><br>${e.message}`,
        'success'
      );
    }
  }

  async function checkOrder(token){
    try{
      const data=await invoke(
        'boleta-api',
        {
          acao:'status',
          token:token
        }
      );

      if(data.status==='approved'){
        showStatus(
          '<strong>Pagamento aprovado!</strong><br>' +
          'Seu arquivo já está disponível.' +
          '<button class="download-button" ' +
          'id="download-button" type="button">' +
          'BAIXAR BOLETA MT5</button>',
          'success'
        );

        document
          .getElementById('download-button')
          .addEventListener(
            'click',
            ()=>downloadFile(token)
          );
      }else{
        showStatus(
          '<strong>Aguardando confirmação do pagamento.</strong><br>' +
          'Esta página verifica automaticamente. ' +
          'Normalmente leva poucos instantes.'
        );

        setTimeout(()=>{
          checkOrder(token);
        },5000);
      }
    }catch(e){
      showStatus(e.message);
    }
  }

  const token=new URLSearchParams(location.search).get('pedido');

  if(token){
    document
      .getElementById('comprar')
      .scrollIntoView();

    checkOrder(token);
  }

  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    error.textContent='';

    const value=email.value.trim().toLowerCase();

    if(!emailPattern.test(value)){
      error.textContent=
        'Digite um e-mail válido, como nome@exemplo.com.';

      email.focus();
      return;
    }

    if(!configured()){
      showStatus(
        'A página ainda está em configuração. ' +
        'O pagamento será liberado em breve.'
      );
      return;
    }

    button.disabled=true;
    button.textContent='ABRINDO PAGAMENTO...';

    try{
      const data=await invoke(
        'boleta-api',
        {
          acao:'criar-pagamento',
          email:value
        }
      );

      location.href=data.checkout_url;
    }catch(err){
      showStatus(err.message);
      button.disabled=false;
      button.textContent='PAGAR COM MERCADO PAGO';
    }
  });
})();
