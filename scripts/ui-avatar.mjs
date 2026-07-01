import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;
const OWNER='8be6d9c9-776e-46af-9ad8-23ad41f0f99c';
async function mkUser(tag){
  const stamp=Date.now()+Math.floor(Math.random()*1000);
  const email=`uiav-${tag}-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
  const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
  await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:4000,p_description:'av',p_stripe_payment_id:`AVX_${tag}_${stamp}`})});
  await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})});
  return await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();
}
async function patch(pid,body){ await fetch(`${URL}/rest/v1/movie_projects?id=eq.${pid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)}); }

async function run(tag, label, urlPath, isBreakout){
  let pid='', note='';
  const session=await mkUser(tag);
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
  const page=await ctx.newPage();
  await page.goto(`http://localhost:7777${urlPath}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(3500);
  if(!isBreakout){ await page.getByRole('button',{name:'Avatar'}).first().click({timeout:8000}).catch(()=>note+='no-avatar-mode;'); await page.waitForTimeout(1500); }
  // open the Cast dropdown (combobox or button referencing Cast/presenter)
  const opener=page.getByRole('combobox').first();
  let opened=false;
  if(await opener.count().catch(()=>0)){ await opener.click({timeout:5000}).catch(()=>{}); opened=true; }
  if(!opened){ await page.getByText(/Cast member|Pick a presenter|Choose.*cast|Select.*avatar/i).first().click({timeout:5000}).catch(()=>note+='no-cast-opener;'); }
  await page.waitForTimeout(1200);
  await page.screenshot({path:`/tmp/uiav-${tag}-dropdown.png`});
  // pick first option in the listbox/menu
  const opt=page.locator('[role=option], [role=menuitem], [data-radix-collection-item]').first();
  if(await opt.count().catch(()=>0)){ await opt.click({timeout:5000}).catch(()=>note+='opt-click-fail;'); }
  else { note+='no-cast-options;'; }
  await page.waitForTimeout(1000);
  // dialogue
  await page.locator('textarea').first().fill('Hello and welcome — today we explore something amazing.').catch(()=>note+='no-textarea;');
  await page.waitForTimeout(500);
  await page.screenshot({path:`/tmp/uiav-${tag}-before.png`});
  const gen=page.getByRole('button',{name:'Generate'}).last();
  note+=' gen-disabled='+await gen.isDisabled().catch(()=>'?');
  await gen.click({timeout:8000}).catch(()=>note+='no-generate;');
  await page.waitForURL(/\/production\//,{timeout:45000}).catch(()=>note+='no-nav;');
  await page.waitForTimeout(1500);
  const m=page.url().match(/\/production\/([0-9a-f-]{36})/); pid=m?m[1]:'';
  await page.screenshot({path:`/tmp/uiav-${tag}-after.png`});
  if(pid) await patch(pid,{title:label,user_id:OWNER});
  console.log(`${tag.padEnd(10)} project=${pid||'(none)'} ${note}`);
  await ctx.close();
  return {tag,pid,note};
}

const browser=await chromium.launch({headless:true});
const out=[];
out.push(await run('avatar','UI · Avatar · KLING (talking head)','/studio',false).catch(e=>({tag:'avatar',pid:'',note:'ERR '+e.message})));
out.push(await run('breakout','UI · Breakout · Post-Escape (4th-wall)','/studio?template=post-escape',true).catch(e=>({tag:'breakout',pid:'',note:'ERR '+e.message})));
await browser.close();
console.log('\n==== AVATAR/BREAKOUT UI SUMMARY ====');
for(const r of out) console.log(`${r.tag.padEnd(10)} ${r.pid?('OK '+r.pid):'FAIL'} ${r.note||''}`);
