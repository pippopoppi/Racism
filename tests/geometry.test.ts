import {describe,it,expect} from 'vitest';
import {PRESETS,buildTrack,sampleAt,copyTrack} from '../src/game/Track';
describe('track geometry',()=>{
  it('all three presets are valid with parallel lanes',()=>{
    for(const t of PRESETS){const g=buildTrack(t);expect(g.valid,g.reason+' ('+t.name+')').toBe(true);expect(g.lanes).toHaveLength(t.lanes);expect(g.lanes.every(l=>l.length>100)).toBe(true);}
  });
  it('the interpolated lane starts and ends at the same place',()=>{
    const lane=buildTrack(PRESETS[0]).lanes[0],a=sampleAt(lane,0),b=sampleAt(lane,lane.length);
    expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(0.001);
  });
  it('rejects invalid geometry and invalid lane count',()=>{
    const bad=copyTrack(PRESETS[0]);bad.lanes=5;expect(buildTrack(bad).valid).toBe(false);
    bad.lanes=2;bad.points[1]={...bad.points[0]};expect(buildTrack(bad).valid).toBe(false);
  });
});
