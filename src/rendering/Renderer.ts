import { type TrackGeometry,type Point,sampleAt } from '../game/Track';
import { type Car } from '../game/Physics';
import { type RaceManager } from '../game/RaceManager';
export type View={scale:number;offsetX:number;offsetY:number};
const TAU=Math.PI*2;
export function fitView(t:TrackGeometry,width:number,height:number,pad=36):View {
  const {minX,minY,maxX,maxY}=t.bounds;
  const w=maxX-minX+t.data.lanes*t.data.laneWidth+42,h=maxY-minY+t.data.lanes*t.data.laneWidth+42;
  const s=Math.max(0.06,Math.min((width-pad*2)/Math.max(1,w),(height-pad*2)/Math.max(1,h)));
  return {scale:s,offsetX:width/2-((minX+maxX)/2)*s,offsetY:height/2-((minY+maxY)/2)*s};
}
export function screenToWorld(p:Point,view:View):Point{return {x:(p.x-view.offsetX)/view.scale,y:(p.y-view.offsetY)/view.scale};}
function trace(ctx:CanvasRenderingContext2D,pts:Point[]):void {if(!pts.length)return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();}
function strokeCenter(ctx:CanvasRenderingContext2D,t:TrackGeometry):void {trace(ctx,t.center);ctx.stroke();}
export class Renderer {
  private ctx:CanvasRenderingContext2D;
  width=0;height=0;dpr=1;
  constructor(readonly canvas:HTMLCanvasElement){const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas 2D non disponibile');this.ctx=ctx;this.resize();}
  resize():void {
    const r=this.canvas.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);
    this.width=w;this.height=h;this.dpr=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);
  }
  begin(view:View):void{
    const c=this.ctx;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.fillStyle='#152b2a';c.fillRect(0,0,this.width,this.height);
    c.strokeStyle='rgba(255,255,255,.027)';c.lineWidth=1;
    for(let x=0;x<this.width;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,this.height);c.stroke();}
    for(let y=0;y<this.height;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(this.width,y);c.stroke();}
    c.setTransform(view.scale*this.dpr,0,0,view.scale*this.dpr,view.offsetX*this.dpr,view.offsetY*this.dpr);
    c.lineJoin='round';c.lineCap='round';
  }
  drawTrack(t:TrackGeometry):void{
    const c=this.ctx,wide=t.data.lanes*t.data.laneWidth;
    c.save();c.lineCap='round';c.lineJoin='round';
    c.translate(3,5);c.strokeStyle='rgba(0,0,0,.48)';c.lineWidth=wide+14;strokeCenter(c,t);c.translate(-3,-5);
    c.strokeStyle='#090d13';c.lineWidth=wide+13;strokeCenter(c,t);
    c.strokeStyle='#778080';c.lineWidth=wide+7;strokeCenter(c,t);
    c.strokeStyle='#292d33';c.lineWidth=wide+1;strokeCenter(c,t);
    c.strokeStyle='#353a41';c.lineWidth=wide-7;strokeCenter(c,t);
    // Subtle longitudinal molded surface.
    for(let i=1;i<t.data.lanes;i++){
      const off=(i-t.data.lanes/2)*t.data.laneWidth;
      c.beginPath();
      t.center.forEach((p,j)=>{const x=p.x-Math.sin(p.angle)*off,y=p.y+Math.cos(p.angle)*off;j?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();
      c.strokeStyle='rgba(255,255,255,.10)';c.lineWidth=1.3;c.stroke();
    }
    for(const lane of t.lanes){
      c.strokeStyle='#05090e';c.lineWidth=5.1;if(lane.path)c.stroke(lane.path);else{trace(c,lane.samples);c.stroke();}
      c.strokeStyle='#4b4f55';c.lineWidth=1.1;if(lane.path)c.stroke(lane.path);else{trace(c,lane.samples);c.stroke();}
    }
    // Finish line: a miniature black-white checker stripe across the track.
    if(t.center.length){
      const p=t.center[0],a=p.angle+Math.PI/2,n=t.data.lanes*2,step=wide/n;
      for(let i=0;i<n;i++){
        c.save();c.translate(p.x+Math.cos(a)*(-wide/2+(i+.5)*step),p.y+Math.sin(a)*(-wide/2+(i+.5)*step));
        c.rotate(p.angle);c.fillStyle=i%2?'#f0eee8':'#101319';c.fillRect(-4,-step/2,8,step);c.restore();
      }
    }
    c.restore();
  }
  car(car:Car,t:TrackGeometry,alpha=1):void {
    const c=this.ctx,lane=t.lanes[car.lane];
    let p=sampleAt(lane,car.distance);
    if(!car.derailed&&!car.finished){
      let delta=car.distance-car.prevDistance;
      if(delta < -lane.length/2)delta+=lane.length;
      p=sampleAt(lane,car.prevDistance+delta*alpha);
    }
    if(car.derailed&&car.derailPose){
      const d=car.derailPose.elapsed,side=car.lane%2?1:-1;
      p={...p,x:car.derailPose.x+Math.cos(car.derailPose.angle)*Math.min(d,.35)*75-Math.sin(car.derailPose.angle)*side*Math.min(d,.35)*50,
        y:car.derailPose.y+Math.sin(car.derailPose.angle)*Math.min(d,.35)*75+Math.cos(car.derailPose.angle)*side*Math.min(d,.35)*50,
        angle:car.derailPose.angle+side*Math.min(d,.6)*2.7};
    }
    c.save();c.translate(p.x,p.y);c.rotate(p.angle);
    c.globalAlpha=car.derailed?0.78:1;
    // Car faces along +x, top-down coupe silhouette, ~1:32 proportions.
    c.fillStyle='rgba(0,0,0,.6)';c.beginPath();c.roundRect(-13,-8+2,26,16,4);c.fill();
    c.fillStyle='#0b1016';for(const xx of [-9,8])for(const yy of [-8,8])c.fillRect(xx-3,yy-1,6,3);
    c.fillStyle=car.color;c.beginPath();c.moveTo(-14,-5);c.quadraticCurveTo(-12,-8,-8,-8);c.lineTo(8,-8);c.quadraticCurveTo(14,-7,14,-3);c.lineTo(14,3);c.quadraticCurveTo(14,7,8,8);c.lineTo(-8,8);c.quadraticCurveTo(-14,7,-14,5);c.closePath();c.fill();
    c.fillStyle='rgba(255,255,255,.23)';c.fillRect(-10,-6,19,2);
    c.fillStyle='#0f2032';c.beginPath();c.moveTo(-3,-5);c.lineTo(5,-5);c.lineTo(8,-3);c.lineTo(8,3);c.lineTo(5,5);c.lineTo(-3,5);c.closePath();c.fill();
    c.fillStyle='#a7cce0';c.fillRect(5,-4,1.5,8);
    c.fillStyle='#fff4b9';c.fillRect(12,-5,2.4,2);c.fillRect(12,3,2.4,2);
    c.fillStyle='#e43e3e';c.fillRect(-14,-5,1.8,2);c.fillRect(-14,3,1.8,2);
    c.fillStyle='rgba(0,0,0,.2)';c.fillRect(-9,-6,3,12);
    c.restore();
  }
  editorPoints(t:TrackGeometry,selected:number,hover:number,view:View):void{
    const c=this.ctx;
    const r=8/view.scale;
    t.data.points.forEach((p,i)=>{
      c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fillStyle=i===selected?'#ffd450':i===hover?'#83f4ea':'#f4f8ff';c.fill();
      c.strokeStyle='#111926';c.lineWidth=2/view.scale;c.stroke();
    });
  }
  render(t:TrackGeometry,view:View,cars:Car[]=[],alpha=1,editor?:{selected:number;hover:number}):void{
    this.begin(view);this.drawTrack(t);
    cars.forEach(car=>this.car(car,t,alpha));
    if(editor)this.editorPoints(t,editor.selected,editor.hover,view);
    if(!t.valid&&editor){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='rgba(255,90,100,.08)';c.fillRect(0,0,this.width,this.height);}
  }
}
