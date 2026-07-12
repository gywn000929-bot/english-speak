/* Build index.html (145 units) + artifact variant from section JSON files.
   Usage: node build.js */
const fs = require("fs");
const path = require("path");

const ROOT = "/home/user/english-speak";
const UNITS_DIR = "/tmp/claude-0/-home-user-english-speak/c7a08471-8496-55b0-ad8b-fdacc033580c/scratchpad/units";
const ART_OUT = "/tmp/claude-0/-home-user-english-speak/c7a08471-8496-55b0-ad8b-fdacc033580c/scratchpad/speakup-artifact.html";

function unitNum(id){ return parseInt(String(id).replace(/[^0-9]/g,""),10); }

// 1) load & merge all batch files
let all = [];
const files = fs.readdirSync(UNITS_DIR).filter(f=>/^b\d+\.json$/.test(f)).sort();
for(const f of files){
  const raw = fs.readFileSync(path.join(UNITS_DIR,f),"utf8");
  let arr;
  try{ arr = JSON.parse(raw); }
  catch(e){ console.error("PARSE FAIL:", f, e.message); process.exit(1); }
  if(!Array.isArray(arr)){ console.error("NOT ARRAY:", f); process.exit(1); }
  all = all.concat(arr);
}

// 2) validate + dedupe by id, sort by unit number
const seen = new Map();
for(const u of all){
  const req = ["id","tag","title","en","intro","patterns","examples","dialogue","quiz","speak"];
  for(const k of req){ if(!(k in u)){ console.error("MISSING KEY", k, "in", u.id); process.exit(1); } }
  if(!Array.isArray(u.examples)||u.examples.length<1){ console.error("bad examples", u.id); process.exit(1); }
  if(!Array.isArray(u.quiz)||u.quiz.length<1){ console.error("bad quiz", u.id); process.exit(1); }
  if(!Array.isArray(u.speak)||u.speak.length<1){ console.error("bad speak", u.id); process.exit(1); }
  seen.set(u.id, u);
}
const units = [...seen.values()].sort((a,b)=>unitNum(a.id)-unitNum(b.id));

// 3) contiguity check
const nums = units.map(u=>unitNum(u.id));
const missing = [];
for(let i=1;i<=145;i++){ if(!nums.includes(i)) missing.push(i); }
console.log("units loaded:", units.length, "| missing:", missing.length?missing.join(","):"none");

// 4) inject into template (escape < to avoid </script> breakage)
const tpl = fs.readFileSync(path.join(ROOT,"index.template.html"),"utf8");
const dataJson = JSON.stringify(units).replace(/</g,"\\u003c");
let html = tpl.replace("__UNIT_DATA_JSON__", dataJson);
fs.writeFileSync(path.join(ROOT,"index.html"), html);
console.log("wrote index.html", html.length, "bytes");

// 5) artifact variant: add data-theme overrides + strip outer document tags
let s = html;
const darkM = s.match(/:root\{([^}]*)\}/);
const lightM = s.match(/@media \(prefers-color-scheme: light\)\{\s*:root\{([\s\S]*?)\}\s*\}/);
if(darkM && lightM){
  const inject = `\n  :root[data-theme="dark"]{${darkM[1].trim()}}\n  :root[data-theme="light"]{${lightM[1].trim()}}\n`;
  s = s.replace(lightM[0], lightM[0]+inject);
}
s = s.replace(/<!DOCTYPE html>\s*/i,"")
     .replace(/<html[^>]*>\s*/i,"")
     .replace(/<head>\s*/i,"")
     .replace(/<\/head>\s*/i,"")
     .replace(/<body>\s*/i,"")
     .replace(/\s*<\/body>\s*/i,"\n")
     .replace(/\s*<\/html>\s*/i,"\n")
     .replace(/<meta[^>]*>\s*/gi,"");
fs.writeFileSync(ART_OUT, s.trim()+"\n");
console.log("wrote artifact", s.length, "bytes ->", ART_OUT);
