import { PX_PER_M, type Lane, sampleAt } from './Track';

export const PHYSICS = Object.freeze({
  mass: 0.085,                  // kg (1:32 slot car with magnet/guide)
  motorForce: 0.64,            // N stall tractive force
  noLoadSpeed: 5.2,            // m/s
  drag: 0.020,                 // N / (m/s)^2
  rollingForce: 0.030,         // N
  electricBrake: 0.26,        // N / (m/s) when trigger released
  lateralLimit: 9.5,          // m/s²: simplified grip + guide retention
  recoveryDuration: 1.35,     // s
});
export type Car = {
  player: number;
  name: string;
  color: string;
  lane: number;
  distance: number;   // track-space px within lap
  prevDistance: number;
  lastAttached: number;
  speed: number;      // m/s
  throttle: number;   // [0,1]
  completedLaps: number;
  lapStartTime: number;
  lastLap: number | null;
  bestLap: number | null;
  lapHistory: number[];
  derailed: boolean;
  recovery: number;
  derailPose: { x:number;y:number;angle:number;elapsed:number } | null;
  finished: boolean;
  finishOrder: number;
};
export function createCar(player:number,name:string,color:string,lane:number):Car {
  return { player,name,color,lane,distance:0,prevDistance:0,lastAttached:0,speed:0,throttle:0,completedLaps:0,lapStartTime:0,lastLap:null,bestLap:null,lapHistory:[],derailed:false,recovery:0,derailPose:null,finished:false,finishOrder:0 };
}
export type PhysicsEvent = 'derail' | 'recover' | 'lap';

export function integrateCar(car:Car,lane:Lane,throttle:number,dt:number,clock:number):PhysicsEvent|null {
  car.prevDistance=car.distance;
  car.throttle=Math.max(0,Math.min(1,throttle));
  if(car.finished) {car.throttle=0;car.speed=0;return null;}
  if(car.derailed){
    car.recovery-=dt;
    if(car.derailPose)car.derailPose.elapsed+=dt;
    car.speed=0; car.throttle=0;
    if(car.recovery<=0){
      car.derailed=false;car.recovery=0;car.derailPose=null;
      car.distance=car.lastAttached;car.prevDistance=car.distance;
      return 'recover';
    }
    return null;
  }
  const p=PHYSICS;
  const motor=p.motorForce*car.throttle*Math.max(0,1-car.speed/p.noLoadSpeed);
  const resistance=car.speed>0.001 ? p.rollingForce+p.drag*car.speed*car.speed : 0;
  const braking=p.electricBrake*(1-car.throttle);
  const force=motor-resistance-braking;
  car.speed=Math.max(0,Math.min(p.noLoadSpeed,car.speed+force/p.mass*dt));
  const advance=car.speed*PX_PER_M*dt;
  const next=car.distance+advance;
  const newPoint=sampleAt(lane,next);
  const oldPoint=sampleAt(lane,car.distance);
  const critical=Math.max(Math.abs(newPoint.curvature),Math.abs(oldPoint.curvature))*PX_PER_M*car.speed*car.speed;
  if(critical>p.lateralLimit) {
    // Car never gains distance on derail. Leave the slot tangentially for rendering.
    car.derailPose={x:oldPoint.x,y:oldPoint.y,angle:oldPoint.angle,elapsed:0};
    car.derailed=true;
    car.recovery=p.recoveryDuration;
    car.lastAttached=car.distance;
    car.speed=0;
    return 'derail';
  }
  car.lastAttached=car.distance;
  if(next>=lane.length){
    car.distance=next%lane.length;
    car.completedLaps+=Math.floor(next/lane.length);
    const lapDuration=clock-car.lapStartTime;
    // Clock only advances during actual racing, not during countdown.
    if(lapDuration>0.01){
      car.lastLap=lapDuration;
      car.bestLap=car.bestLap===null?lapDuration:Math.min(car.bestLap,lapDuration);
      car.lapHistory.push(lapDuration);
    }
    car.lapStartTime=clock;
    car.prevDistance=car.distance;
    return 'lap';
  }
  car.distance=next;
  return null;
}
