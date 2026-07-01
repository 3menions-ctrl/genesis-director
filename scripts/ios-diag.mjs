import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";
function env(k){for(const f of [".env",".env.local"]){try{const l=readFileSync(f,"utf8").split("\n").find(x=>x.startsWith(k+"="));if(l)return l.slice(k.length+1).trim().replace(/^["']|["']$/g,"");}catch{}}return"";}
const URL=env("VITE_SUPABASE_URL"),ANON=env("VITE_SUPABASE_PUBLISHABLE_KEY")||env("VITE_SUPABASE_ANON_KEY"),SR=env("SUPABASE_SERVICE_ROLE_KEY");
const REF=URL.replace("https://","").split(".")[0],KEY=`sb-${REF}-auth-token`;
const ID="bb77364d-047b-4abb-a726-eca49d33e40d",EM="demo-mira@smallbridges.test",P=`Dg!${Date.now()}x`;
await fetch(`${URL}/auth/v1/admin/users/${ID}`,{method:"PUT",headers:{apikey:SR,Authorization:`Bearer ${SR}`,"Content-Type":"application/json"},body:JSON.stringify({password:P})});
const s=await(await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:ANON,"Content-Type":"application/json"},body:JSON.stringify({email:EM,password:P})})).json();
const b=await chromium.launch({headless:true});const c=await b.newContext({...devices["iPhone 14 Pro"]});
await c.addInitScript(([k,v])=>{localStorage.setItem("sb_shell","mobile");localStorage.setItem(k,v);},[KEY,JSON.stringify(s)]);
const pg=await c.newPage();
const errs=[];pg.on("console",m=>{if(/error|fail|denied/i.test(m.text()))errs.push(m.text().slice(0,140));});
await pg.goto("http://localhost:7799/me/settings?shell=mobile",{waitUntil:"domcontentloaded",timeout:60000});
for(const t of [3000,6000,10000,14000]){
  await pg.waitForTimeout(t===3000?3000:t-(t===6000?3000:t===10000?6000:10000));
  const txt=await pg.evaluate(()=>document.body.innerText.replace(/\s+/g," ").trim().slice(0,160));
  console.log(`@${t}ms:`, txt||"(empty)");
}
console.log("errors:", JSON.stringify(errs.slice(0,6)));
await b.close();
