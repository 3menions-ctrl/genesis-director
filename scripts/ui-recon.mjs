// UI recon: log in as a fresh funded test user via session injection,
// open /studio, dump interactive elements + screenshots so we can author
// the real click-path. No generation fired in this pass.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

function env(k){
  for (const f of ['.env','.env.local']){
    try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{}
  }
  return '';
}
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0];
const STORAGE_KEY=`sb-${REF}-auth-token`;

async function jpost(path, body, key){
  const r=await fetch(`${URL}${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:r.status, json: await r.json().catch(()=>({}))};
}

const stamp=Date.now();
const email=`ui-recon-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
console.log('creating test user', email);
const cr=await jpost('/auth/v1/admin/users',{email,password:pass,email_confirm:true},SR);
const uid=cr.json.id; console.log('uid',uid);
await jpost('/rest/v1/rpc/add_credits',{p_user_id:uid,p_amount:3000,p_description:'ui-recon',p_stripe_payment_id:`UIRECON_${stamp}`},SR);
const tok=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
const session=await tok.json();
console.log('session access_token:', session.access_token? 'Y':'N');

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
const sessionVal=JSON.stringify(session);
await ctx.addInitScript(([k,v])=>{ localStorage.setItem(k,v); }, [STORAGE_KEY, sessionVal]);
const page=await ctx.newPage();
page.on('console',m=>{ const t=m.text(); if(/error|fail|denied|credit/i.test(t)) console.log('  [page]',t.slice(0,160)); });

await page.goto('http://localhost:7777/studio',{waitUntil:'networkidle',timeout:60000}).catch(e=>console.log('goto warn',e.message));
await page.waitForTimeout(3500);
console.log('URL now:', page.url());
await page.screenshot({path:'/tmp/ui-studio.png', fullPage:true});

// dump interactive elements
const els=await page.evaluate(()=>{
  const out={buttons:[],textareas:[],inputs:[],selects:[]};
  document.querySelectorAll('button').forEach(b=>{const t=(b.innerText||b.getAttribute('aria-label')||'').trim().replace(/\s+/g,' '); if(t) out.buttons.push(t.slice(0,40));});
  document.querySelectorAll('textarea').forEach(t=>out.textareas.push((t.placeholder||t.getAttribute('aria-label')||'').slice(0,60)));
  document.querySelectorAll('input').forEach(i=>out.inputs.push(`${i.type}:${(i.placeholder||i.name||'').slice(0,40)}`));
  document.querySelectorAll('[role=combobox],select').forEach(s=>out.selects.push((s.getAttribute('aria-label')||s.textContent||'').trim().slice(0,40)));
  return out;
});
console.log('BUTTONS:', JSON.stringify([...new Set(els.buttons)]));
console.log('TEXTAREAS:', JSON.stringify(els.textareas));
console.log('INPUTS:', JSON.stringify([...new Set(els.inputs)]));
console.log('SELECTS:', JSON.stringify([...new Set(els.selects)]));

// also screenshot library
await page.goto('http://localhost:7777/library',{waitUntil:'networkidle',timeout:60000}).catch(()=>{});
await page.waitForTimeout(3000);
await page.screenshot({path:'/tmp/ui-library.png', fullPage:true});
console.log('library URL:', page.url());

await browser.close();
console.log('DONE. screenshots: /tmp/ui-studio.png /tmp/ui-library.png');
console.log('RECON_USER='+uid);
