import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;

const stamp=Date.now();
const email=`ui-dbg-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
console.log('uid',uid);
console.log('grant', await (await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:3000,p_description:'dbg',p_stripe_payment_id:`DBG_${stamp}`})})).text());
// mark onboarded to avoid /studio<->/onboarding redirect loop that aborts creation
console.log('onboard', (await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})})).status);
const session=await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
const page=await ctx.newPage();
page.on('console',m=>console.log('  [console]',m.type(),m.text().slice(0,200)));
page.on('pageerror',e=>console.log('  [pageerror]',e.message.slice(0,200)));
page.on('response',async r=>{ const u=r.url(); if(/get_credit_state|deduct_credits|functions\/v1\/mode-router|functions\/v1\/hollywood/.test(u)){ let b=''; try{b=(await r.text()).slice(0,300);}catch{} console.log(`  [net ${r.status()}] ${u.split('/').slice(-1)[0].slice(0,40)} -> ${b}`);} });

await page.goto('http://localhost:7777/studio',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(3500);
// select Cinematic + Wan + 5s
await page.getByRole('button',{name:'Cinematic'}).first().click({timeout:8000}).catch(e=>console.log('cinematic',e.message));
await page.waitForTimeout(400);
await page.getByRole('button',{name:/Wan 2\.5/}).first().click({timeout:8000}).catch(e=>console.log('engine',e.message));
await page.waitForTimeout(400);
await page.getByRole('button',{name:'5s',exact:true}).first().click({timeout:5000}).catch(e=>console.log('5s',e.message));
await page.locator('textarea').first().fill('A paper crane unfolding into a real bird over a calm lake at dawn, cinematic');
await page.waitForTimeout(600);

// inspect Generate button state
const gen=page.getByRole('button',{name:'Generate'}).last();
console.log('Generate disabled?', await gen.isDisabled().catch(()=>'?'));
const promptVal=await page.locator('textarea').first().inputValue().catch(()=>'?');
console.log('prompt value len:', promptVal.length);

const cands=await page.evaluate(()=>{
  const out=[];
  document.querySelectorAll('button,[role=button]').forEach((b,i)=>{
    const t=(b.innerText||'').replace(/\s+/g,' ').trim();
    if(/generat/i.test(t)){ const r=b.getBoundingClientRect(); out.push({t:t.slice(0,40),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),vis:r.width>0&&r.height>0,dis:b.disabled}); }
  });
  return out;
});
console.log('GENERATE CANDIDATES:', JSON.stringify(cands,null,0));
let clickT=0; const post=[];
page.on('request',r=>{ if(r.method()==='POST'){ const u=r.url(); if(/rpc\/|functions\/v1\//.test(u)) post.push(`+${clickT?((Date.now()-clickT)/1000).toFixed(1):'pre'}s ${u.split('/').slice(-1)[0].slice(0,30)}`);} });
console.log('--- clicking Generate ---');
clickT=Date.now();
await gen.click({timeout:8000}).catch(e=>console.log('genclick',e.message));
for(let i=0;i<16;i++){
  await page.waitForTimeout(750);
  const st=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/Generat|Initializ|Verif|Creating|pipeline/i.test(x.innerText)); const ov=[...document.querySelectorAll('*')].find(x=>/Initializing pipeline|Verifying credits|Creating project/i.test(x.textContent||'')&&x.children.length<3); return {btn:b?b.innerText.slice(0,30):'', ov: ov?ov.textContent.slice(0,40):'', url:location.pathname};});
  if(st.url.includes('/production')||st.ov){ console.log(`  t+${(i*0.75).toFixed(1)}s url=${st.url} btn="${st.btn}" status="${st.ov}"`); }
  if(st.url.includes('/production')) break;
}
console.log('POST calls after click:', JSON.stringify(post.filter(x=>x.startsWith('+') && !x.includes('pre'))));
console.log('URL after click:', page.url());
// dump any toast
const toasts=await page.evaluate(()=>{ const out=[]; document.querySelectorAll('[data-sonner-toast],[role=status],li[data-type]').forEach(t=>out.push((t.innerText||'').slice(0,160))); return out; });
console.log('TOASTS:', JSON.stringify(toasts));
// any visible dialog
const dialogs=await page.evaluate(()=>{ const out=[]; document.querySelectorAll('[role=dialog],[role=alertdialog]').forEach(d=>out.push((d.innerText||'').slice(0,200))); return out; });
console.log('DIALOGS:', JSON.stringify(dialogs));
await page.screenshot({path:'/tmp/ui-debug-after.png',fullPage:true});
await browser.close();
console.log('done -> /tmp/ui-debug-after.png');
