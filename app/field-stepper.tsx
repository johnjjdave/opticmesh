"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import UiIcon from "./ui-icon";
export default function FieldStepper({label,children}:{label:string;children:ReactNode}) {
 const [open,setOpen]=useState(false);const root=useRef<HTMLSpanElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener("pointerdown",outside);root.current?.querySelector<HTMLButtonElement>(".stepper-actions button")?.focus();return ()=>document.removeEventListener("pointerdown",outside);},[open]);
 return <span ref={root} className="field-stepper" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false);trigger.current?.focus();}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}><button ref={trigger} type="button" aria-label={"Adjust "+label} title={"Adjust "+label} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><UiIcon name="adjust"/></button>{open&&<span className="stepper-actions" role="group" aria-label={label+" step controls"}>{children}</span>}</span>;
}
