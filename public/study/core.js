export const DAY=86400000;
export const INTERVALS=[600000,DAY,3*DAY,7*DAY,14*DAY,30*DAY,45*DAY];
export const dateKey=(ms=Date.now())=>{const d=new Date(ms);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const dayNumber=s=>{const [y,m,d]=s.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/DAY);};
export function initialState(now=Date.now()){return {version:1,start:dateKey(now),daily:1,progress:{},history:[],drafts:{},overrides:{},theme:'paper'};}
export function ordered(essays,state){const small=essays.filter(e=>e.kind==='short'&&!e.optional&&(e.available||state.overrides[e.id]));const large=essays.filter(e=>e.kind==='long'&&!e.optional&&(e.available||state.overrides[e.id]));const result=[];for(let i=0;i<Math.max(small.length,large.length);i++){if(small[i])result.push(small[i]);if(large[i])result.push(large[i]);}return result;}
export function tasks(essays,state,now=Date.now()){
 const order=ordered(essays,state);const elapsed=dayNumber(dateKey(now))-dayNumber(state.start);
 const due=[...order,...essays.filter(e=>e.optional&&state.progress[e.id])].filter(e=>state.progress[e.id]&&state.progress[e.id].due<=now).sort((a,b)=>state.progress[a.id].due-state.progress[b.id].due);
 const learnedToday=order.filter(e=>state.progress[e.id]&&dateKey(state.progress[e.id].first)===dateKey(now)).length;
 const released=order.slice(0,Math.max(0,(elapsed+1)*state.daily));
 const fresh=due.filter(e=>e.kind!=='phrase').length>8?[]:released.filter(e=>!state.progress[e.id]).slice(0,Math.max(0,state.daily-learnedToday));
 const later=[...order,...essays.filter(e=>e.optional&&state.progress[e.id])].filter(e=>state.progress[e.id]&&state.progress[e.id].due>now&&dateKey(state.progress[e.id].due)===dateKey(now));
 return {due,fresh,later,learnedToday,order};
}
export function review(state,id,rating,now=Date.now()){
 if(!['again','hard','good'].includes(rating))throw new Error('Invalid rating');
 const next=JSON.parse(JSON.stringify(state));const prev=next.progress[id];let stage,due;
 if(!prev||rating==='again'){stage=0;due=now+INTERVALS[0];}
 else if(rating==='hard'){stage=Math.max(0,prev.stage-1);due=now+DAY;}
 else{stage=Math.min(6,prev.stage+1);due=now+INTERVALS[stage];}
 next.progress[id]={stage,due,first:prev?.first??now,last:now,reviews:(prev?.reviews||0)+1};
 next.history.push({id,rating,at:now});next.history=next.history.slice(-5000);return next;
}
export function importState(value,ids){
 if(!value||value.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(value.start)||!Number.isFinite(dayNumber(value.start))||dateKey(new Date(value.start+'T12:00:00').getTime())!==value.start||![1,2].includes(value.daily))throw new Error('备份格式不正确');
 const result=initialState();result.start=value.start;result.daily=value.daily;result.theme=['paper','dark'].includes(value.theme)?value.theme:'paper';
 for(const [id,p] of Object.entries(value.progress||{})){if(!ids.includes(id)||!Number.isInteger(p.stage)||p.stage<0||p.stage>6||![p.due,p.first,p.last].every(Number.isFinite))throw new Error('复习记录格式不正确');result.progress[id]={stage:p.stage,due:p.due,first:p.first,last:p.last,reviews:Number.isFinite(p.reviews)?p.reviews:0};}
 result.history=(value.history||[]).filter(h=>ids.includes(h.id)&&Number.isFinite(h.at)&&['again','hard','good'].includes(h.rating)).slice(-5000);
 for(const field of ['drafts','overrides'])for(const [id,text] of Object.entries(value[field]||{})){if(ids.includes(id)&&typeof text==='string'&&text.length<40000)result[field][id]=text;}
 return result;
}
