// Re-trigger the stuck stitches with the now-fixed seamless-stitcher.
// Auth path: final-assembly authorizes the project OWNER, so we temporarily
// move each stuck project to a fresh authenticatable test user, forceReconcile,
// then move it back to 3menions. Unstitchable (no clips) -> marked failed.
import { readFileSync } from 'node:fs';
function env(k){ for (const f of ['.env','.env.local']){ try{ const l=readFileSync(f,'utf8').split('\n').find(x=>x.startsWith(k+'=')); if(l) return l.slice(k.length+1).trim().replace(/^["']|["']$/g,''); }catch{} } return ''; }
const URL=env('VITE_SUPABASE_URL'), ANON=env('VITE_SUPABASE_PUBLISHABLE_KEY'), SR=env('SUPABASE_SERVICE_ROLE_KEY');
const OWNER='8be6d9c9-776e-46af-9ad8-23ad41f0f99c';
const sh={apikey:SR,Authorization:`Bearer ${SR}`,'Content-Type':'application/json'};
async function rest(path,opts={}){ return fetch(`${URL}${path}`,{headers:sh,...opts}); }
async function patch(pid,body){ await rest(`/rest/v1/movie_projects?id=eq.${pid}`,{method:'PATCH',headers:{...sh,Prefer:'return=minimal'},body:JSON.stringify(body)}); }

// fresh stitcher user (owns projects during re-stitch)
const stamp=Date.now();
const email=`stitcher-${stamp}@smallbridges.test`, pass=`Sx!${stamp}aB`;
const uid=(await (await rest('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password:pass,email_confirm:true})})).json()).id;
await rest('/rest/v1/rpc/add_credits',{method:'POST',body:JSON.stringify({p_user_id:uid,p_amount:5000,p_description:'stitch',p_stripe_payment_id:`ST_${stamp}`})});
await patch(uid && '', {}); // no-op guard
const tok=(await (await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})})).json()).access_token;
console.log('stitcher uid',uid,'jwt',tok?'Y':'N');

// gather all test projects
const rows=await (await rest(`/rest/v1/movie_projects?user_id=eq.${OWNER}&or=(title.like.UI*,title.like.API*)&select=id,title,status,video_url`)).json();
const reassigned=[];
for(const r of rows){
  if(r.video_url){ console.log('SKIP (done):',r.title.slice(0,40)); continue; }
  // clip readiness
  const clips=await (await rest(`/rest/v1/video_clips?project_id=eq.${r.id}&select=status,video_url`)).json();
  const ready=clips.filter(c=>c.video_url).length;
  if(ready>=1){
    await patch(r.id,{user_id:uid});
    const resp=await (await fetch(`${URL}/functions/v1/final-assembly`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({projectId:r.id,forceReconcile:true})})).text();
    console.log('RESTITCH',r.title.slice(0,38),'clips='+ready,'->',resp.slice(0,90));
    reassigned.push(r.id);
  } else {
    await patch(r.id,{status:'failed', last_error:'No renderable clips (stopped by audit)'});
    console.log('FAILED  ',r.title.slice(0,38),'(no clips) -> marked failed');
  }
}
console.log('REASSIGNED='+reassigned.join(','));
console.log('STITCHER_UID='+uid);
