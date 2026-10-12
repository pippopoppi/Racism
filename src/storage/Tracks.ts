import { PRESETS,buildTrack,copyTrack, type TrackData } from '../game/Track';
const KEY='slotcars:tracks:v1';
export function savedTracks():TrackData[]{try{const data:unknown=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&Array.isArray(x.points)):[];}catch{return [];}}
export function allTracks():TrackData[]{return [...PRESETS,...savedTracks()];}
export function byId(id:string):TrackData {return copyTrack(allTracks().find(t=>t.id===id)||PRESETS[0]);}
export function putTrack(track:TrackData):void {
  const tracks=savedTracks(),i=tracks.findIndex(t=>t.id===track.id);
  if(i>=0)tracks[i]=copyTrack(track);else tracks.push(copyTrack(track));
  try{localStorage.setItem(KEY,JSON.stringify(tracks));}catch{throw new Error('Memoria locale piena o non disponibile.');}
}
export function deleteTrack(id:string):void {localStorage.setItem(KEY,JSON.stringify(savedTracks().filter(t=>t.id!==id)));}
export function importTrack(raw:unknown):TrackData {
  if(typeof raw!=='object'||!raw)throw new Error('File JSON non riconosciuto.');
  const o=raw as Partial<TrackData>;
  if(!Array.isArray(o.points)||o.points.length<4||o.points.length>35)throw new Error('Punti di controllo non validi.');
  const data:TrackData={
    id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    name:String(o.name||'Pista importata').slice(0,48),
    points:o.points.map(p=>({x:Number(p.x),y:Number(p.y)})),
    lanes:Number(o.lanes||2),laneWidth:Number(o.laneWidth||24),created:Date.now()
  };
  const g=buildTrack(data);if(!g.valid)throw new Error(`Geometria non valida: ${g.reason}`);
  return data;
}
export function bestKey(id:string):string{return 'slotcars:pb:'+id;}
export function getBest(id:string):number|null{try{const x=Number(localStorage.getItem(bestKey(id)));return Number.isFinite(x)&&x>0?x:null;}catch{return null;}}
export function saveBest(id:string,best:number):boolean{const old=getBest(id);if(old!==null&&best>=old)return false;try{localStorage.setItem(bestKey(id),String(best));}catch{}return true;}
export function getBindings():string[]{try{const a=JSON.parse(localStorage.getItem('slotcars:keys')||'null') as unknown;return Array.isArray(a)&&a.length===4&&a.every(k=>typeof k==='string')?a:['KeyA','KeyL','KeyV','ArrowUp'];}catch{return ['KeyA','KeyL','KeyV','ArrowUp'];}}
export function saveBindings(a:string[]):void{localStorage.setItem('slotcars:keys',JSON.stringify(a));}
