import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type { BrainPage } from "@workspace/db";
export const MAX_FILE_BYTES=20*1024*1024;
export async function extractDocument(bytes:Buffer,name:string):Promise<BrainPage[]> {
  if(bytes.length>MAX_FILE_BYTES) throw new Error("File exceeds 20 MB.");
  const ext=name.split(".").pop()?.toLowerCase();
  if(["txt","md","csv"].includes(ext??"")) return [{text:bytes.toString("utf8").replace(/\0/g,"").slice(0,500000),label:name,page:null}];
  if(ext==="pdf") {
    const {PDFParse}=await import("pdf-parse");
    const p=new PDFParse({data:bytes});
    try {
      const r=await p.getText({first:100});
      return r.pages.map(v=>({text:v.text.slice(0,50000),label:`${name} · page ${v.num}`,page:v.num}));
    } finally {await p.destroy();}
  }
  if(ext==="docx") {
    let total=0;
    const parts=unzipSync(bytes,{filter:f=>{total+=f.originalSize; if(total>20*1024*1024) throw new Error("Expanded document is too large."); return f.name==="word/document.xml";}});
    const xml=parts["word/document.xml"];
    if(!xml) throw new Error("Not a valid DOCX document.");
    const parser=new XMLParser({ignoreAttributes:true,processEntities:false});
    const obj=parser.parse(strFromU8(xml));
    const words:string[]=[];
    function walk(v:unknown,key="") {if(words.join("").length>500000) return; if(typeof v==="string"||typeof v==="number"){if(key==="w:t")words.push(String(v));} else if(Array.isArray(v)) v.forEach(x=>walk(x,key));else if(v&&typeof v==="object") Object.entries(v).forEach(([k,x])=>walk(x,k)); if(key==="w:p") words.push("\n");}
    walk(obj); return [{text:words.join(" ").slice(0,500000),label:name,page:null}];
  }
  return [];
}
export function chunkText(text:string,max=1500) {
  const chunks:string[]=[];
  for(let pos=0;pos<Math.min(text.length,500000);pos+=max-180){const chunk=text.slice(pos,pos+max).trim();if(chunk) chunks.push(chunk);}
  return chunks;
}
