// Drive the UI for one TEMPLATE per category (the applied-template creation
// path: /studio?template=ID is exactly what "Use this template" navigates to).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;
const OWNER='8be6d9c9-776e-46af-9ad8-23ad41f0f99c';
async function mkUser(tag){
  const stamp=Date.now()+Math.floor(Math.random()*1000);
  const email=`uit-${tag}-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
  const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
  await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:4000,p_description:'uit',p_stripe_payment_id:`UIT_${tag}_${stamp}`})});
  await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})});
  return await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();
}
async function patch(pid,body){ await fetch(`${URL}/rest/v1/movie_projects?id=eq.${pid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)}); }

const TPL=[
  {cat:'cinematic',   id:'template-noir-1',  label:'UI · TEMPLATE · Cinematic (Neo-Noir)'},
  {cat:'commercial',  id:'featured-1',       label:'UI · TEMPLATE · Commercial (Product Reveal)'},
  {cat:'educational', id:'template-edu-1',   label:'UI · TEMPLATE · Educational (Breakdown)'},
  {cat:'entertainment',id:'viral-hook',      label:'UI · TEMPLATE · Entertainment (Viral Hook)'},
  {cat:'corporate',   id:'template-corp-1',  label:'UI · TEMPLATE · Corporate'},
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const t of TPL){
  let pid='',note='';
  try{
    const session=await mkUser(t.cat);
    const ctx=await browser.newContext({viewport:{width:1440,height:900}});
    await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
    const page=await ctx.newPage();
    await page.goto(`http://localhost:7778/studio?template=${t.id}`,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(4000);
    const promptLen=await page.locator('textarea').first().inputValue().then(v=>v.length).catch(()=>0);
    if(promptLen<3){ // template didn't prefill a prompt -> type one so creation can proceed
      await page.locator('textarea').first().fill(`A ${t.cat} scene, cinematic`).catch(()=>{});
      note+='no-template-prefill;';
    }
    await page.waitForTimeout(400);
    await page.screenshot({path:`/tmp/uitpl-${t.cat}-before.png`});
    await page.getByRole('button',{name:'Generate'}).last().click({timeout:8000}).catch(()=>note+='no-generate;');
    await page.waitForURL(/\/production\//,{timeout:45000}).catch(()=>note+='no-nav;');
    await page.waitForTimeout(1500);
    const m=page.url().match(/\/production\/([0-9a-f-]{36})/); pid=m?m[1]:'';
    await page.screenshot({path:`/tmp/uitpl-${t.cat}-after.png`});
    if(pid) await patch(pid,{title:t.label,user_id:OWNER});
    console.log(`${t.cat.padEnd(13)} promptLen=${promptLen} project=${pid||'(none)'} ${note}`);
    results.push({...t,pid,note});
    await ctx.close();
  }catch(e){ console.log(t.cat,'ERR',e.message); results.push({...t,pid,note:'ERR'}); }
}
await browser.close();
console.log('\n==== TEMPLATE UI SUMMARY ====');
for(const r of results) console.log(`${r.cat.padEnd(13)} ${r.pid?('OK '+r.pid):'FAIL'} ${r.note||''}`);
console.log('TPLPIDS='+results.filter(r=>r.pid).map(r=>r.cat+':'+r.pid).join(' '));
