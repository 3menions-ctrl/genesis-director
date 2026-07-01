import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;
const OWNER='8be6d9c9-776e-46af-9ad8-23ad41f0f99c';
async function mkUser(tag){
  const stamp=Date.now()+Math.floor(Math.random()*1000);
  const email=`uia2-${tag}-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
  const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
  await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:4000,p_description:'a2',p_stripe_payment_id:`A2_${tag}_${stamp}`})});
  await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})});
  return await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();
}
async function patch(pid,body){ await fetch(`${URL}/rest/v1/movie_projects?id=eq.${pid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)}); }

async function run(tag,label,modeBtn){
  let pid='',note='';
  const session=await mkUser(tag);
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
  const page=await ctx.newPage();
  let toast='';
  page.on('response',async r=>{if(/mode-router/.test(r.url())){let t='';try{t=(await r.text()).slice(0,120);}catch{} if(/error|blocked/.test(t))toast+=t;}});
  await page.goto('http://localhost:7778/studio',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(3500);
  // 1) Cast module -> pick avatar
  await page.getByRole('button',{name:'Cast'}).first().click({timeout:8000}).catch(()=>note+='no-cast;');
  await page.waitForTimeout(2500);
  await page.getByRole('button',{name:'Dr Robert Hayes'}).first().click({timeout:8000}).catch(()=>note+='no-avatar-pick;');
  await page.waitForTimeout(1500);
  // a detail/confirm button may appear
  for(const nm of [/use (this )?(avatar|cast|presenter)/i,/select/i,/add to cast/i,/choose/i,/cast (them|in)/i]){
    const btn=page.getByRole('button',{name:nm}).first();
    if(await btn.count().catch(()=>0)){ await btn.click({timeout:3000}).catch(()=>{}); break; }
  }
  await page.waitForTimeout(1200);
  // 2) Generate module
  await page.getByRole('button',{name:'Generate'}).first().click({timeout:8000}).catch(()=>note+='no-gen-rail;');
  await page.waitForTimeout(1500);
  // 3) avatar mode
  await page.getByRole("button",{name:modeBtn,exact:true}).first().click({timeout:6000}).catch(()=>note+="no-modebtn;");
  await page.waitForTimeout(800);
  await page.getByRole("button",{name:/Seedance 2\.0/}).first().click({timeout:6000}).catch(()=>note+="no-seedance;");
  await page.waitForTimeout(1000);
  await page.screenshot({path:`/tmp/uia2-${tag}-pre.png`});
  // 4) dialogue
  await page.locator('textarea').first().fill('Hello and welcome — today we explore something amazing together.').catch(()=>note+='no-textarea;');
  await page.waitForTimeout(600);
  const gen=page.getByRole('button',{name:'Generate'}).last();
  note+=' disabled='+await gen.isDisabled().catch(()=>'?');
  await gen.click({timeout:8000}).catch(()=>note+='no-generate;');
  await page.waitForURL(/\/production\//,{timeout:50000}).catch(()=>note+='no-nav;');
  await page.waitForTimeout(1500);
  const m=page.url().match(/\/production\/([0-9a-f-]{36})/); pid=m?m[1]:'';
  await page.screenshot({path:`/tmp/uia2-${tag}-after.png`});
  if(toast)note+=' TOAST:'+toast;
  if(pid) await patch(pid,{title:label,user_id:OWNER});
  console.log(`${tag.padEnd(10)} project=${pid||'(none)'} ${note}`);
  await ctx.close();
  return {tag,pid,note};
}
const browser=await chromium.launch({headless:true});
await run('avatar','UI · Avatar · Talking Head (Dr Robert Hayes)','Avatar').catch(e=>console.log('avatar ERR',e.message));
await browser.close();
