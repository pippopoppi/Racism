import { buildTrack,copyTrack,type TrackData,type TrackGeometry,type Point } from '../game/Track';
import { fitView,screenToWorld,type View } from '../rendering/Renderer';
export type Tool='move'|'add'|'remove';
type Gesture={startGap:number;startMid:Point;worldMid:Point;startScale:number};
export class TrackEditor {
  data:TrackData;
  geometry:TrackGeometry;
  view:View;
  tool:Tool='move';
  selected=-1;hover=-1;
  private history:TrackData[]=[];
  private future:TrackData[]=[];
  private dragPointer:number|null=null;
  private moved=false;
  private pointers=new Map<number,Point>();
  private gesture:Gesture|null=null;
  onChange:()=>void=()=>{};
  constructor(readonly canvas:HTMLCanvasElement,track:TrackData){
    this.data=copyTrack(track);this.geometry=buildTrack(this.data);
    this.view=fitView(this.geometry,canvas.clientWidth||800,canvas.clientHeight||600,48);
    canvas.addEventListener('pointerdown',this.pointerDown);
    canvas.addEventListener('pointermove',this.pointerMove);
    canvas.addEventListener('pointerup',this.pointerUp);
    canvas.addEventListener('pointercancel',this.pointerUp);
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',this.wheel,{passive:false});
    window.addEventListener('keydown',this.keyboard);
  }
  dispose():void{
    this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);
    this.canvas.removeEventListener('pointerup',this.pointerUp);this.canvas.removeEventListener('pointercancel',this.pointerUp);
    this.canvas.removeEventListener('wheel',this.wheel);window.removeEventListener('keydown',this.keyboard);
  }
  private keyboard=(e:KeyboardEvent)=>{
    if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?this.redo():this.undo();}
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();this.redo();}
    if(e.code==='Delete'&&this.selected>=0){this.removePoint(this.selected);}
  };
  private point(e:PointerEvent|WheelEvent):Point {const rect=this.canvas.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
  private closest(p:Point):number{
    let best=-1,dist=20;
    this.data.points.forEach((control,i)=>{const q={x:control.x*this.view.scale+this.view.offsetX,y:control.y*this.view.scale+this.view.offsetY};const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist){best=i;dist=d;}});
    return best;
  }
  private saveUndo():void{this.history.push(copyTrack(this.data));if(this.history.length>45)this.history.shift();this.future=[];}
  private changed():void{this.geometry=buildTrack(this.data);this.onChange();}
  undo():void{if(!this.history.length)return;this.future.push(copyTrack(this.data));this.data=this.history.pop()!;this.selected=-1;this.changed();}
  redo():void{if(!this.future.length)return;this.history.push(copyTrack(this.data));this.data=this.future.pop()!;this.selected=-1;this.changed();}
  setLaneCount(n:number):void{if(n===this.data.lanes)return;this.saveUndo();this.data.lanes=n;this.changed();}
  setTool(tool:Tool):void{this.tool=tool;this.selected=-1;this.onChange();}
  reset(track:TrackData):void{this.saveUndo();this.data=copyTrack(track);this.selected=-1;this.geometry=buildTrack(this.data);this.fit();this.onChange();}
  fit():void{this.view=fitView(this.geometry,this.canvas.clientWidth,this.canvas.clientHeight,48);this.onChange();}
  private addPoint(p:Point):void {
    if(this.data.points.length>=35)return;
    const point=screenToWorld(p,this.view),ps=this.data.points;
    // Insert next to nearest polyline control edge, preserving control order.
    let idx=0,shortest=Infinity;
    for(let i=0;i<ps.length;i++){
      const a=ps[i],b=ps[(i+1)%ps.length],dx=b.x-a.x,dy=b.y-a.y;
      const u=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      const d=Math.hypot(point.x-(a.x+u*dx),point.y-(a.y+u*dy));
      if(d<shortest){shortest=d;idx=i+1;}
    }
    this.saveUndo();ps.splice(idx,0,point);this.selected=idx;this.changed();
  }
  removePoint(i:number):void{if(this.data.points.length<=4)return;this.saveUndo();this.data.points.splice(i,1);this.selected=-1;this.changed();}
  private pointerDown=(e:PointerEvent)=>{
    e.preventDefault();this.canvas.setPointerCapture(e.pointerId);
    const p=this.point(e);this.pointers.set(e.pointerId,p);
    if(this.pointers.size===2){
      this.dragPointer=null;
      // Commit a pending point drag before changing to a pinch gesture.
      const [a,b]=[...this.pointers.values()];
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      this.gesture={startGap:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),startMid:mid,worldMid:screenToWorld(mid,this.view),startScale:this.view.scale};
      return;
    }
    if(e.button===2||e.button===1||e.altKey){this.dragPointer=-2;this.moved=false;return;}
    const hit=this.closest(p);this.selected=hit;
    if(this.tool==='remove'){if(hit>=0)this.removePoint(hit);return;}
    if(this.tool==='add'){this.addPoint(p);this.dragPointer=e.pointerId;return;}
    if(hit>=0){this.saveUndo();this.dragPointer=e.pointerId;this.moved=false;}
    else this.dragPointer=-2; // drag empty area to pan
    this.onChange();
  };
  private pointerMove=(e:PointerEvent)=>{
    const p=this.point(e),old=this.pointers.get(e.pointerId);
    if(!old){this.hover=this.closest(p);return;}
    this.pointers.set(e.pointerId,p);
    if(this.pointers.size===2&&this.gesture){
      const [a,b]=[...this.pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const ratio=Math.hypot(a.x-b.x,a.y-b.y)/this.gesture.startGap;
      const scale=Math.max(.12,Math.min(5,this.gesture.startScale*ratio));
      this.view={scale,offsetX:mid.x-this.gesture.worldMid.x*scale,offsetY:mid.y-this.gesture.worldMid.y*scale};
      this.onChange();return;
    }
    if(this.dragPointer===e.pointerId&&this.selected>=0){
      const q=screenToWorld(p,this.view);
      this.data.points[this.selected]={x:q.x,y:q.y};this.moved=true;this.changed();
    }else if(this.dragPointer===-2){
      this.view.offsetX+=p.x-old.x;this.view.offsetY+=p.y-old.y;this.moved=true;this.onChange();
    }else{this.hover=this.closest(p);this.onChange();}
  };
  private pointerUp=(e:PointerEvent)=>{
    this.pointers.delete(e.pointerId);
    if(this.pointers.size<2)this.gesture=null;
    if(this.pointers.size===0){this.dragPointer=null;this.moved=false;}
  };
  private wheel=(e:WheelEvent)=>{
    e.preventDefault();const p=this.point(e),world=screenToWorld(p,this.view);
    const scale=Math.max(.12,Math.min(5,this.view.scale*Math.exp(-e.deltaY*.0015)));
    this.view={scale,offsetX:p.x-world.x*scale,offsetY:p.y-world.y*scale};this.onChange();
  };
}
