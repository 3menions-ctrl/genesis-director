import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const REF=URL.replace('https://','').split('.')[0]; const KEY=`sb-${REF}-auth-token`;
const stamp=Date.now(), email=`tplpg-${stamp}@smallbridges.test`, pass=`Ux!${stamp}aB`;
const uid=(await (await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
await fetch(`${URL}/rest/v1/rpc/add_credits`,{method:'POST',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:uid,p_amount:4000,p_description:'tp',p_stripe_payment_id:`TP_${stamp}`})});
await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:{apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({onboarding_completed:true})});
const session=await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json();
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(session)]);
const page=await ctx.newPage();
await page.goto('http://localhost:7778/templates',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForTimeout(4000);
await page.screenshot({path:'/tmp/ui-templates-page.png',fullPage:true});
// dump buttons + look for "Use" CTA
const btns=await page.evaluate(()=>{const o=[];document.querySelectorAll('button,a[role=button],a').forEach(b=>{const t=(b.innerText||'').replace(/\s+/g,' ').trim();if(t&&t.length<40)o.push(t);});return [...new Set(o)];});
console.log('TEMPLATES PAGE BUTTONS/LINKS:', JSON.stringify(btns.slice(0,60)));
// try clicking a template card then a Use button
const card=page.locator('[class*=card],[role=button]').filter({hasText:/Noir|Viral|Product|Documentary|Hook|Reveal/i}).first();
if(await card.count().catch(()=>0)){ await card.click({timeout:6000}).catch(e=>console.log('card click',e.message)); await page.waitForTimeout(1500); }
await page.screenshot({path:'/tmp/ui-templates-drawer.png',fullPage:true});
const use=page.getByRole('button',{name:/use (this )?template|use template|create with|start/i}).first();
if(await use.count().catch(()=>0)){ console.log('found Use button'); await use.click({timeout:6000}).catch(e=>console.log('use click',e.message)); }
else console.log('NO Use button found');
await page.waitForURL(/\/studio|\/create|\/production/,{timeout:20000}).catch(()=>{});
await page.waitForTimeout(4000);
console.log('URL after Use:', page.url());
const promptLen=await page.locator('textarea').first().inputValue().then(v=>v.length).catch(()=>0);
console.log('promptLen after Use:', promptLen);
await page.screenshot({path:'/tmp/ui-templates-applied.png',fullPage:true});
await browser.close();
