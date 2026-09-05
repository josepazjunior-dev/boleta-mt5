(function(){
  const cfg=window.BOLETA_CONFIG||{};
  const form=document.getElementById('checkout-form');
  const email=document.getElementById('email');
  const error=document.getElementById('email-error');
  const button=document.getElementById('pay-button');
  const statusBox=document.getElementById('order-status');
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function configured(){
    return cfg.SUPABASE_URL&&
      !cfg.SUPABASE_URL.includes('SEU-PROJETO')&&
      cfg.SUPABASE_ANON_KEY&&
      !cfg.SUPABASE_ANON_KEY.includes('SUA_CHAVE');
  }

  async function invoke(name,body){
    const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${cfg.SUPABASE_ANON_KEY}`,
        'apikey':cfg.SUPABASE_ANON_KEY
      },
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      throw new Error(data.error||'Não foi possível continuar. Tente novamente.');
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
        throw new Error(data.error||'Não foi possível baixar o arquivo.');
      }

      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=objectUrl;
      link.download='BoletaMT52026.ex5';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);

      if(downloadButton){
        downloadButton.disabled=false;
        downloadButton.textContent='BAIXAR NOVAMENTE';
      }
    }catch(e){
      showStatus(`<strong>Pagamento aprovado.</strong><br>${e.message}`,'success');
    }
  }

  async function checkOrder(token){
    try{
      const data=await invoke('boleta-api',{acao:'status',token});

      if(data.status==='approved'){
        button.disabled=true;
        button.textContent='PAGAMENTO APROVADO';
        showStatus(
          '<strong>Pagamento aprovado!</strong><br>'+ 
          'Seu arquivo já está disponível.'+
          '<button class="download-button" id="download-button" type="button">'+
          'BAIXAR BOLETA MT5</button>',
          'success'
        );
        document.getElementById('download-button')
          .addEventListener('click',()=>downloadFile(token));
      }else if(data.status==='rejected'||data.status==='cancelled'){
        button.disabled=false;
        button.textContent='TENTAR PAGAMENTO NOVAMENTE';
        showStatus(
          '<strong>O pagamento não foi aprovado.</strong><br>'+ 
          'Você pode tentar novamente ou escolher outra forma de pagamento.'
        );
      }else{
        showStatus(
          '<strong>Aguardando confirmação do pagamento.</strong><br>'+ 
          'Faça somente um pagamento. Esta página verifica automaticamente '+
          'e liberará o download quando o Mercado Pago confirmar.'
        );
        setTimeout(()=>checkOrder(token),5000);
      }
    }catch(e){
      showStatus(
        '<strong>Não foi possível verificar agora.</strong><br>'+ 
        'A página tentará novamente automaticamente.'
      );
      setTimeout(()=>checkOrder(token),5000);
    }
  }

  const token=new URLSearchParams(location.search).get('pedido');
  if(token){
    document.getElementById('comprar').scrollIntoView();
    button.disabled=true;
    button.textContent='VERIFICANDO PAGAMENTO...';
    checkOrder(token);
  }

  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    error.textContent='';

    const value=email.value.trim().toLowerCase();
    if(!emailPattern.test(value)){
      error.textContent='Digite um e-mail válido, como nome@exemplo.com.';
      email.focus();
      return;
    }

    if(!configured()){
      showStatus('A página ainda está em configuração. O pagamento será liberado em breve.');
      return;
    }

    /* A aba precisa ser aberta imediatamente pelo clique do cliente.
       Se for aberta somente depois do await, o navegador pode bloqueá-la. */
    const paymentTab=window.open('about:blank','_blank');

    if(!paymentTab){
      showStatus(
        '<strong>O navegador bloqueou a página de pagamento.</strong><br>'+ 
        'Autorize as janelas pop-up deste site e clique novamente.'
      );
      return;
    }

    paymentTab.document.title='Preparando pagamento';
    paymentTab.document.body.innerHTML=
      '<div style="font-family:Arial,sans-serif;text-align:center;margin-top:80px">'+
      '<h2>Preparando o pagamento...</h2>'+
      '<p>Não feche esta página.</p>'+
      '</div>';

    button.disabled=true;
    button.textContent='ABRINDO PAGAMENTO...';

    try{
      const data=await invoke('boleta-api',{
        acao:'criar-pagamento',
        email:value
      });

      if(!data.checkout_url||!data.token){
        throw new Error('Resposta de pagamento incompleta. Tente novamente.');
      }

      history.replaceState(
        {},
        '',
        `${location.pathname}?pedido=${encodeURIComponent(data.token)}`
      );

      showStatus(
        '<strong>Pagamento aberto em outra aba.</strong><br>'+ 
        'Faça somente um pagamento. Depois de pagar, volte para esta aba. '+
        'O download será liberado automaticamente.'
      );

      button.textContent='AGUARDANDO PAGAMENTO...';
      paymentTab.location.replace(data.checkout_url);
      checkOrder(data.token);
    }catch(err){
      paymentTab.close();
      showStatus(err.message);
      button.disabled=false;
      button.textContent='PAGAR COM MERCADO PAGO';
    }
  });
})();
