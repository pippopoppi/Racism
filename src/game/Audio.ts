import type { Car } from './Physics';
export class GameAudio {
  enabled=true;
  private ctx:AudioContext|null=null;
  private motors:{osc:OscillatorNode;gain:GainNode}[]=[];
  async activate():Promise<void>{
    if(!this.ctx){
      this.ctx=new AudioContext();
      for(let i=0;i<4;i++){
        const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='sawtooth';osc.frequency.value=65;gain.gain.value=0;
        osc.connect(gain);gain.connect(this.ctx.destination);osc.start();this.motors.push({osc,gain});
      }
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  update(cars:Car[]):void {
    if(!this.ctx)return;const now=this.ctx.currentTime;
    this.motors.forEach((m,i)=>{const car=cars[i];m.osc.frequency.setTargetAtTime(car?65+car.speed*90:65,now,.025);
      m.gain.gain.setTargetAtTime(this.enabled&&car&&!car.derailed&&car.speed>.01 ? Math.min(.018, .004+car.throttle*.012) : 0,now,.055);});
  }
  beep(freq:number,duration=.12,type:OscillatorType='sine'):void {
    if(!this.enabled||!this.ctx)return;
    const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;
    g.gain.value=.045;o.connect(g);g.connect(ctx.destination);
    const t=ctx.currentTime;o.start(t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.stop(t+duration+.01);
  }
  stop():void {this.motors.forEach(m=>{if(this.ctx)m.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.05);});}
}
