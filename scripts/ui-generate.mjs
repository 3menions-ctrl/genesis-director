// Drive the REAL Studio UI to create one labeled video per engine.
// Fixes learned: onboard the user (else /onboarding loop aborts creation),
// click the bottom-right CTA (.last() Generate, not the nav one), and use
// each engine's legal duration (veo/sora min 8s).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;
const OWNER='8be6d9c9-776e-46af-9ad8-23ad41f0f99c';

async function mkUser(tag){
  const stamp=Date.now()+Math.floor(Math.random()*1000);
  const email=`ui-${tag}-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
  const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
  await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:4000,p_description:'ui',p_stripe_payment_id:`UI_${tag}_${stamp}`})});
  await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})});
  const session=await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();
  return {session,uid};
}
async function patch(pid,body){ await fetch(`${URL}/rest/v1/movie_projects?id=eq.${pid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)}); }

const RUNS=[
  {tag:'wan',      engine:/Wan 2\.5/,     dur:'5s', label:'UI · Text-to-Video · WAN (5s)',      prompt:'A paper crane unfolding into a real bird over a calm lake at dawn, cinematic'},
  {tag:'kling',    engine:/Kling V3/,     dur:'5s', label:'UI · Text-to-Video · KLING (5s)',    prompt:'A glass elevator rising through neon clouds above a future city, cinematic'},
  {tag:'seedance', engine:/Seedance 2\.0/,dur:'5s', label:'UI · Text-to-Video · SEEDANCE (5s)', prompt:'A wolf made of constellations running across a midnight sky, cinematic'},
  {tag:'veo',      engine:/Veo 3/,        dur:'8s', label:'UI · Text-to-Video · VEO (8s)',      prompt:'A lighthouse keeper lighting a lamp as a storm rolls in, cinematic'},
  {tag:'sora',     engine:/Sora 2/,       dur:'8s', label:'UI · Text-to-Video · SORA (8s)',     prompt:'A koi pond reflecting a city skyline at golden hour, ripples spreading, cinematic'},
];

const browser=await chromium.launch({headless:true});
const results=[];
for (const r of RUNS){
  let pid='', note='';
  try{
    const {session,uid}=await mkUser(r.tag);
    if(!session?.access_token){ results.push({...r,pid:'',note:'session-fail'}); console.log(r.tag,'session-fail'); continue; }
    const ctx=await browser.newContext({viewport:{width:1440,height:900}});
    await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
    const page=await ctx.newPage();
    let toast='';
    page.on('console',m=>{const t=m.text(); if(/insufficient|unlock|purchase|locked/i.test(t)) toast+=t.slice(0,100)+' | ';});
    await page.goto('http://localhost:7777/studio',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(3500);
    await page.getByRole('button',{name:'Cinematic'}).first().click({timeout:8000}).catch(()=>note+='no-cinematic;');
    await page.waitForTimeout(400);
    await page.getByRole('button',{name:r.engine}).first().click({timeout:8000}).catch(()=>note+='no-engine;');
    await page.waitForTimeout(400);
    await page.getByRole('button',{name:r.dur,exact:true}).first().click({timeout:5000}).catch(()=>note+='no-dur('+r.dur+');');
    await page.locator('textarea').first().fill(r.prompt).catch(()=>note+='no-textarea;');
    await page.waitForTimeout(500);
    await page.screenshot({path:`/tmp/uigen-${r.tag}-before.png`});
    await page.getByRole('button',{name:'Generate'}).last().click({timeout:8000}).catch(()=>note+='no-generate;');
    await page.waitForURL(/\/production\//,{timeout:45000}).catch(()=>note+='no-nav;');
    await page.waitForTimeout(1500);
    const m=page.url().match(/\/production\/([0-9a-f-]{36})/); pid=m?m[1]:'';
    if(toast) note+=' TOAST:'+toast;
    await page.screenshot({path:`/tmp/uigen-${r.tag}-after.png`});
    if(pid){ await patch(pid,{title:r.label,user_id:OWNER}); }
    console.log(`${r.tag.padEnd(9)} project=${pid||'(none)'} url=${page.url().slice(0,55)} ${note}`);
    results.push({...r,pid,uid,note});
    await ctx.close();
  }catch(e){ console.log(r.tag,'ERR',e.message); results.push({...r,pid,note:'ERR:'+e.message}); }
}
await browser.close();
console.log('\n==== UI GEN SUMMARY ====');
for(const r of results) console.log(`${r.tag.padEnd(9)} ${r.pid?('OK '+r.pid):'FAIL'} ${r.note||''}`);
console.log('UIPIDS='+results.filter(r=>r.pid).map(r=>r.tag+':'+r.pid).join(' '));
