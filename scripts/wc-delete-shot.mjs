import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
const URL=process.env.VITE_SUPABASE_URL, ANON=process.env.VITE_SUPABASE_PUBLISHABLE_KEY, SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF="ywcwaumozoejierlfkgj", SK=`sb-${REF}-auth-token`;
const admin=createClient(URL,SERVICE,{auth:{persistSession:false}});
let uid, ids=[];
try{
  const email=`wc-shot-${Date.now()}@example.com`, pw="Sh!"+Math.random().toString(36).slice(2,10);
  const {data}=await admin.auth.admin.createUser({email,password:pw,email_confirm:true}); uid=data.user.id;
  await admin.from("profiles").update({display_name:"Ava Directs"}).eq("id",uid);
  const c=createClient(URL,ANON,{auth:{persistSession:false}});
  const {data:s}=await c.auth.signInWithPassword({email,password:pw});
  for(const b of ["just finished a noir cut — thoughts?","actually nvm, deleting this one 😅"]){ const {data:r}=await c.rpc("post_world_chat",{p_body:b,p_image_url:null}); ids.push(r.id); await new Promise(x=>setTimeout(x,1300)); }
  const br=await chromium.launch(); const p=await br.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  await p.addInitScript(([k,v])=>localStorage.setItem(k,v),[SK,JSON.stringify(s.session)]);
  await p.goto("http://localhost:7777/lobby",{waitUntil:"networkidle",timeout:60000});
  const wc=p.locator('[data-testid="world-chat"]'); await wc.waitFor({state:"visible",timeout:20000});
  await p.addStyleTag({content:'[aria-label="Delete message"]{opacity:1 !important}'});
  await p.waitForTimeout(800);
  await wc.screenshot({path:"/tmp/wc-delete2.png"}); console.log("shot ok");
  await br.close();
}catch(e){console.log("ERR",e.message);}finally{
  for(const id of ids) await admin.from("world_chat").delete().eq("id",id);
  if(uid) await admin.auth.admin.deleteUser(uid);
  console.log("cleanup done");
}
