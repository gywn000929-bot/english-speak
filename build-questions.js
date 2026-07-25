/* Build questions.html (Questions e-book) + artifact from chapters.json + qbank/*.json.
   Usage: node build-questions.js */
const fs = require("fs");
const path = require("path");
const ROOT = "/home/user/english-speak";
const BASE = "/tmp/claude-0/-home-user-english-speak/c7a08471-8496-55b0-ad8b-fdacc033580c/scratchpad";
const QBANK_DIR = BASE + "/qbank";
const ART_OUT = BASE + "/questions-artifact.html";
const CAT_ORDER = ["c1","c2","c3","c4","c5","c6","c7","c8","c9"];

// chapters
const chapters = JSON.parse(fs.readFileSync(path.join(ROOT,"questions.chapters.json"),"utf8"));
console.log("chapters:", chapters.length);

// qbank: one file per category, in CAT_ORDER
let bank = [];
for(const cat of CAT_ORDER){
  const f = path.join(QBANK_DIR, cat + ".json");
  if(!fs.existsSync(f)){ console.error("MISSING", cat+".json"); process.exit(1); }
  let arr;
  try{ arr = JSON.parse(fs.readFileSync(f,"utf8")); }
  catch(e){ console.error("PARSE FAIL", cat, e.message); process.exit(1); }
  arr.forEach((q,i)=>{
    if(!Array.isArray(q.opts)||q.opts.length<2||q.opts.length>4){ console.error("bad opts", cat, i); process.exit(1); }
    if(typeof q.a!=="number"||q.a<0||q.a>=q.opts.length){ console.error("bad answer idx", cat, i, q.a); process.exit(1); }
    if(typeof q.q!=="string"||typeof q.ex!=="string"){ console.error("bad q/ex", cat, i); process.exit(1); }
    if(new Set(q.opts.map(o=>String(o).trim())).size!==q.opts.length){ console.error("dup opts", cat, i); process.exit(1); }
    bank.push({ id: cat+"-"+i, cat, q:q.q, opts:q.opts, a:q.a, ex:q.ex });
  });
}
const byCat = {}; bank.forEach(b=>byCat[b.cat]=(byCat[b.cat]||0)+1);
console.log("quiz bank:", bank.length, "|", CAT_ORDER.map(c=>c+":"+(byCat[c]||0)).join(" "));

// inject
const tpl = fs.readFileSync(path.join(ROOT,"questions.template.html"),"utf8");
const chJson = JSON.stringify(chapters).replace(/</g,"\\u003c");
const qbJson = JSON.stringify(bank).replace(/</g,"\\u003c");
let html = tpl.replace("__CHAPTERS_JSON__", chJson).replace("__QBANK_JSON__", qbJson);
fs.writeFileSync(path.join(ROOT,"questions.html"), html);
console.log("wrote questions.html", html.length, "bytes");

// artifact variant: data-theme overrides + strip outer document tags
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
