import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeExternalUrl, validStoreItem, type StoreItem, type Program } from '@/lib/launch-features';

export function TrainerStoreManager() {
 const [me,setMe]=useState<string|null>(null);
 const [items,setItems]=useState<StoreItem[]>([]);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[price,setPrice]=useState(''),[link,setLink]=useState(''),[image,setImage]=useState('');
 const [kind,setKind]=useState<StoreItem['item_type']>('product');
 const [busy,setBusy]=useState(false);
 const reload=async(id:string)=>{const {data,error}=await supabase.from('trainer_store_items').select('*').eq('trainer_id',id).order('created_at',{ascending:false});if(error)toast.error(error.message);else setItems((data??[]) as StoreItem[]);};
 useEffect(()=>{void supabase.auth.getUser().then(({data})=>{const id=data.user?.id??null;setMe(id);if(id)void reload(id);});},[]);
 const save=async()=>{
  if(!me)return toast.error('Sign in as a trainer first.');
  const amount=Number(price||0);const problem=validStoreItem(title,link,amount);if(problem)return toast.error(problem);
  if(image&&!safeExternalUrl(image))return toast.error('Image URL must use HTTPS.');
  setBusy(true);
  const {error}=await supabase.from('trainer_store_items').insert({trainer_id:me,title:title.trim(),description:description.trim(),price_cents:Math.round(amount*100),external_url:link.trim(),image_url:image.trim()||null,item_type:kind,published:true});
  setBusy(false);if(error)return toast.error(error.message);
  setTitle('');setDescription('');setPrice('');setLink('');setImage('');void reload(me);
 };
 const remove=async(id:string)=>{if(!me)return;const {error}=await supabase.from('trainer_store_items').delete().eq('id',id).eq('trainer_id',me);if(error)toast.error(error.message);else void reload(me);};
 return <section className="card space-y-3 p-6"><h2 className="text-xl font-bold">Your Trybe Store</h2><p className="text-sm text-muted-foreground">Your affiliate and independent store earnings are 100% yours. Tryumph does not process these sales.</p>
 <select className="field" value={kind} onChange={e=>setKind(e.target.value as StoreItem['item_type'])}><option value="product">Product</option><option value="affiliate">Affiliate link</option><option value="external_store">Independent store / Shopify</option></select>
 <input className="field" placeholder="Name" value={title} onChange={e=>setTitle(e.target.value)}/>
 <textarea className="field" placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)}/>
 <input className="field" type="number" min="0" step="0.01" placeholder="Price in dollars (optional)" value={price} onChange={e=>setPrice(e.target.value)}/>
 <input className="field" type="url" placeholder="https://your-store-or-affiliate-link" value={link} onChange={e=>setLink(e.target.value)}/>
 <input className="field" type="url" placeholder="https://image-url (optional)" value={image} onChange={e=>setImage(e.target.value)}/>
 <button className="btn btn-primary" disabled={busy} onClick={()=>void save()}>Publish listing</button>
 <ul className="space-y-2">{items.map(item=><li key={item.id} className="flex items-center gap-3 rounded-lg border p-3">{item.image_url&&<img src={item.image_url} alt="" className="h-14 w-14 object-cover"/>}<span className="flex-1"><strong>{item.title}</strong><span className="block text-xs">${(item.price_cents/100).toFixed(2)} · {item.item_type}</span></span><a href={item.external_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">View</a><button onClick={()=>void remove(item.id)} className="text-destructive">Remove</button></li>)}</ul></section>;
}

export function TrainerProgramManager(){
 const [me,setMe]=useState<string|null>(null),[programs,setPrograms]=useState<Program[]>([]),[videos,setVideos]=useState<{id:string;title:string}[]>([]);
 const [title,setTitle]=useState(''),[selected,setSelected]=useState(''),[chosen,setChosen]=useState<string[]>([]);
 const load=async(id:string)=>{const [p,v]=await Promise.all([supabase.from('trainer_programs').select('*').eq('trainer_id',id),supabase.from('trainer_videos').select('id,title').eq('user_id',id).eq('review_status','approved')]);setPrograms((p.data??[]) as Program[]);setVideos(v.data??[]);};
 useEffect(()=>{void supabase.auth.getUser().then(({data})=>{const id=data.user?.id??null;setMe(id);if(id)void load(id);});},[]);
 const create=async()=>{if(!me||!title.trim())return;const {error}=await supabase.from('trainer_programs').insert({trainer_id:me,title:title.trim(),description:'',published:false});if(error)toast.error(error.message);else {setTitle('');void load(me);}};
 const add=async()=>{if(!selected||!me)return;const {data:rows,error:readError}=await supabase.from('trainer_program_workouts').select('video_id,position').eq('program_id',selected).order('position');if(readError)return toast.error(readError.message);const ids=new Set((rows??[]).map(r=>r.video_id));const fresh=chosen.filter(id=>!ids.has(id));if(!fresh.length)return;const {error}=await supabase.from('trainer_program_workouts').insert(fresh.map((id,i)=>({program_id:selected,video_id:id,position:(rows?.length??0)+i})));if(error)toast.error(error.message);else {toast.success('Workouts added in order');setChosen([]);}};
 const publish=async(p:Program)=>{const {error}=await supabase.from('trainer_programs').update({published:!p.published}).eq('id',p.id).eq('trainer_id',me!);if(error)toast.error(error.message);else if(me)void load(me);};
 return <section className="card space-y-3 p-6"><h2 className="text-xl font-bold">Ordered workout programs</h2><p className="text-sm text-muted-foreground">Build a program from your approved videos. Workouts are added in the order you select them.</p><div className="flex gap-2"><input className="field flex-1" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Program name"/><button className="btn btn-primary" onClick={()=>void create()}>Create</button></div>
 <select className="field" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose program</option>{programs.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
 {selected&&<><div className="space-y-2">{videos.map(v=><label key={v.id} className="flex gap-2"><input type="checkbox" checked={chosen.includes(v.id)} onChange={e=>setChosen(old=>e.target.checked?[...old,v.id]:old.filter(x=>x!==v.id))}/>{v.title}</label>)}</div><button className="btn btn-outline" onClick={()=>void add()}>Add selected in order</button></>}
 <ul>{programs.map(p=><li key={p.id} className="flex justify-between gap-3 py-2"><span>{p.title} · {p.published?'Published':'Draft'}</span><button className="text-primary underline" onClick={()=>void publish(p)}>{p.published?'Unpublish':'Publish'}</button></li>)}</ul></section>;
}
