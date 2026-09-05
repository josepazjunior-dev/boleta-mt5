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

  async function copyLicense(license){
    try{
      await navigator.clipboard.writeText(license);
    }catch(_){
      const field=document.createElement('textarea');
      field.value=license;
      field.style.position='fixed';
      field.style.opacity='0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    const copyButton=document.getElementById('copy-license-button');
    if(copyButton){
      copyButton.textContent='LICENÇA COPIADA!';
      setTimeout(()=>{copyButton.textContent='COPIAR LICENÇA';},2000);
    }
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
      setTimeout(()=>checkOrder(token),500);
    }catch(e){
      showStatus(`<strong>Pagamento aprovado.</strong><br>${e.message}`,'success');
    }
  }

  function approvedView(data,token){
    const license=String(data.license_key||'');
    const remaining=Number(data.downloads_remaining||0);
    const expiry=data.download_expires_at
      ? new Date(data.download_expires_at).toLocaleString('pt-BR')
      : '';

    let html=
      '<strong>Pagamento aprovado!</strong><br>'+ 
      'Guarde a licença abaixo. Ela será solicitada no MetaTrader 5.'+
      '<div style="margin:14px 0;padding:12px;border:1px solid #2fd17d;border-radius:8px;text-align:center">'+
      '<small style="display:block;margin-bottom:6px">SUA LICENÇA</small>'+
      '<strong style="font-size:18px;letter-spacing:1px">'+license+'</strong>'+
      '</div>'+
      '<button class="download-button" id="copy-license-button" type="button">COPIAR LICENÇA</button>';

    if(remaining>0){
      html+=
        '<button class="download-button" id="download-button" type="button">BAIXAR BOLETA MT5</button>'+
        `<small style="display:block;margin-top:10px">Downloads disponíveis: ${remaining} de 2`+
        (expiry?` • prazo: ${expiry}`:'')+'</small>';
    }else{
      html+=
        '<p style="margin-top:12px"><strong>Limite de downloads atingido.</strong><br>'+ 
        'Se precisar novamente, fale com o suporte.</p>';
    }

    showStatus(html,'success');
    document.getElementById('copy-license-button')
      .addEventListener('click',()=>copyLicense(license));
    const downloadButton=document.getElementById('download-button');
    if(downloadButton){
      downloadButton.addEventListener('click',()=>downloadFile(token));
    }
  }

  async function checkOrder(token){
    try{
      const data=await invoke('boleta-api',{acao:'status',token});

      if(data.status==='approved'){
        button.disabled=true;
        button.textContent='PAGAMENTO APROVADO';
        approvedView(data,token);
      }else if(data.status==='rejected'||data.status==='cancelled'){
        button.disabled=false;
        button.textContent='TENTAR PAGAMENTO NOVAMENTE';
        showStatus(
          '<strong>O pagamento não foi aprovado.</strong><br>'+ 
          'Você pode tentar novamente ou escolher outra forma de pagamento.'
        );
      }else if(data.status==='refunded'){
        button.disabled=true;
        button.textContent='PAGAMENTO DEVOLVIDO';
        showStatus(
          '<strong>Pagamento devolvido.</strong><br>A licença desta compra está desativada.'
        );
      }else{
        showStatus(
          '<strong>Aguardando confirmação do pagamento.</strong><br>'+ 
          'Faça somente um pagamento. Esta página verifica automaticamente '+
          'e exibirá sua licença quando o Mercado Pago confirmar.'
        );
        setTimeout(()=>checkOrder(token),5000);
      }
    }catch(_){
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
      '<h2>Preparando o pagamento...</h2><p>Não feche esta página.</p></div>';

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

      history.replaceState({},'',`${location.pathname}?pedido=${encodeURIComponent(data.token)}`);
      showStatus(
        '<strong>Pagamento aberto em outra aba.</strong><br>'+ 
        'Faça somente um pagamento. Depois de pagar, volte para esta aba. '+
        'Sua licença e o download aparecerão automaticamente.'
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
