import type { CSSProperties } from "react";
const paths: Record<string,string> = {
 file:"M5 3h9l5 5v13H5zM14 3v5h5M8 12h8M8 16h8", folder:"M3 6h7l2 3h9v11H3zM3 9h9",
 transfer:"M3 14h7v7H3zM14 3h7v7h-7zM7 10V6h10M14 3l3 3-3 3",
 adjust:"M7 9l5-5 5 5M7 15l5 5 5-5",
 move:"M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
 rotate:"M20 8a8 8 0 1 0 0 8M20 3v5h-5", scale:"M4 14v6h6M14 4h6v6M4 20l7-7M20 4l-7 7",
 snap:"M5 3v10a7 7 0 0 0 14 0V3h-4v10a3 3 0 0 1-6 0V3zM5 8h4M15 8h4",
 local:"M12 13V3M9 6l3-3 3 3M12 13l-9 6M3 15v4h4M12 13l9 6M17 19h4v-4",
 world:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18",
 grid:"M4 4h16v16H4zM9 4v16M15 4v16M4 9h16M4 15h16", target:"M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
 group:"M3 3h7v7H3zM14 14h7v7h-7zM14 3h7v7h-7zM3 14h7v7H3z", align:"M4 4v16M8 7h12v4H8zM8 14h8v4H8z", distribute:"M3 4v16M21 4v16M7 8h3v8H7zM14 8h3v8h-3z",
 parent:"M4 4h6v6H4zM14 14h6v6h-6zM7 10v7h7", screen:"M3 5h18v12H3zM8 21h8M12 17v4",
 slice:"M12 3L3 8v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
 eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6", hidden:"M3 3l18 18M9 5a12 12 0 0 1 3 0c6 0 10 7 10 7a20 20 0 0 1-4 4M6 6a20 20 0 0 0-4 6s4 7 10 7a12 12 0 0 0 4-1",
 lock:"M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4", unlock:"M5 10h14v11H5zM13 10V6a4 4 0 0 1 8 0v2",
 up:"M6 15l6-6 6 6", down:"M6 9l6 6 6-6", right:"M9 6l6 6-6 6", close:"M6 6l12 12M6 18L18 6", fullscreen:"M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6",
 search:"M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6", book:"M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v15",
 circle:"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18", diagonal:"M4 4h16v16H4zM4 4l16 16M20 4L4 20", safe:"M3 3h18v18H3zM7 7h10v10H7z", text:"M4 5h16M12 5v15M8 20h8", image:"M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M16 7h.01", chart:"M4 20V4M4 20h16M8 16V9M13 16V6M18 16v-4",
};
export function toolIcon(label:string){ const s=label.toLowerCase(); if(s.includes("transfer"))return "transfer"; if(s.includes("move"))return "move";if(s.includes("rotat"))return "rotate";if(s.includes("scale"))return "scale";if(s.includes("ungroup")||s.includes("group"))return "group";if(s.includes("align"))return "align";if(s.includes("distribut"))return "distribute";if(s.includes("parent"))return "parent";if(s.includes("view"))return "grid";if(s.includes("fit"))return "fullscreen";if(s.includes("focus")||s.includes("centre"))return "target";if(s.includes("diagonal"))return "diagonal";if(s.includes("circle"))return "circle";if(s.includes("safe"))return "safe";if(s.includes("logo"))return "image";if(s.includes("title")||s.includes("label")||s.includes("dimension"))return "text";if(s.includes("gamma")||s.includes("seam"))return "chart";return "grid"; }
export default function UiIcon({name,style}:{name:string;style?:CSSProperties}) {return <svg className="ui-icon" style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] || paths.grid}/></svg>;}
