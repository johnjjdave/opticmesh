"use client";
import { useEffect, useRef } from "react";

/** Keep native colour dragging independent of expensive scene/React updates. */
export default function MaterialColorInput({value,disabled,onEditStart,onValueChange}:{value:string;disabled?:boolean;onEditStart:()=>void;onValueChange:(color:string)=>void}){
 const input=useRef<HTMLInputElement>(null),pending=useRef<string|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),editing=useRef(false),lastPublished=useRef(value);
 const callbacks=useRef({onEditStart,onValueChange});
 useEffect(()=>{callbacks.current={onEditStart,onValueChange};});
 useEffect(()=>{if(!editing.current && input.current)input.current.value=value;lastPublished.current=value;},[value]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const flush=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;const next=pending.current;pending.current=null;if(next!==null && next!==lastPublished.current){lastPublished.current=next;callbacks.current.onValueChange(next);}};
 const finish=()=>{flush();editing.current=false;};
 return <input ref={input} aria-label="Diffuse colour" type="color" defaultValue={value} disabled={disabled}
  onPointerDown={finish}
  onBlur={finish}
  onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")finish();}}
  onChange={e=>{if(disabled)return;const next=e.currentTarget.value;if(!editing.current){if(next===lastPublished.current)return;callbacks.current.onEditStart();editing.current=true;}pending.current=next;if(!timer.current)timer.current=setTimeout(flush,50);}}/>;
}
