import type { InputManager } from './InputManager';
import { COLORS } from '../game/Track';
export class TouchControls {
  private active=new Map<number,number>();
  constructor(readonly el:HTMLElement,readonly input:InputManager,players:number,names:string[]){
    el.replaceChildren();el.style.setProperty('--player-count',String(players));
    for(let p=0;p<players;p++){
      const pad=document.createElement('div');pad.className='throttle-pad';pad.style.setProperty('--driver-color',COLORS[p]);
      pad.innerHTML=`<div class="throttle-fill"></div><div class="throttle-top"><b>${escapeHtml(names[p]||`P${p+1}`)}</b><span class="throttle-value">0%</span></div><span class="throttle-hint">TRIGGER · ↑ PIÙ GAS</span>`;
      const change=(event:PointerEvent)=>{
        const rect=pad.getBoundingClientRect();
        const val=Math.max(0,Math.min(1,1-(event.clientY-rect.top)/rect.height));
        this.input.touch[p]=val;
        (pad.querySelector('.throttle-value') as HTMLElement).textContent=Math.round(val*100)+'%';
        (pad.querySelector('.throttle-fill') as HTMLElement).style.height=(val*100)+'%';
        pad.classList.toggle('pressed',val>0);
      };
      pad.addEventListener('pointerdown',e=>{
        e.preventDefault();if(this.active.has(p))return;
        this.active.set(p,e.pointerId);pad.setPointerCapture(e.pointerId);change(e);
      });
      pad.addEventListener('pointermove',e=>{if(this.active.get(p)===e.pointerId){e.preventDefault();change(e);}});
      const clear=(e:PointerEvent)=>{
        if(this.active.get(p)!==e.pointerId)return;this.active.delete(p);this.input.touch[p]=0;
        (pad.querySelector('.throttle-value') as HTMLElement).textContent='0%';
        (pad.querySelector('.throttle-fill') as HTMLElement).style.height='0%';pad.classList.remove('pressed');
      };
      pad.addEventListener('pointerup',clear);pad.addEventListener('pointercancel',clear);pad.addEventListener('lostpointercapture',clear);
      el.append(pad);
    }
  }
  dispose():void{this.el.replaceChildren();this.input.touch.fill(0);this.active.clear();}
}
function escapeHtml(s:string):string{return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
