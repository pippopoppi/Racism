import {describe,it,expect} from 'vitest';
import {buildTrack,PRESETS,type Lane} from '../src/game/Track';
import {createCar,integrateCar,PHYSICS} from '../src/game/Physics';
import {RaceManager} from '../src/game/RaceManager';
const straightLane:Lane={length:1000,path:null,samples:Array.from({length:10},(_,i)=>({x:i*100,y:0,s:i*100,angle:0,curvature:0}))};
const tightLane:Lane={...straightLane,samples:straightLane.samples.map(p=>({...p,curvature:0.1}))};
describe('slotcar dynamics',()=>{
  it('accelerates gradually, then brakes after releasing the throttle',()=>{
    const c=createCar(0,'P1','#f00',0);for(let i=0;i<45;i++)integrateCar(c,straightLane,1,1/120,i/120);
    const v=c.speed;expect(v).toBeGreaterThan(0);expect(v).toBeLessThan(PHYSICS.noLoadSpeed);
    for(let i=0;i<30;i++)integrateCar(c,straightLane,0,1/120,1+i/120);
    expect(c.speed).toBeLessThan(v);
  });
  it('is deterministic with identical step sequences',()=>{
    const a=createCar(0,'A','#fff',0),b=createCar(0,'B','#fff',0);
    for(let i=0;i<300;i++){
      const t=i<180?0.75:0.1;
      integrateCar(a,straightLane,t,1/120,i/120);integrateCar(b,straightLane,t,1/120,i/120);
    }
    expect(a.distance).toBe(b.distance);expect(a.speed).toBe(b.speed);
  });
  it('derails under excess lateral acceleration, recovers at last attached location, stationary',()=>{
    const c=createCar(0,'P','#f00',0);c.speed=4;c.distance=213;c.lastAttached=213;
    expect(integrateCar(c,tightLane,1,1/120,1)).toBe('derail');
    expect(c.derailed).toBe(true);expect(c.distance).toBe(213);
    let recovered=false;
    for(let i=0;i<180;i++){if(integrateCar(c,tightLane,1,1/120,1+i/120)==='recover'){recovered=true;break;}}
    expect(recovered).toBe(true);expect(c.derailed).toBe(false);expect(c.distance).toBe(213);expect(c.speed).toBe(0);
  });
  it('counts laps when crossing a lane boundary',()=>{
    const c=createCar(0,'P','#f00',0);c.distance=999;c.prevDistance=999;c.lapStartTime=0;c.speed=3;
    expect(integrateCar(c,straightLane,1,1/120,4)).toBe('lap');
    expect(c.completedLaps).toBe(1);expect(c.lastLap).toBe(4);expect(c.distance).toBeGreaterThanOrEqual(0);
  });
  it('quick races count down and can be paused',()=>{
    const race=new RaceManager({mode:'quick',playerCount:2,names:['A','B'],laps:3,track:buildTrack(PRESETS[0])});
    expect(race.state).toBe('countdown');race.update(3.5,[0,0]);expect(race.state).toBe('running');
    race.togglePause();expect(race.state).toBe('paused');race.update(1,[1,1]);expect(race.clock).toBe(0);
  });
});
