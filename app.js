(function(){
  const cfg=window.BOLETA_CONFIG||{};
  const form=document.getElementById('checkout-form');
  const email=document.getElementById('email');
  const error=document.getElementById('email-error');
  const button=document.getElementById('pay-button');
  const statusBox=document.getElementById('order-status');
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function configured(){return cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.includes('SEU-PROJETO')&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.includes('SUA_CHAVE');}
  async function invoke(name,body){
    const response=await fetch(`${cfg.SUPABASE_URL}/functions/v1/${name}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.SUPABASE_ANON_KEY}`,'apikey':cfg.SUPABASE_ANON_KEY},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível continuar. Tente novamente.');
    return data;
  }
  function showStatus(html,type=''){statusBox.className=`order-status show ${type}`;statusBox.innerHTML=html;}
  async function checkOrder(token){
    try{
      const data=await invoke('status-pedido',{token});
      if(data.status==='approved'){
        showStatus(`<strong>Pagamento aprovado!</strong><br>Seu arquivo já está disponível.<a class="download-button" href="${cfg.SUPABASE_URL}/functions/v1/baixar-produto?token=${encodeURIComponent(token)}">BAIXAR BOLETA MT5</a>`,'success');
      }else{
        showStatus('<strong>Aguardando confirmação do pagamento.</strong><br>Esta página verifica automaticamente. Normalmente leva poucos instantes.');
        setTimeout(()=>checkOrder(token),5000);
      }
    }catch(e){showStatus(e.message);}
  }
  const token=new URLSearchParams(location.search).get('pedido');
  if(token){document.getElementById('comprar').scrollIntoView();checkOrder(token);}

  form.addEventListener('submit',async(e)=>{
    e.preventDefault();error.textContent='';
    const value=email.value.trim().toLowerCase();
    if(!emailPattern.test(value)){error.textContent='Digite um e-mail válido, como nome@exemplo.com.';email.focus();return;}
    if(!configured()){showStatus('A página ainda está em configuração. O pagamento será liberado em breve.');return;}
    button.disabled=true;button.textContent='ABRINDO PAGAMENTO...';
    try{
      const data=await invoke('criar-pagamento',{email:value});
      location.href=data.checkout_url;
    }catch(err){showStatus(err.message);button.disabled=false;button.textContent='PAGAR COM MERCADO PAGO';}
  });
})();
