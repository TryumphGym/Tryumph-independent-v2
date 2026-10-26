import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
type Campaign={id:string;title:string;creative_url:string;destination_url:string};
export function WaterBreakSponsor({onComplete}:{onComplete?:()=>void}){
 const [campaign,setCampaign]=useState<Campaign|null>(null);
 useEffect(()=>{let active=true;void supabase.from('water_break_campaigns').select('id,title,creative_url,destination_url').limit(1).then(({data})=>{if(active)setCampaign((data?.[0] as Campaign|undefined)??null);});return()=>{active=false;};},[]);
 return <div className="text-center">{campaign?<><p className="text-xs uppercase tracking-wide">Sponsored water break</p><a href={campaign.destination_url} target="_blank" rel="noopener noreferrer" onClick={onComplete}><img src={campaign.creative_url} alt={campaign.title} className="mx-auto max-h-40 max-w-full object-contain"/></a><p className="text-sm">{campaign.title}</p></>:<p className="text-sm">Hydrate and get ready to continue.</p>}</div>;
}
