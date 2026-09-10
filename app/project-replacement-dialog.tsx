"use client";
import {useEffect,useRef,useState} from "react";
export type ProjectSaveOutcome = "saved" | "cancelled" | "failed" | "downloaded";
export default function ProjectReplacementDialog({action,onSave,onSaveAs,onProceed,onCancel,purpose="replace",saveLabel="Save and continue"}:{action:string;onSave:()=>Promise<ProjectSaveOutcome>;onSaveAs?:()=>Promise<ProjectSaveOutcome>;onProceed:()=>Promise<void>;onCancel:()=>void;purpose?:"replace"|"close";saveLabel?:string}) {
 const dialog=useRef<HTMLDialogElement>(null),inFlight=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{const element=dialog.current!,previous=document.activeElement as HTMLElement|null;element.showModal();return()=>{element.close();if(previous?.isConnected)previous.focus();};},[]);
 const proceed=async(save:boolean,saveAs=false)=>{
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setMessage("");
  try {
   if(save){const result=await (saveAs&&onSaveAs?onSaveAs():onSave());if(result!=="saved"){
    setMessage(result==="downloaded"?"Download requested. Check that your project file was saved, then choose Continue without saving to proceed.":result==="cancelled"?"Save cancelled. Your current project is still open.":"The project could not be saved. Your current project is still open.");return;
   }}
   await onProceed();
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to continue. Your current project is still open.");}
  finally{inFlight.current=false;setBusy(false);}
 };
 return <dialog ref={dialog} className="project-replacement-dialog" aria-labelledby="project-replacement-title" aria-describedby="project-replacement-description" onCancel={event=>{event.preventDefault();if(!inFlight.current)onCancel();}} onKeyDown={event=>{
  if(event.key!=="Tab")return;
  const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),first=buttons[0],last=buttons[buttons.length-1];
  if(!first){event.preventDefault();return;}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }}>
  <header><h2 id="project-replacement-title">{action}?</h2></header>
  <div className="project-replacement-body">
  <p id="project-replacement-description">{purpose==="close"?"Save your work to a project file, or quit without saving.":"This will replace the current project and clear its Undo history. Save your work before continuing?"}</p>
  {message&&<p role="status">{message}</p>}
  </div>
  <footer><button autoFocus disabled={busy} onClick={onCancel}>Cancel</button><button disabled={busy} onClick={()=>void proceed(false)}>{purpose==="close"?"Quit without saving":"Continue without saving"}</button>{purpose==="close"&&onSaveAs&&<button disabled={busy} onClick={()=>void proceed(true,true)}>Save As…</button>}<button className="primary" disabled={busy} onClick={()=>void proceed(true)}>{busy?"Please wait…":saveLabel}</button></footer>
 </dialog>;
}
