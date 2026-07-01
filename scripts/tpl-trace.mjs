import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['/Users/briancole/Developer/genesis-director/.env','/Users/briancole/Developer/genesis-director/.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;
const stamp=Date.now(), email=`trc-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:4000,p_description:'t',p_stripe_payment_id:`T_${stamp}`})});
await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})});
const session=await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();
const b=await chromium.launch({headless:true}); const ctx=await b.newContext();
await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
const page=await ctx.newPage();
page.on('console',m=>{const t=m.text(); if(/emplate|elcome|nboard|Route\]/.test(t)) console.log('  C>',t.slice(0,120));});
await page.goto('http://localhost:7778/studio?template=template-noir-1',{waitUntil:'domcontentloaded',timeout:60000});
for(let i=0;i<14;i++){ const s=await page.evaluate(()=>location.pathname+location.search); console.log(`t+${(i*0.5).toFixed(1)}s ${s}`); await page.waitForTimeout(500); }
await b.close();
