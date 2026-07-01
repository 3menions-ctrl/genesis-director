import { chromium } from "playwright";
import { readFileSync } from "node:fs";
function env(k){for(const f of [".env",".env.local"]){try{const l=readFileSync(f,"utf8").split("\n").find(x=>x.startsWith(k+"="));if(l)return l.slice(k.length+1).trim().replace(/^["']|["']$/g,"");}catch{}}return"";}
const URL=env("VITE_SUPABASE_URL"),ANON=env("VITE_SUPABASE_PUBLISHABLE_KEY")||env("VITE_SUPABASE_ANON_KEY"),SR=env("SUPABASE_SERVICE_ROLE_KEY");
const REF=URL.replace("https://","").split(".")[0],KEY=`sb-${REF}-auth-token`;
const ID="bb77364d-047b-4abb-a726-eca49d33e40d",EM="demo-mira@smallbridges.test",P=`Fr!${Date.now()}x`;
await fetch(`${URL}/auth/v1/admin/users/${ID}`,{method:"PUT",headers:{apikey:SR,Authorization:`Bearer ${SR}`,"Content-Type":"application/json"},body:JSON.stringify({password:P})});
const s=await(await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:ANON,"Content-Type":"application/json"},body:JSON.stringify({email:EM,password:P})})).json();
const b=await chromium.launch({headless:true});const c=await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
await c.addInitScript(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(s)]);
const pg=await c.newPage();
const shots=[
  ["/account","fresh-profile"],
  ["/lobby","fresh-lobby"],
  ["/account?tab=settings","fresh-settings"],
  ["/account?tab=credits","fresh-credits"],
  ["/inbox","fresh-inbox"],
  ["/music","fresh-music"],
  ["/pricing","fresh-pricing"],
  ["/how-it-works","fresh-howitworks"],
];
for(const [path,name] of shots){
  try{
    await pg.goto(`http://localhost:7788${path}`,{waitUntil:"networkidle",timeout:60000});
    await pg.waitForTimeout(2800);
    await pg.screenshot({path:`/tmp/${name}.png`,fullPage:true});
    console.log("ok",name,pg.url());
  }catch(e){console.log("FAIL",path,e.message.split("\n")[0]);}
}
await b.close();
