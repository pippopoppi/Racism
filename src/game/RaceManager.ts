import { COLORS, type TrackGeometry } from './Track';
import { type Car,createCar,integrateCar } from './Physics';
export type Mode='quick'|'time';
export type RaceState='countdown'|'running'|'paused'|'finished';
export type RaceConfig={mode:Mode;playerCount:number;names:string[];laps:number;track:TrackGeometry};
export type RaceEvent={kind:'beep'|'start'|'lap'|'derail'|'recover'|'finish';player?:number};
export class RaceManager {
  readonly config:RaceConfig;
  cars:Car[]=[];
  state:RaceState='countdown';
  clock=0;
  countdown=3.4;
  finishCount=0;
  readonly events:RaceEvent[]=[];
  constructor(config:RaceConfig){
    this.config=config;
    for(let p=0;p<config.playerCount;p++){
      this.cars.push(createCar(p,config.names[p]||`Pilota ${p+1}`,COLORS[p],p));
    }
  }
  update(dt:number,inputs:number[]):void {
    if(this.state==='paused'||this.state==='finished')return;
    if(this.state==='countdown'){
      const old=Math.ceil(this.countdown);
      this.countdown-=dt;
      if(this.countdown<=0){this.countdown=0;this.state='running';this.events.push({kind:'start'});}
      else if(Math.ceil(this.countdown)!==old && this.countdown<3.05)this.events.push({kind:'beep'});
      return;
    }
    this.clock+=dt;
    for(const c of this.cars){
      const event=integrateCar(c,this.config.track.lanes[c.lane],inputs[c.player]||0,dt,this.clock);
      if(event)this.events.push({kind:event,player:c.player});
      if(event==='lap'&&this.config.mode==='quick'&&c.completedLaps>=this.config.laps){
        c.finished=true;c.speed=0;c.finishOrder=++this.finishCount;
        this.events.push({kind:'finish',player:c.player});
      }
    }
    if(this.config.mode==='quick'&&this.finishCount===this.cars.length)this.state='finished';
  }
  togglePause():void {if(this.state==='paused')this.state='running';else if(this.state==='running')this.state='paused';}
  standings():Car[]{
    return [...this.cars].sort((a,b)=>{
      if(a.finished&&b.finished)return a.finishOrder-b.finishOrder;
      if(a.finished)return -1;
      if(b.finished)return 1;
      return (b.completedLaps+b.distance/this.config.track.lanes[b.lane].length)-(a.completedLaps+a.distance/this.config.track.lanes[a.lane].length);
    });
  }
}
export function formatTime(n:number|null):string {if(n===null)return '—';const mins=Math.floor(n/60);return `${String(mins).padStart(2,'0')}:${(n%60).toFixed(2).padStart(5,'0')}`;}
