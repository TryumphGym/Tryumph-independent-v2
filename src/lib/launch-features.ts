export type StoreItem = { id: string; trainer_id: string; title: string; description: string; price_cents: number; image_url: string | null; external_url: string; item_type: 'product'|'affiliate'|'external_store'; published: boolean };
export type Program = { id: string; trainer_id: string; title: string; description: string; published: boolean };
export type ProgramWorkout = { program_id: string; video_id: string; position: number };
export function safeExternalUrl(value: string): boolean {
 try { const u=new URL(value);return u.protocol==='https:' && !!u.hostname && !['localhost','127.0.0.1'].includes(u.hostname); } catch {return false;}
}
export function validStoreItem(title:string,link:string,price:number):string|null {
 if(!title.trim()||title.length>160) return 'Enter a product title (up to 160 characters).';
 if(!safeExternalUrl(link)) return 'An HTTPS purchase or affiliate link is required.';
 if(!Number.isFinite(price)||price<0) return 'Enter a valid nonnegative price.';
 return null;
}
