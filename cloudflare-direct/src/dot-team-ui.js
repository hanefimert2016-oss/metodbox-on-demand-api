export function teamPage() {
const HTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a1121"><title>Dot · Agent Ekibi</title>
<style>
:root{color-scheme:dark;--bg:#091120;--panel:#101d31;--card:#162741;--border:#304563;--fg:#f3f7ff;--muted:#a9bfdc;--blue:#5285ef}
*{box-sizing:border-box}body{background:var(--bg);color:var(--fg);margin:0;font:14px system-ui,-apple-system,Segoe UI,sans-serif}button,input,textarea{font:inherit}button{border-radius:10px;border:1px solid #385274;background:#1c3452;color:white;padding:10px 12px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}button.primary{background:#3a70dc;border-color:#518ef5}button.danger{background:#47202c;border-color:#734156}input:not([type=checkbox]),textarea{width:100%;padding:12px;background:#101b2e;border:1px solid #38516f;border-radius:10px;color:white;outline:none}textarea{resize:vertical;min-height:80px}
header{display:flex;justify-content:space-between;align-items:center;padding:15px 22px;border-bottom:1px solid var(--border);gap:12px}.brand{font-weight:800;font-size:19px}.muted{color:var(--muted)}.subtitle{font-size:12px;color:var(--muted)}a{color:#b0d0ff;text-decoration:none}
.wrap{max-width:1380px;margin:auto;padding:20px;display:grid;grid-template-columns:420px minmax(0,1fr);gap:18px}.panel{background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:19px;box-shadow:0 20px 50px #0003}.panel h2{font-size:18px;margin:0 0 10px}
.agent{padding:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;margin:12px 0;cursor:pointer}.agent.selected{border-color:#85adff;box-shadow:0 0 0 1px #6a98fc inset}.agent h3{font-size:15px;margin:0 0 7px;display:flex;justify-content:space-between;gap:10px}.agent p{margin:6px 0;font-size:12px;color:var(--muted);overflow-wrap:anywhere;line-height:1.5}.tag{font-size:11px;background:#27466b;border-radius:99px;padding:4px 9px;color:#c6dcff}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}.actions button{flex:0 0 auto}.report{background:#0c1728;border:1px solid #344766;border-radius:12px;padding:13px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;font-size:12px;line-height:1.55}.sec{margin:20px 0 9px;font-size:13px;color:#cbdefa;font-weight:700}.pic{width:100%;display:none;border:1px solid var(--border);border-radius:12px;margin-top:10px;object-fit:contain;max-height:430px}.status{color:#8fbbff;font-size:12px;white-space:pre-wrap}.form{display:grid;gap:10px}.label{color:#c2d4ed;font-size:12px}.notice{border:1px solid #385274;background:#182840;padding:11px;border-radius:11px;font-size:12px;color:#c5d7ef;line-height:1.5}.check{display:flex;align-items:center;gap:10px;font-size:12px;margin-top:13px}.check input{width:18px;height:18px}#result{margin-top:14px}
@media(max-width:870px){.wrap{grid-template-columns:1fr;padding:10px}.panel{padding:14px}header{padding:13px}.brand{font-size:17px}} 
</style></head><body>
<header><div><a href="/dot" class="brand">← ✦ Metodbox Dot</a><div class="subtitle">Çoklu Agent Kontrol Merkezi · Paralel görevler, ayrı bilgisayarlar</div></div><span class="tag" id="topStatus">Bağlanıyor</span></header>
<div class="wrap">
<section class="panel"><h2>◈ Agent Ekibi</h2><div class="notice">Her sohbet için 1 ana PC, her alt agent için ayrı GitHub Actions PC ve şifreli kalıcı çalışma alanı. İstekler aynı GPT+ API'sine eşzamanlı gönderilebilir.</div>
<div id="roster"><div class="muted">Agentlar yükleniyor…</div></div>
<div class="sec">Yeni alt agent</div><div class="form"><input id="agentName" maxlength="80" placeholder="Ör. Araştırmacı"><textarea id="agentTask" maxlength="2000" placeholder="Ör. X projesindeki güncel kütüphaneleri araştır, sonuçları raporla."></textarea>
<div class="actions"><button id="addAgent" class="primary">＋ Oluştur ve PC aç</button><button id="runSelected">▶ Seçilen agentları paralel çalıştır</button><button id="cancelWait" disabled>Beklemeyi iptal et</button></div>
<label class="check"><input type="checkbox" id="waitForPc" checked> Gerçek PC gerektiren görevlerde agent PC'leri hazır olana kadar bekle</label></div>
<label class="check"><input type="checkbox" id="shellGrant"> Alt agentlara terminal komutu çalıştırma izni ver</label>
<p class="subtitle">Terminal için güçlü portal şifresi ve ayrıca izin gerekir. Aynı anda en fazla 3 bağımsız agent/model isteği, bir sohbette en fazla 6 alt agent.</p>
<div id="result" class="report">Görev sonuçları ve hatalar burada gösterilir.</div>
</section>
<section class="panel"><h2 id="computerTitle">▣ Ana bilgisayar</h2><div class="status" id="computerStatus">Bilgisayar durumu yükleniyor…</div>
<div class="actions"><button id="pcStart" class="primary">PC başlat / devam et</button><button id="pcStop" class="danger">Durdur + şifreli kaydet</button><button id="pcRefresh">Yenile</button></div>
<div class="sec">Tarayıcı ve web araması</div><input id="target" type="url" value="https://example.org" placeholder="https://..."><div class="actions"><button id="navigate" class="primary">Web sitesini aç</button><button id="searchWeb">Web'de ara</button><button id="screenshot">Ekran görüntüsü</button></div>
<img id="picture" class="pic" alt="Agent PC tarayıcı ekranı">
<div class="sec">Terminal</div><textarea id="command" rows="2" placeholder="Ör. pwd veya ls -la"></textarea><div class="actions"><button id="exec">Komutu çalıştır</button></div><p class="subtitle">Sadece seçili agentın izole PC'sinde çalışır. Bu telefonunun veya kişisel bilgisayarının terminali değildir. Güçlü şifre ve onay gerekir.</p>
<div class="sec">Çıktı / Rapor</div><div class="report" id="output">Bir agent/PC seç.</div>
</section></div>
<script>
(()=>{'use strict';
const $=x=>document.getElementById(x);const chatId=new URL(location.href).searchParams.get('chatId');
let selected='main',roster=null,loading=false;
if(chatId){const link=document.querySelector('header a');if(link)link.href='/dot?chatId='+encodeURIComponent(chatId)}
async function api(path,method='GET',body){const r=await fetch('/dot/api/'+path,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined});const o=await r.json().catch(()=>({}));if(!r.ok)throw Error(o.error||'HTTP '+r.status);return o}
function status(t){$('topStatus').textContent=t}
function output(t){$('output').textContent=typeof t==='string'?t:JSON.stringify(t,null,2)}
function pcId(){return selected==='main'?'main':selected}
function pcBody(extra={}){return {chatId,agentId:pcId(),...extra}}
async function pcState(){if(!chatId)return;try{const p=await api('pc/status?chatId='+encodeURIComponent(chatId)+'&agentId='+encodeURIComponent(pcId()));$('computerStatus').textContent=(p.status||'stopped')+' · '+(p.message||'');}catch(e){$('computerStatus').textContent=e.message}}
async function action(type,data={}){if(!chatId){output('Sohbet kimliği bulunamadı; /dot adresinden bir sohbet aç.');return}
try{status('PC işleniyor…');const r=await api('pc/'+type,'POST',pcBody(data));if(r.base64){if(!/^[A-Za-z0-9+/=]+$/.test(r.base64))throw Error('Invalid image');$('picture').src='data:image/png;base64,'+r.base64;$('picture').style.display='block'}
else output(r);await pcState();status('Hazır')}catch(e){output('PC hatası: '+e.message);status('PC hatası')}}
function card(agent,pc,index){
const root=document.createElement('article');root.className='agent'+(selected===agent.id?' selected':'');
const title=document.createElement('h3'),name=document.createElement('span');name.textContent=agent.name;
const tag=document.createElement('span');tag.className='tag';tag.textContent=pc?.status||'stopped';title.append(name,tag);root.append(title);
const task=document.createElement('p');task.textContent=agent.task||'Bu sohbetin ana agentı';root.append(task);
if(agent.report){const rep=document.createElement('p');rep.textContent='Son rapor: '+agent.report.slice(0,220);root.append(rep)}
const actions=document.createElement('div');actions.className='actions';
const btn=document.createElement('button');btn.textContent='▣ PC ve araçlar';btn.onclick=e=>{e.stopPropagation();selected=agent.id;drawRoster();pcState()};actions.append(btn);
if(index>0){const label=document.createElement('label');label.className='check';const check=document.createElement('input');check.type='checkbox';check.dataset.agent=agent.id;label.append(check,document.createTextNode('Paralel seç'));actions.append(label);
const run=document.createElement('button');run.textContent='▶ Çalıştır';run.onclick=e=>{e.stopPropagation();runAgents([agent.id])};actions.append(run)}
root.append(actions);root.onclick=()=>{selected=agent.id;drawRoster();pcState()};return root;
}
function drawRoster(){
const el=$('roster');el.replaceChildren();
if(!roster)return;
const main={id:'main',name:'★ Ana Agent',task:'Bu sohbetteki görevleri dağıtır; kendine özel ana PC'};el.append(card(main,roster.mainPc,0));
for(let i=0;i<roster.agents.length;i++)el.append(card(roster.agents[i],roster.agents[i].pc,i+1));
const item=roster.agents.find(a=>a.id===selected);
$('computerTitle').textContent='▣ '+(item?.name||'Ana Agent')+' Bilgisayarı';
$('shellGrant').checked=roster.allowExec===true;
status((1+roster.agents.length)+' agent · '+roster.agents.filter(a=>a.pc?.status==='running').length+' alt PC çalışıyor');
}
async function refresh(){if(!chatId){status('Sohbet seçilmedi');output('Önce /dot ana ekranında Yeni konuşma oluştur, sonra ◈ Ekip düğmesine bas.');return}
try{const parent=await api('threads/'+encodeURIComponent(chatId));if(!parent?.id)throw Error('Sohbet bulunamadı');roster=await api('chats/'+encodeURIComponent(chatId)+'/agents');drawRoster();await pcState()}catch(e){status('Hata');output('Bağlantı hatası: '+e.message+' · /dot sayfasına dönüp yeniden giriş yap.')}}
async function addAgent(){
if(!chatId)return;const task=$('agentTask').value.trim();if(!task){output('Alt agent için görev yaz.');return}
$('addAgent').disabled=true;status('Yeni PC isteniyor…');
try{const r=await api('chats/'+chatId+'/agents','POST',{name:$('agentName').value.trim()||'Alt Agent',task});$('agentTask').value='';output(r.agents.map(x=>x.name+' için ayrı PC: '+(x.pc?.status||'requested')).join('\\n'));await refresh()}
catch(e){output('Agent oluşturma hatası: '+e.message)}finally{$('addAgent').disabled=false}
}
let cancelledWait=false;
async function waitUntilComputersReady(ids){
  cancelledWait=false;
  $('cancelWait').disabled=false;
  try{
    const initial=await api('chats/'+chatId+'/agents');
    const statuses=new Map(initial.agents.map(a=>[a.id,a.pc?.status||'stopped']));
    // Restore stopped/stale PCs, but never interrupt a PC already stopping.
    const stopped=ids.filter(id=>['stopped','stale','error'].includes(statuses.get(id)));
    if(stopped.length){
      const dispatch=await Promise.allSettled(stopped.map(agentId=>api('pc/start','POST',{chatId,agentId})));
      const failed=dispatch.filter(x=>x.status==='rejected');
      if(failed.length)throw Error('PC başlangıç hatası: '+failed.map(x=>x.reason.message).join('; '));
    }
    const until=Date.now()+3*60*1000;
    while(Date.now()<until){
      if(cancelledWait)throw Error('Bekleme iptal edildi. PC ve agent verileri korunuyor.');
      const data=await api('chats/'+chatId+'/agents');
      const selected=ids.map(id=>data.agents.find(a=>a.id===id));
      if(selected.some(a=>!a))throw Error('Seçilen agent artık mevcut değil.');
      const failed=selected.filter(a=>a.pc?.status==='error');
      if(failed.length)throw Error('PC hatası: '+failed.map(a=>a.name+' · '+(a.pc.message||'Başlatılamadı')).join('; '));
      const waiting=selected.filter(a=>a.pc?.status!=='running');
      if(!waiting.length)return;
      status('PC bekleniyor: '+waiting.length+'/'+ids.length);
      output('GitHub bilgisayarları hazırlanıyor…\\n'+waiting.map(a=>a.name+' · '+(a.pc?.status||'stopped')).join('\\n')+
        '\\n\\nPC hazır olunca görevler otomatik ve paralel başlayacak. İstersen beklemeyi iptal et.');
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    throw Error('PC 3 dakika içinde hazır olmadı. Daha sonra tekrar deneyebilir ya da PC beklemeden model görevini çalıştırabilirsin.');
  }finally{$('cancelWait').disabled=true}
}
async function runAgents(ids){
  if(!ids.length){output('Paralel çalıştırmak için alt agent seç.');return}
  if(ids.length>3){output('Tek turda en fazla 3 paralel agent.');return}
  $('runSelected').disabled=true;
  try{
    if($('waitForPc').checked)await waitUntilComputersReady(ids);
    status('Paralel model çağrıları…');
    output(ids.length+' bağımsız agent GPT+ modelinden eşzamanlı yanıt alıyor…');
    const r=await api('chats/'+chatId+'/agents/run','POST',{agentIds:ids});
    output(r.reports.map(x=>x.id+'\\n'+(x.report||x.error||'Sonuç yok')).join('\\n\\n'));
    await refresh();
  }catch(e){status('Agent bekliyor / hata');output(e.message)}
  finally{$('runSelected').disabled=false}
}
$('cancelWait').onclick=()=>{cancelledWait=true};
$('addAgent').onclick=addAgent;
$('runSelected').onclick=()=>runAgents(Array.from(document.querySelectorAll('input[data-agent]:checked')).map(x=>x.dataset.agent));
$('shellGrant').onchange=async()=>{const allow=$('shellGrant').checked;if(allow&&!confirm('Bu sohbetin alt agentlarına terminal komutları çalıştırma izni verilsin mi?')){$('shellGrant').checked=false;return}
try{const p=await api('chats/'+chatId+'/agents/permissions','POST',{allowExec:allow});roster.allowExec=p.allowExec===true;output('Agent terminal izni: '+(p.allowExec?'açık':'kapalı'))}
catch(e){$('shellGrant').checked=!allow;output(e.message)}};
$('pcStart').onclick=()=>action('start');
$('pcStop').onclick=()=>{if(confirm('Seçili PC durdurulsun mu? Şifreli dosyalar kapatılırken saklanır.'))action('stop')};
$('pcRefresh').onclick=()=>{pcState();refresh()};
$('navigate').onclick=()=>action('navigate',{url:$('target').value});
$('searchWeb').onclick=()=>{const q=prompt('Aramak istediğin konu:');if(q)action('navigate',{url:'https://www.google.com/search?q='+encodeURIComponent(q.slice(0,200))})};
$('screenshot').onclick=()=>action('screenshot');
$('exec').onclick=()=>{const command=$('command').value.trim();if(command&&confirm('Şu komut seçili agentın PC terminalinde çalıştırılsın mı?\\n'+command))action('exec',{command,timeoutMs:20000})};
refresh();setInterval(()=>{if(!document.hidden&&!loading){loading=true;pcState().finally(()=>loading=false)}},9000);
})();
</script></body></html>`;
return new Response(HTML,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
