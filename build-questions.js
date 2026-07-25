/* Build questions.html (Questions e-book) + artifact.
   Attaches per-chapter problem sets (chquiz/ch{N}.json) to each chapter in
   questions.chapters.json, then injects. Usage: node build-questions.js */
const fs = require("fs");
const path = require("path");
const ROOT = "/home/user/english-speak";
const BASE = "/tmp/claude-0/-home-user-english-speak/c7a08471-8496-55b0-ad8b-fdacc033580c/scratchpad";
const CHQUIZ_DIR = BASE + "/chquiz2";
const CHSHORT_DIR = BASE + "/chshort";
const ART_OUT = BASE + "/questions-artifact.html";

const chapters = JSON.parse(fs.readFileSync(path.join(ROOT,"questions.chapters.json"),"utf8"));
console.log("chapters:", chapters.length);

let total = 0;
chapters.forEach((c,idx)=>{
  const f = path.join(CHQUIZ_DIR, c.id + ".json");
  if(!fs.existsSync(f)){ console.error("MISSING", c.id+".json"); process.exit(1); }
  let arr;
  try{ arr = JSON.parse(fs.readFileSync(f,"utf8")); }
  catch(e){ console.error("PARSE FAIL", c.id, e.message); process.exit(1); }
  if(!Array.isArray(arr) || arr.length < 1){ console.error("empty", c.id); process.exit(1); }
  arr.forEach((q,i)=>{
    const t = q.type || "mc";
    if(t==="mc"){
      if(!Array.isArray(q.opts)||q.opts.length<2||q.opts.length>4){ console.error("bad opts", c.id, i); process.exit(1); }
      if(typeof q.a!=="number"||q.a<0||q.a>=q.opts.length){ console.error("bad answer idx", c.id, i, q.a); process.exit(1); }
      if(typeof q.q!=="string"||typeof q.ex!=="string"){ console.error("bad q/ex", c.id, i); process.exit(1); }
      if(new Set(q.opts.map(o=>String(o).trim())).size!==q.opts.length){ console.error("dup opts", c.id, i); process.exit(1); }
    } else if(t==="write"){
      if(typeof q.ko!=="string"||!q.ko.trim()){ console.error("bad write.ko", c.id, i); process.exit(1); }
      if(typeof q.model!=="string"||!q.model.trim()){ console.error("bad write.model", c.id, i); process.exit(1); }
      if(typeof q.nuance!=="string"||!q.nuance.trim()){ console.error("bad write.nuance", c.id, i); process.exit(1); }
    } else { console.error("unknown type", c.id, i, t); process.exit(1); }
  });
  c.quiz = arr.map(q=>{
    const t = q.type || "mc";
    if(t==="write") return { type:"write", ko:q.ko, model:q.model, alts:Array.isArray(q.alts)?q.alts:[], nuance:q.nuance, key:Array.isArray(q.key)?q.key:[] };
    return { type:"mc", q:q.q, opts:q.opts, a:q.a, ex:q.ex };
  });
  total += arr.length;

  // append short-answer (주관식) items if present
  const sf = path.join(CHSHORT_DIR, c.id + ".json");
  if(fs.existsSync(sf)){
    let sarr;
    try{ sarr = JSON.parse(fs.readFileSync(sf,"utf8")); }
    catch(e){ console.error("SHORT PARSE FAIL", c.id, e.message); process.exit(1); }
    sarr.forEach((q,i)=>{
      if(typeof q.q!=="string"||!q.q.trim()){ console.error("bad short.q", c.id, i); process.exit(1); }
      if(!Array.isArray(q.answers)||!q.answers.length||!q.answers.every(a=>typeof a==="string"&&a.trim())){ console.error("bad short.answers", c.id, i); process.exit(1); }
      if(typeof q.ex!=="string"){ console.error("bad short.ex", c.id, i); process.exit(1); }
    });
    c.quiz = c.quiz.concat(sarr.map(q=>({ type:"short", q:q.q, answers:q.answers, ex:q.ex })));
    total += sarr.length;
  }
});
const mc = chapters.reduce((s,c)=>s+c.quiz.filter(q=>q.type==="mc").length,0);
const wr = chapters.reduce((s,c)=>s+c.quiz.filter(q=>q.type==="write").length,0);
console.log("per-chapter problems:", chapters.map(c=>c.id+":"+c.quiz.length).join(" "));
console.log("total problems:", total, "| mc:", mc, "| write:", wr, "| avg/chapter:", (total/chapters.length).toFixed(1));

const tpl = fs.readFileSync(path.join(ROOT,"questions.template.html"),"utf8");
const chJson = JSON.stringify(chapters).replace(/</g,"\\u003c");
let html = tpl.replace("__CHAPTERS_JSON__", chJson);
fs.writeFileSync(path.join(ROOT,"questions.html"), html);
console.log("wrote questions.html", html.length, "bytes");

// artifact variant
let s = html;
const darkM = s.match(/:root\{([^}]*)\}/);
const lightM = s.match(/@media \(prefers-color-scheme: light\)\{\s*:root\{([\s\S]*?)\}\s*\}/);
if(darkM && lightM){
  const inject = `\n  :root[data-theme="dark"]{${darkM[1].trim()}}\n  :root[data-theme="light"]{${lightM[1].trim()}}\n`;
  s = s.replace(lightM[0], lightM[0]+inject);
}
s = s.replace(/<!DOCTYPE html>\s*/i,"").replace(/<html[^>]*>\s*/i,"").replace(/<head>\s*/i,"")
     .replace(/<\/head>\s*/i,"").replace(/<body>\s*/i,"").replace(/\s*<\/body>\s*/i,"\n")
     .replace(/\s*<\/html>\s*/i,"\n").replace(/<meta[^>]*>\s*/gi,"");
fs.writeFileSync(ART_OUT, s.trim()+"\n");
console.log("wrote artifact", s.length, "bytes ->", ART_OUT);
