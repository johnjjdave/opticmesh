export type PerformanceLevel="normal"|"warning"|"critical";
export function usageLevel(value:number|null|undefined,warning=80,critical=95):PerformanceLevel|null {
  if(value==null||!Number.isFinite(value)||value<0||value>100)return null;
  return value>=critical?"critical":value>=warning?"warning":"normal";
}
export function memoryPercent(used:number|null|undefined,total:number|null|undefined):number|null {
  if(used==null||total==null||!Number.isFinite(used)||!Number.isFinite(total)||used<0||total<=0||used>total)return null;
  return used/total*100;
}
/** Fixed UI responsiveness guidance, not a hardware refresh-rate or crash prediction. */
export function fpsLevel(value:number|null|undefined):PerformanceLevel|null {
  if(value==null||!Number.isFinite(value)||value<0)return null;
  return value<25?"critical":value<45?"warning":"normal";
}
export const levelLabel={normal:"Normal",warning:"Attention",critical:"High pressure"} as const;
