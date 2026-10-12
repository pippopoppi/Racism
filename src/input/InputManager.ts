import { getBindings,saveBindings } from '../storage/Tracks';
export class InputManager {
  bindings=getBindings();
  keySet=new Set<string>();
  touch=[0,0,0,0];
  gamepads=[-1,-1,-1,-1];
  listening=-1;
  onRebind: (()=>void)|null=null;
  constructor(){
    window.addEventListener('keydown',e=>{
      if(this.listening>=0){e.preventDefault();this.bindings[this.listening]=e.code;saveBindings(this.bindings);this.listening=-1;this.onRebind?.();return;}
      if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName))return;
      if(this.bindings.includes(e.code)){e.preventDefault();this.keySet.add(e.code);}
    });
    window.addEventListener('keyup',e=>this.keySet.delete(e.code));
    window.addEventListener('blur',()=>{this.keySet.clear();this.touch.fill(0);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.keySet.clear();this.touch.fill(0);}});
  }
  assignPad(player:number,index:number):void {this.gamepads[player]=index;}
  read(player:number):number {
    let value=Math.max(this.keySet.has(this.bindings[player])?1:0,this.touch[player]);
    const i=this.gamepads[player];
    if(i>=0&&navigator.getGamepads){const pad=navigator.getGamepads()[i];if(pad){
      const trigger=Math.max(pad.buttons[7]?.value||0,pad.buttons[0]?.value||0);
      const stick=Math.max(0,-(pad.axes[1]||0));
      value=Math.max(value,trigger,stick);
    }}
    return Math.max(0,Math.min(1,value));
  }
}
