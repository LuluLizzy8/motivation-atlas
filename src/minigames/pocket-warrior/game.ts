import { ball, moving, POCKETS, step, strike, type World } from './physics';
export type Target = 'easy' | 'hard';
export const DEFAULT_HIGHLIGHT_SEED = 42;
const MAX_HIGHLIGHT_SEED = 0xffffffff;
export const POCKET_NAMES = ['top left', 'top middle', 'top right', 'bottom left', 'bottom middle', 'bottom right'] as const;
export function isValidHighlightSeed(seed:number):boolean {
 return Number.isSafeInteger(seed)&&seed>=0&&seed<=MAX_HIGHLIGHT_SEED;
}
/** A seeded shuffle bag makes the highlight random while visiting each pocket once per six layouts. */
export function highlightedPocketFor(seed:number,challenge:number):number {
 if(!isValidHighlightSeed(seed)) throw new RangeError('Seed must be a whole number from 0 to 4294967295.');
 if(!Number.isSafeInteger(challenge)||challenge<0) throw new RangeError('Challenge must be a nonnegative whole number.');
 let value=seed>>>0;
 const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/0x100000000;};
 const order=POCKETS.map((_,index)=>index);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return order[challenge%order.length];
}
function layout(name:string, hint:string, cue:[number,number], easy:[number,number], hard:[number,number], obstacles:[number,number][] = []) {
 return {name,hint,steps:0,balls:[ball('cue',...cue),ball('easy',...easy),ball('hard',...hard),...obstacles.map((p,i)=>ball(`obstacle-${i}`,...p))]};
}
// Authored arrangements, not slight offsets of a common rack. Difficulty is
// an intention to playtest, not an empirically established ranking.
export const LAYOUTS = [
 layout('Straight choices','Two short routes into opposite corner pockets.',[300,170],[150,85],[450,255]),
 layout('Side pocket angle','Trade a short side-pocket cut for a longer corner route.',[200,240],[285,85],[480,300]),
 layout('Cross-table cuts','Contact the edge of the object ball, not its center.',[190,245],[140,110],[480,260]),
 layout('Thin contact','Two different cut angles from a cue ball near the top rail.',[300,80],[180,245],[510,80]),
 layout('Traffic island','A central obstacle splits the table into two routes.',[160,170],[105,65],[455,284],[[300,170]]),
 layout('Narrow channel','Two movable obstacles frame the route. Avoid a scratch.',[300,260],[90,300],[300,95],[[275,170],[325,170]]),
 layout('Around the screen','An obstacle screens the hard ball. Try a cushion-first route.',[180,250],[90,285],[420,90],[[300,170]]),
 layout('Rail puzzle','Look for a bank route around the two obstacles.',[280,180],[100,70],[440,235],[[380,210],[440,285]]),
];
export interface State { challenge:number; shots:number; score:number; deadline:number|null; phase:'aiming'|'moving'|'feedback'|'ended'; world:World; target:Target; message:string; highlightSeed:number; highlightedPocket:number|null }
export function newRound(timed:boolean,now:number,options:{highlightedPocket?:boolean;seed?:number}={}):State {
 const highlightSeed=options.seed??DEFAULT_HIGHLIGHT_SEED;
 const highlightOn=options.highlightedPocket??false;
 if(highlightOn&&!isValidHighlightSeed(highlightSeed)) throw new RangeError('Seed must be a whole number from 0 to 4294967295.');
 const safeSeed=isValidHighlightSeed(highlightSeed)?highlightSeed:DEFAULT_HIGHLIGHT_SEED;
 return {challenge:0,shots:0,score:0,deadline:timed?now+60000:null,phase:'aiming',world:structuredClone(LAYOUTS[0]),target:'easy',message:'Choose your target, aim, and shoot.',highlightSeed:safeSeed,highlightedPocket:highlightOn?highlightedPocketFor(safeSeed,0):null};
}
export function tick(state:State,now:number):State {
 if(state.phase==='ended'||state.deadline===null||now<state.deadline) return state;
 return {...state,phase:'ended',message:'Time is up! Only completed shots count.'};
}
export function shoot(state:State,target:Target,angle:number,power:number,now:number):State {
 const current=tick(state,now);
 if(current.phase!=='aiming'||!Number.isFinite(angle)||!Number.isFinite(power)) return current;
 return {...current,target,shots:current.shots+1,phase:'moving',world:strike(current.world,angle,power),message:'Shot in motion…'};
}
export function advance(state:State,now:number):State {
 const current=tick(state,now); if(current.phase!=='moving') return current;
 const world=step(current.world);
 if(moving(world)) return {...current,world};
 const scratch=world.balls[0].sunk;
 const targetBall=world.balls.find(b=>b.id===current.target)!;
 const bonus=!scratch&&targetBall.sunk&&current.highlightedPocket!==null&&targetBall.pocket===current.highlightedPocket;
 const points=!scratch&&targetBall.sunk?(current.target==='easy'?1:3)*(bonus?3:1):0;
 return {...current,world,score:current.score+points,phase:current.shots===8?'ended':'feedback',message:scratch?'Scratch — no points.':points?`${bonus?'Bonus pocket! ':''}Pocketed! +${points} point${points===1?'':'s'}.`:'Miss — no points.'};
}
export function nextChallenge(state:State,now:number):State {
 const current=tick(state,now); if(current.phase!=='feedback') return current;
 const challenge=current.challenge+1;
 return {...current,challenge,world:structuredClone(LAYOUTS[challenge]),highlightedPocket:current.highlightedPocket===null?null:highlightedPocketFor(current.highlightSeed,challenge),phase:'aiming',message:'Choose your target, aim, and shoot.'};
}
