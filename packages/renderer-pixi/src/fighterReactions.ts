import type { Vec2 } from '@kinetic/protocol';
export type KnockbackReactionKind = 'weapon' | 'explosion' | 'ability';
export interface KnockbackAngularReactionInput { direction: Vec2; facingRadians: number; force: number; mass: number; kind: KnockbackReactionKind; }
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Presentation-only spin: incoming side chooses direction; force and mass choose violence. */
export function resolveKnockbackAngularImpulse(input: KnockbackAngularReactionInput): number {
 const len=Math.hypot(input.direction.x,input.direction.y); if(len<=0.0001||input.force<=1.5)return 0;
 const nx=input.direction.x/len, ny=input.direction.y/len, fx=Math.cos(input.facingRadians), fy=Math.sin(input.facingRadians);
 const lateral=fx*ny-fy*nx; if(Math.abs(lateral)<0.035)return 0;
 const incidence=Math.sign(lateral)*Math.pow(Math.abs(lateral),0.58);
 const energy=Math.pow(clamp((input.force-1.5)/10,0,4),0.82);
 const mass=clamp(1/Math.pow(Math.max(0.7,input.mass),0.36),0.5,1.2);
 const kind=input.kind==='explosion'?1.28:input.kind==='weapon'?0.92:1.08;
 return clamp(incidence*energy*mass*kind*13.5,-34,34);
}
