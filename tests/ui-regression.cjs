const { JSDOM } = require("jsdom");
const fs = require("fs"), assert = require("assert/strict"), cp = require("child_process");
const tick = () => new Promise(r => setTimeout(r, 5));
const homepage = fs.readFileSync(".qa/public/index.html", "utf8");
const studioHTML = fs.readFileSync(".qa/public/studio/index.html", "utf8");
const appearance = JSON.parse(fs.readFileSync("static/appearance.json", "utf8"));
const tests = [];
fs.mkdirSync(".qa", {recursive:true});
function ok(name) { tests.push(name); console.log("PASS", name); }
function dom(html, url = "https://hanshui.space/") {
  const page = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  page.window.matchMedia = () => ({ matches: false });
  page.window.eval(fs.readFileSync("static/design.js", "utf8"));
  return page;
}
async function comments() {
  const page = dom(homepage), w = page.window, d = w.document;
  const records = [
    {id:1,page_path:"/",user_id:"one",display_name:"公开访客",content:"已通过",status:"approved",created_at:"2026-10-01T00:00:00Z"},
    {id:2,page_path:"/",user_id:"one",display_name:"本人",content:"自己的待审核",status:"pending",created_at:"2026-10-02T00:00:00Z"},
    {id:3,page_path:"/",user_id:"two",display_name:"他人",content:"他人的待审核",status:"pending",created_at:"2026-10-03T00:00:00Z"}
  ];
  let sessionUser = null, callback;
  const calls = [];
  function query() {
    let action="select", payload, filters=[];
    const q = {
      select(){ return q; }, order(){ return q; }, eq(field,value){filters.push([field,value]);return q},
      insert(value){action="insert";payload=value;return q}, update(value){action="update";payload=value;return q},
      delete(){action="delete";return q},
      then(resolve,reject){
        calls.push({action,payload,filters});
        let selected = records.filter(row=>filters.every(([field,value])=>row[field]===value));
        if(action==="select")selected=selected.filter(row=>row.status==="approved"||row.user_id===sessionUser?.id||sessionUser?.app_metadata?.comment_admin);
        if(action==="insert")records.push({...payload,id:records.length+1,created_at:"2026-10-10T00:00:00Z"});
        if(action==="update")selected.forEach(row=>Object.assign(row,payload));
        if(action==="delete")selected.forEach(row=>records.splice(records.indexOf(row),1));
        return Promise.resolve({data:action==="select"?selected:null,error:null}).then(resolve,reject);
      }
    }; return q;
  }
  const auth = {
    getSession:async()=>({data:{session:null}}),
    onAuthStateChange(fn){callback=fn},
    signInWithOAuth:async options=>{calls.push({oauth:options});return {error:null}},
    signOut:async()=>{sessionUser=null;return {error:null}}
  };
  w.supabase={createClient:()=>({from:query,auth})};w.confirm=()=>true;
  w.eval(fs.readFileSync("static/comments.js","utf8"));await tick();
  assert.equal(d.querySelectorAll(".comment-item").length,1);
  assert.equal(d.querySelector("[data-comments-user]").hidden,true);
  ok("Guest sees approved comments and the Google login button");
  d.querySelector("[data-google-login]").click();await tick();
  const oauth=calls.find(c=>c.oauth).oauth;assert.equal(oauth.provider,"google");assert.equal(oauth.options.redirectTo,w.location.href);
  ok("OAuth still uses Google and redirects to the original page");
  sessionUser={id:"one",email:"one@example.test",user_metadata:{name:"本人"},app_metadata:{}};
  callback("SIGNED_IN",{user:sessionUser});await tick();
  assert.equal(d.querySelectorAll(".comment-item").length,2);
  assert.ok(d.querySelector("[data-comments-list]").textContent.includes("自己的待审核"));
  assert.ok(!d.querySelector("[data-comments-list]").textContent.includes("他人的待审核"));
  assert.equal(d.querySelector("[data-comments-admin]").hidden,true);
  ok("Authors see their pending comments; ordinary users cannot access moderation");
  const form=d.querySelector("[data-comments-form]"),area=form.querySelector("textarea");
  area.value="";form.dispatchEvent(new w.Event("submit",{cancelable:true}));await tick();assert.ok(d.querySelector("[data-comments-status]").textContent.includes("不能为空"));
  area.value="x".repeat(2001);form.dispatchEvent(new w.Event("submit",{cancelable:true}));await tick();assert.ok(d.querySelector("[data-comments-status]").textContent.includes("2000"));
  area.value="隔离测试";form.dispatchEvent(new w.Event("submit",{cancelable:true}));await tick();
  const submission=calls.find(c=>c.action==="insert").payload;
  assert.equal(submission.status,"pending");assert.equal(submission.user_id,"one");assert.equal(submission.page_path,"/");assert.equal(area.value,"");
  ok("Empty/oversized comments are blocked; submissions remain pending and page-scoped");
  sessionUser={...sessionUser,app_metadata:{comment_admin:true}};
  callback("TOKEN_REFRESHED",{user:sessionUser});await tick();
  assert.equal(d.querySelector("[data-comments-admin]").hidden,false);
  d.querySelector("[data-admin-toggle]").click();await tick();assert.equal(d.querySelector("[data-admin-panel]").hidden,false);
  const findButton=text=>[...d.querySelectorAll("[data-admin-list] button")].find(b=>b.textContent===text);
  findButton("通过").click();await tick();assert.ok(calls.some(c=>c.action==="update"&&c.payload.status==="approved"));
  findButton("拒绝").click();await tick();assert.ok(calls.some(c=>c.action==="update"&&c.payload.status==="rejected"));
  findButton("删除").click();await tick();assert.ok(calls.some(c=>c.action==="delete"));
  ok("Admin panel loads all pages and retains approve, reject and confirmed delete actions");
  d.querySelector("[data-google-logout]").click();await tick();assert.equal(d.querySelector("[data-comments-user]").hidden,true);assert.equal(d.querySelector("[data-comments-admin]").hidden,true);
  ok("Sign-out hides the submission form and admin panel");
  page.window.close();
}
async function studio() {
  const page=dom(studioHTML,"https://hanshui.space/studio/"),w=page.window,d=w.document;
  w.fetch=async()=>({ok:true,json:async()=>appearance});
  w.Blob=global.Blob;w.TextEncoder=global.TextEncoder;
  let exported,posted;
  w.URL.createObjectURL=blob=>{exported=blob;return "blob:https://hanshui.space/test"};
  w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  d.querySelector("iframe").contentWindow.postMessage=(value,origin)=>{posted={value,origin}};
  w.eval(fs.readFileSync("static/studio.js","utf8"));await tick();
  assert.equal(d.querySelector("[data-export]").disabled,false);
  const change=(selector,value)=>{const input=d.querySelector(selector);input.value=value;input.dispatchEvent(new w.Event("input",{bubbles:true}));};
  change('[data-field="opacity"]',".37");change('[data-field="blur"]',"9");change('[data-surface-field="opacity"]',".7");change('[data-surface-field="blur"]',"24");
  assert.equal(posted.value.settings.hero.opacity,.37);assert.equal(posted.value.settings.surface.blur,24);assert.equal(posted.origin,w.location.origin);
  ok("Opacity, image blur and glass controls update the same-origin preview");
  change('[data-field="src"]',"javascript:alert(1)");assert.ok(d.querySelector("[data-studio-status]").textContent.includes("https://"));
  assert.equal(posted.value.settings.hero.src,"/images/lunar-study.svg");
  const normalized=w.HanshuiAppearance.normalize({hero:{opacity:9,blur:-2,src:"//evil.test/a.png"},surface:{opacity:0,blur:99}});
  assert.equal(normalized.hero.opacity,1);assert.equal(normalized.hero.blur,0);assert.equal(normalized.hero.src,"");assert.equal(normalized.surface.opacity,.55);assert.equal(normalized.surface.blur,40);
  ok("Invalid URLs are rejected and effect values are bounded");
  d.querySelector('[data-viewport="mobile"]').click();assert.equal(d.querySelector(".studio-preview").classList.contains("is-mobile"),true);
  ok("Mobile preview can be toggled");
  const scope=d.querySelector("[data-scope]");scope.value="/";scope.dispatchEvent(new w.Event("change"));
  change('[data-field="src"]',"/images/nocturne.svg");
  d.querySelector("[data-export]").click();await tick();
  const buffer=Buffer.from(await exported.arrayBuffer()),entries={};let offset=0;
  while(buffer.readUInt32LE(offset)===0x04034b50){
    const size=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extraLength=buffer.readUInt16LE(offset+28);
    const name=buffer.subarray(offset+30,offset+30+nameLength).toString();
    const start=offset+30+nameLength+extraLength;entries[name]=buffer.subarray(start,start+size);offset=start+size;
  }
  assert.ok(entries["static/appearance.json"]);assert.ok(entries["使用说明.txt"]);
  const config=JSON.parse(entries["static/appearance.json"]);assert.equal(config.pages["/"].hero.src,"/images/nocturne.svg");assert.equal(config.global.hero.src,"/images/lunar-study.svg");
  fs.writeFileSync(".qa/studio-export.zip",buffer);
  ok("ZIP export contains valid JSON and UTF-8 instructions; page overrides preserve global defaults");
  d.querySelector("[data-reset]").click();assert.equal(d.querySelector('[data-field="src"]').value,appearance.global.hero.src);
  ok("Reset returns to published configuration");
  page.window.close();
}
(async()=>{
  cp.execFileSync(process.execPath,["scripts/verify-preservation.mjs"],{stdio:"inherit"});
  const page=dom(homepage),d=page.window.document;
  assert.equal(d.querySelectorAll("#articles .blog-posts a").length,2);
  assert.equal(d.querySelector("#articles .blog-posts a").textContent.replace("↗","").trim(),"随想 一");
  assert.equal(d.querySelector("[data-comments]").dataset.pagePath,"/");
  assert.equal(d.querySelector(".ambient img").style.opacity,"0.18");
  assert.ok(fs.readFileSync(".qa/public/index.xml","utf8").includes("关于特拉克尔"));
  assert.ok(!fs.readFileSync(".qa/public/index.xml","utf8").includes("视觉工作台"));
  ok("Homepage order, original comment path, RSS and background configuration preserved");
  page.window.close();
  await comments();await studio();
  fs.writeFileSync(".qa/test-results.json",JSON.stringify({passed:tests.length,tests},null,2));
  console.log("ALL",tests.length,"REGRESSION GROUPS PASSED; no network or database mutations.");
})().catch(error=>{console.error(error);process.exitCode=1});
