export type Point = { x: number; y: number };
export type TrackData = {
  id: string;
  name: string;
  points: Point[];
  lanes: number;
  laneWidth: number;
  created: number;
};
export type Sample = Point & { s: number; angle: number; curvature: number };
export type Lane = { samples: Sample[]; length: number; path: Path2D | null };
export type TrackGeometry = {
  data: TrackData;
  center: Sample[];
  centerLength: number;
  lanes: Lane[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  valid: boolean;
  reason: string;
};

export const COLORS = ['#ff5258', '#40a5ff', '#63df98', '#ffd450'];
export const PX_PER_M = 100;

const at = (p: Point[], i: number) => p[(i + p.length) % p.length];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cr = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

export function generateCenter(points: Point[], subdivisions = 24): Sample[] {
  const raw: Point[] = [];
  if (points.length < 3) return [];
  for (let j = 0; j < points.length; j++) {
    const p0 = at(points, j - 1), p1 = at(points, j), p2 = at(points, j + 1), p3 = at(points, j + 2);
    for (let k = 0; k < subdivisions; k++) {
      const t = k/subdivisions, t2=t*t, t3=t2*t;
      const interp = (a: number,b: number,c: number,d: number) => 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
      raw.push({ x: interp(p0.x,p1.x,p2.x,p3.x), y: interp(p0.y,p1.y,p2.y,p3.y) });
    }
  }
  return annotate(raw);
}

function annotate(raw: Point[]): Sample[] {
  const n = raw.length;
  if (n < 3) return [];
  let length = 0;
  return raw.map((p, i) => {
    if (i) length += distance(raw[i-1],p);
    const a=raw[(i-1+n)%n], b=raw[(i+1)%n];
    const da=distance(a,p), db=distance(p,b), dc=distance(a,b);
    const curvature = da*db*dc > 1e-9 ? 2*cr(a,p,b)/(da*db*dc) : 0;
    return { ...p, s:length, angle:Math.atan2(b.y-a.y,b.x-a.x), curvature };
  });
}
function closeLength(points: Point[]): number {
  if (!points.length) return 0;
  return distance(points[points.length-1],points[0]) + (points as Sample[])[points.length-1].s;
}
function lineCross(a: Point,b: Point,c: Point,d: Point): boolean {
  const x1=cr(a,b,c),x2=cr(a,b,d),y1=cr(c,d,a),y2=cr(c,d,b);
  return x1*x2 < -1e-5 && y1*y2 < -1e-5;
}
function segmentDistance(a: Point,b: Point,c: Point,d: Point): number {
  const sd=(p:Point,u:Point,v:Point) => {
    const dx=v.x-u.x,dy=v.y-u.y;
    const t=Math.max(0,Math.min(1,((p.x-u.x)*dx+(p.y-u.y)*dy)/(dx*dx+dy*dy || 1)));
    return Math.hypot(p.x-u.x-dx*t,p.y-u.y-dy*t);
  };
  return Math.min(sd(a,c,d),sd(b,c,d),sd(c,a,b),sd(d,a,b));
}
function validate(data: TrackData, center: Sample[]): string {
  if (data.points.length < 4) return 'Servono almeno 4 punti di controllo.';
  if (data.points.length > 35) return 'Troppi punti (massimo 35).';
  if (data.lanes < 2 || data.lanes > 4 || !Number.isInteger(data.lanes)) return 'Numero di corsie non valido.';
  if (!Number.isFinite(data.laneWidth) || data.laneWidth < 12 || data.laneWidth > 35) return 'Larghezza corsie non valida.';
  if (data.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>10000||Math.abs(p.y)>10000)) return 'Coordinate non valide.';
  if (data.points.some((p,i)=>distance(p, at(data.points,i+1)) < 38)) return 'Punti troppo vicini.';
  const total = closeLength(center), trackWidth=data.lanes*data.laneWidth;
  if (total < 550) return 'Pista troppo corta.';
  if (center.some(p=>Math.abs(p.curvature)*(data.lanes-1)*data.laneWidth*0.5 > 0.82)) return 'Curva troppo stretta per le corsie: allarga il raggio.';
  // Exclude near-neighbor segments. Other segments must not overlap the full road ribbon.
  const n=center.length, halfSamples=Math.max(3,Math.ceil(n/data.points.length)*2);
  for(let i=0;i<n;i+=2){
    const a=center[i],b=center[(i+1)%n];
    for(let j=i+halfSamples;j<n;j+=2){
      if (Math.min((j-i+n)%n,(i-j+n)%n) < halfSamples) continue;
      const c=center[j],d=center[(j+1)%n];
      if(lineCross(a,b,c,d)) return 'La pista si interseca.';
      if(segmentDistance(a,b,c,d) < trackWidth+8) return 'Due tratti di pista sono troppo vicini.';
    }
  }
  return '';
}

export function buildTrack(data: TrackData): TrackGeometry {
  const center=generateCenter(data.points);
  const centerLength=closeLength(center);
  const lanes: Lane[]=[];
  for(let l=0;l<data.lanes;l++){
    const off=(l-(data.lanes-1)/2)*data.laneWidth;
    const raw=center.map(p=>({ x:p.x-Math.sin(p.angle)*off, y:p.y+Math.cos(p.angle)*off }));
    const samples=annotate(raw);
    const path=typeof Path2D !== 'undefined' && samples.length ? new Path2D() : null;
    if(path){path.moveTo(samples[0].x,samples[0].y);for(const p of samples.slice(1))path.lineTo(p.x,p.y);path.closePath();}
    lanes.push({samples,length:closeLength(samples),path});
  }
  const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const p of center){bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);}
  const reason=validate(data,center);
  return {data,center,centerLength,lanes,bounds,valid:!reason,reason};
}
export function sampleAt(lane: Lane, s: number): Sample {
  const a=lane.samples, n=a.length;
  if(!n) return {x:0,y:0,s:0,angle:0,curvature:0};
  s=((s % lane.length)+lane.length)%lane.length;
  let lo=0,hi=n;
  while(lo<hi){const mid=(lo+hi)>>1;if(a[mid].s<=s)lo=mid+1;else hi=mid;}
  const i=Math.max(0,lo-1), j=(i+1)%n, first=a[i], second=a[j];
  const s0=first.s,s1=j===0?lane.length:second.s;
  const t=Math.max(0,Math.min(1,(s-s0)/(s1-s0||1)));
  const angle=Math.atan2(Math.sin(first.angle)*(1-t)+Math.sin(second.angle)*t,Math.cos(first.angle)*(1-t)+Math.cos(second.angle)*t);
  return {x:first.x+(second.x-first.x)*t,y:first.y+(second.y-first.y)*t,s,angle,curvature:first.curvature+(second.curvature-first.curvature)*t};
}
const make=(id:string,name:string,lanes:number,points:Point[]):TrackData=>({id,name,lanes,laneWidth:24,points,created:0});
export const PRESETS:TrackData[]=[
  make('oval','Ovale classico',4,[{x:250,y:180},{x:420,y:180},{x:560,y:270},{x:560,y:440},{x:420,y:530},{x:250,y:530},{x:110,y:440},{x:110,y:270}]),
  make('technical','Tecnico',4,[{x:110,y:250},{x:210,y:130},{x:360,y:155},{x:485,y:135},{x:655,y:170},{x:735,y:320},{x:675,y:475},{x:510,y:535},{x:345,y:495},{x:205,y:525},{x:95,y:420}]),
  make('fast','Circuito veloce',4,[{x:110,y:180},{x:355,y:140},{x:660,y:180},{x:750,y:330},{x:660,y:500},{x:355,y:540},{x:110,y:500},{x:40,y:340}])
];
export function copyTrack(d: TrackData):TrackData {return JSON.parse(JSON.stringify(d)) as TrackData;}
