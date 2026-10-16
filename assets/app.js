const KEY="ssr-kb-v4-complete-tree";
let state={folders:[],articles:[],trash:[]}, connectedDir=null, editingId=null, contextTarget=null;

const $=id=>document.getElementById(id);
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
function saveState(){localStorage.setItem(KEY,JSON.stringify(state))}
async function loadState(){
  // GitHub Pages read-only mode: content is generated from the repository's TXT files.
  const response = await fetch("content-index.json?cache=" + Date.now(), { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load content-index.json (HTTP " + response.status + ").");
  const data = await response.json();
  if (!Array.isArray(data.folders) || !Array.isArray(data.articles)) {
    throw new Error("content-index.json has an unexpected format.");
  }
  state = { folders: data.folders, articles: data.articles, trash: [] };
}
function folderPath(id){let a=[],f=state.folders.find(x=>x.id===id),guard=0;while(f&&guard++<30){a.unshift(f.name);f=state.folders.find(x=>x.id===f.parent)}return a}
function childrenFolders(parent=null){return state.folders.filter(f=>f.parent===parent)}
function renderNav(){
  const groups=childrenFolders(null);
  $("nav").innerHTML=groups.map(f=>`
    <div class="group">${esc(f.name).toUpperCase()} ></div>
    <button onclick="openFolder('${f.id}')">📁 ${esc(f.name)}</button>
    ${state.articles.filter(a=>a.folder===f.id).map(a=>`<button onclick="openArticle('${a.id}')">📄 ${esc(a.title)}</button>`).join("")}
  `).join("");
}

function folderChildren(folderId){
  return {
    folders: state.folders.filter(f=>f.parent===folderId),
    articles: state.articles.filter(a=>a.folder===folderId)
  };
}

function folderBreadcrumbHtml(folderId){
  const path=[];
  let f=state.folders.find(x=>x.id===folderId);
  while(f){path.unshift(f);f=state.folders.find(x=>x.id===f.parent)}
  return `<button onclick="showHome()">Home</button> ${path.map((p,i)=>`<span>›</span><button onclick="openFolder('${p.id}')">${esc(p.name)}</button>`).join("")}`;
}

function openFolder(id){
  const f=state.folders.find(x=>x.id===id);
  if(!f)return;
  window.currentFolderId=id;
  $("folderTitle").textContent=f.name;
  $("folderBreadcrumb").innerHTML=folderBreadcrumbHtml(id);
  $("folderFilter").value="";
  renderFolderContents(id,"");
  $("crumb").textContent=f.name;
  show("folderView");
  window.scrollTo(0,0);
}

function renderFolderContents(id,filter=""){
  const f=state.folders.find(x=>x.id===id); if(!f)return;
  const childFolders=state.folders.filter(x=>x.parent===id);
  const childArticles=state.articles.filter(x=>x.folder===id);
  const q=filter.toLowerCase();
  const folders=childFolders.filter(x=>!q||x.name.toLowerCase().includes(q));
  const articles=childArticles.filter(x=>!q||(x.title+" "+x.content).toLowerCase().includes(q));

  let html="";
  if(!q || folders.length){
    html += `<div class="content-section"><div class="content-section-title">FOLDERS <span>${folders.length}</span></div><div class="item-grid">
      ${folders.map(x=>`<div class="content-item folder-item" data-type="folder" data-id="${x.id}" onclick="openFolder('${x.id}')" oncontextmenu="showContextMenu(event,'folder','${x.id}')">
        <div class="item-icon">📁</div><div><b>${esc(x.name)}</b><small>${state.folders.filter(s=>s.parent===x.id).length} subfolder(s) · ${state.articles.filter(a=>a.folder===x.id).length} article(s)</small></div><span>›</span>
      </div>`).join("")}
      ${folders.length===0?`<div class="empty-state compact">No subfolders here.</div>`:""}
    </div></div>`;
  }

  html += `<div class="content-section"><div class="content-section-title">ARTICLES <span>${articles.length}</span></div><div class="item-grid">
    ${articles.map(a=>`<div class="content-item article-item" data-type="article" data-id="${a.id}" onclick="openArticle('${a.id}')" oncontextmenu="showContextMenu(event,'article','${a.id}')">
      <div class="item-icon">📄</div><div><b>${esc(a.title)}</b><small>Documentation article</small></div><span>›</span>
    </div>`).join("")}
    ${articles.length===0?`<div class="empty-state compact">No articles here yet. Use <b>New Article</b> to add one.</div>`:""}
  </div></div>`;

  $("folderContents").innerHTML=html;
}

function show(view){
  ["homeView","folderView","articleView","manageView","recycleView"].forEach(x=>{
    const el=$(x);
    if(el) el.classList.add("hidden");
  });
  const target=$(view);
  if(target) target.classList.remove("hidden");
}
function showHome(){show("homeView");$("crumb").textContent="Home";renderHome();window.scrollTo(0,0)}


function renderHome(query=""){
  const q=String(query||"").trim().toLowerCase();
  const container=$("folderCards");
  if(!container)return;

  const roots=state.folders.filter(f=>f.parent===null);
  const folderHits=q
    ? state.folders.filter(f=>f.name.toLowerCase().includes(q))
    : roots;
  const articleHits=q
    ? state.articles.filter(a=>(a.title+" "+a.content).toLowerCase().includes(q))
    : [];

  $("docCount").textContent=q
    ? `${folderHits.length} folder${folderHits.length===1?"":"s"} · ${articleHits.length} article${articleHits.length===1?"":"s"}`
    : `${state.articles.length} articles`;

  if(!q){
    container.innerHTML=roots.map((f,i)=>{
      const subfolders=state.folders.filter(x=>x.parent===f.id).length;
      const articles=state.articles.filter(a=>a.folder===f.id).length;
      return `<div class="card folder-card" onclick="openFolder('${f.id}')">
        <span class="num">${String(i+1).padStart(2,"0")}</span>
        <h3>📁 ${esc(f.name)}</h3>
        <p>${subfolders} subfolder${subfolders===1?"":"s"} · ${articles} article${articles===1?"":"s"}</p>
        <button class="open" onclick="event.stopPropagation();openFolder('${f.id}')">Open →</button>
      </div>`;
    }).join("") || `<div class="empty-state">No folders yet. Use <b>Manage Content</b> to create one.</div>`;
    return;
  }

  let html="";

  if(folderHits.length){
    html += `<div style="grid-column:1/-1">
      <div class="content-section-title">FOLDERS <span>${folderHits.length}</span></div>
    </div>`;
    html += folderHits.map(f=>`
      <div class="card folder-card" onclick="openFolder('${f.id}')">
        <span class="num">FOLDER</span>
        <h3>📁 ${esc(f.name)}</h3>
        <p>${esc(folderPath(f.id).join(" / "))}</p>
        <button class="open" onclick="event.stopPropagation();openFolder('${f.id}')">Open →</button>
      </div>
    `).join("");
  }

  if(articleHits.length){
    html += `<div style="grid-column:1/-1;margin-top:8px">
      <div class="content-section-title">ARTICLES <span>${articleHits.length}</span></div>
    </div>`;
    html += articleHits.map(a=>`
      <div class="card folder-card" onclick="openArticle('${a.id}')">
        <span class="num">ARTICLE</span>
        <h3>📄 ${esc(a.title)}</h3>
        <p>${esc(folderPath(a.folder).join(" / "))}</p>
        <button class="open" onclick="event.stopPropagation();openArticle('${a.id}')">Open →</button>
      </div>
    `).join("");
  }

  if(!html){
    html=`<div class="empty-state">No folders or articles match <b>${esc(query)}</b>.</div>`;
  }

  container.innerHTML=html;
}


function renderMarkdown(md){
  const lines=md.replace(/\r/g,"").split("\n"), out=[]; let ul=false,ol=false;
  function close(){if(ul){out.push("</ul>");ul=false}if(ol){out.push("</ol>");ol=false}}
  for(const raw of lines){
    const l=raw.trimEnd();
    if(!l.trim()){close();continue}
    let m;
    if(m=l.match(/^###\s+(.+)/)){close();out.push(`<h3>${esc(m[1])}</h3>`);continue}
    if(m=l.match(/^##\s+(.+)/)){close();out.push(`<h2>${esc(m[1])}</h2>`);continue}
    if(m=l.match(/^#\s+(.+)/)){close();out.push(`<h1>${esc(m[1])}</h1>`);continue}
    if(m=l.match(/^[-*]\s+(.+)/)){if(!ul){close();out.push("<ul>");ul=true}out.push(`<li>${inline(m[1])}</li>`);continue}
    if(m=l.match(/^\d+\.\s+(.+)/)){if(!ol){close();out.push("<ol>");ol=true}out.push(`<li>${inline(m[1])}</li>`);continue}
    if(m=l.match(/^>\s?(.+)/)){close();out.push(`<blockquote>${inline(m[1])}</blockquote>`);continue}
    close();out.push(`<p>${inline(l)}</p>`);
  } close(); return out.join("")
}
function esc(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>")}

function openArticle(id){
  const a=state.articles.find(x=>x.id===id);if(!a)return;
  $("articlePath").textContent=folderPath(a.folder).join(" / ")+" / "+a.title;
  $("article").innerHTML=renderMarkdown(a.content);
  $("articleEditBtn").onclick=()=>editArticle(id);
  $("articleDeleteBtn").onclick=()=>deleteItem("article",id);
  $("articleNewBtn").onclick=()=>{ $("currentFolder").value=a.folder; show("manageView"); renderManage(); newArticle(); };
  $("articleNewSubBtn").onclick=()=>{ $("currentFolder").value=a.folder; show("manageView"); renderManage(); newFolder(); };
  $("backBtn").onclick=()=>openFolder(a.folder);
  $("crumb").textContent=a.title;
  show("articleView");window.scrollTo(0,0)
}

function fillFolderSelect(sel,includeRoot=false){
  const arr=includeRoot?state.folders:[...state.folders];
  sel.innerHTML=arr.map(f=>`<option value="${f.id}">${folderPath(f.id).join(" / ")}</option>`).join("")
}
function renderTree(){
  const roots=childrenFolders(null);
  $("tree").innerHTML=roots.map(renderFolder).join("");
  $("trashCount").textContent=state.trash.length;
}
function renderFolder(f){
  const arts=state.articles.filter(a=>a.folder===f.id).map(a=>`<button class="file" data-type="article" data-id="${a.id}" onclick="editArticle('${a.id}')" oncontextmenu="showContextMenu(event,'article','${a.id}')">📄 ${a.title}</button>`).join("");
  const subs=childrenFolders(f.id).map(renderFolder).join("");
  return `<div class="folder" data-type="folder" data-id="${f.id}">
    <div class="folder-title context-target" data-type="folder" data-id="${f.id}" oncontextmenu="showContextMenu(event,'folder','${f.id}')">📁 ${f.name}</div>
    ${arts}
    ${subs}
  </div>`
}
function renderManage(){fillFolderSelect($("currentFolder"));fillFolderSelect($("editFolder"));renderTree();fillFolderSelect($("parentFolder"));$("parentFolder").insertAdjacentHTML("afterbegin",`<option value="">Root</option>`)}

function showContextMenu(e,type,id){
  e.preventDefault();
  contextTarget={type,id};
  let menu=document.getElementById("contextMenu");
  if(!menu){
    menu=document.createElement("div"); menu.id="contextMenu"; menu.className="context-menu";
    menu.innerHTML=`
      <button data-act="article">📄 New Article / File</button>
      <button data-act="folder">📁 New Subfolder</button>
      <hr>
      <button data-act="rename">✎ Rename</button>
      <button data-act="delete">🗑 Delete</button>`;
    document.body.appendChild(menu);
    menu.addEventListener("click",contextAction);
  }
  menu.style.left=Math.min(e.clientX,window.innerWidth-230)+"px";
  menu.style.top=Math.min(e.clientY,window.innerHeight-210)+"px";
  menu.classList.add("show");
}
function hideContextMenu(){const m=document.getElementById("contextMenu");if(m)m.classList.remove("show")}
async function contextAction(e){
  const act=e.target.closest("button")?.dataset.act;
  if(!act||!contextTarget)return;
  const {type,id}=contextTarget;
  hideContextMenu();

  if(act==="article" && type==="folder"){
    show("manageView");
    renderManage();
    $("currentFolder").value=id;
    newArticle();
    return;
  }

  if(act==="folder" && type==="folder"){
    show("manageView");
    renderManage();
    $("currentFolder").value=id;
    newFolder();
    return;
  }

  if(act==="rename"){
    if(type==="folder"){
      const f=state.folders.find(x=>x.id===id);
      if(!f)return;
      const n=prompt("New folder name:",f.name);
      if(n&&n.trim()){
        const clean=n.trim();
        if(state.folders.some(x=>x.id!==id && x.parent===f.parent && x.name.toLowerCase()===clean.toLowerCase())){
          alert("A folder with this name already exists here.");
          return;
        }
        f.name=clean;
        saveState();renderNav();renderHome();renderManage();
      }
    } else {
      const a=state.articles.find(x=>x.id===id);
      if(!a)return;
      const n=prompt("New article/file name:",a.title);
      if(n&&n.trim()){
        const clean=n.trim();
        if(state.articles.some(x=>x.id!==id && x.folder===a.folder && x.title.toLowerCase()===clean.toLowerCase())){
          alert("An article with this name already exists in this folder.");
          return;
        }
        a.title=clean;
        saveState();renderNav();renderHome();renderManage();
      }
    }
    return;
  }

  if(act==="delete"){
    deleteItem(type,id);
  }
}

function deleteItem(type,id){
  if(!confirm("Move this item to the Recycle Bin?"))return;

  if(type==="article"){
    const i=state.articles.findIndex(a=>a.id===id);
    if(i<0)return;
    const [a]=state.articles.splice(i,1);
    state.trash.push({type:"article",item:a,deletedAt:new Date().toISOString()});
    saveState();renderNav();renderHome();renderManage();renderTrash();
    if(window.currentFolderId===a.folder) openFolder(a.folder);
    return;
  }

  const folderIds=[id];
  for(let i=0;i<folderIds.length;i++){
    for(const f of state.folders){
      if(f.parent===folderIds[i])folderIds.push(f.id);
    }
  }
  const arts=state.articles.filter(a=>folderIds.includes(a.folder));
  const folders=state.folders.filter(f=>folderIds.includes(f.id));
  const rootFolder=folders.find(f=>f.id===id);
  state.articles=state.articles.filter(a=>!folderIds.includes(a.folder));
  state.folders=state.folders.filter(f=>!folderIds.includes(f.id));

  state.trash.push({
    type:"folder",
    item:{name:rootFolder?.name||"Folder"},
    folders,articles:arts,
    deletedAt:new Date().toISOString()
  });

  saveState();renderNav();renderHome();renderManage();renderTrash();
  if(window.currentFolderId && folderIds.includes(window.currentFolderId)){
    if(rootFolder?.parent)openFolder(rootFolder.parent);else showHome();
  }
}

function renderTrash(){
  $("trashCount").textContent=state.trash.length;
  $("trashList").innerHTML=state.trash.length?state.trash.map((t,i)=>{
    const name=t.type==="article"?t.item.title:t.item.name;
    const icon=t.type==="article"?"📄":"📁";
    return `<div class="trash-row"><div>${icon} <b>${esc(name)}</b><small>${t.type} · deleted ${new Date(t.deletedAt).toLocaleString()}</small></div>
      <div><button onclick="restoreTrash(${i})">Restore</button><button class="danger-small" onclick="permanentTrash(${i})">Delete permanently</button></div></div>`
  }).join(""):`<div class="empty-trash">Recycle Bin is empty.</div>`;
}
function restoreTrash(i){
  const t=state.trash[i];
  if(!t)return;

  if(t.type==="article"){
    const a=t.item;
    if(state.articles.some(x=>x.folder===a.folder && x.title.toLowerCase()===a.title.toLowerCase())){
      alert("Restore failed: an article with this name already exists in the original folder.");
      return;
    }
    state.articles.push(a);
  }else{
    const ids=new Set(t.folders.map(f=>f.id));
    const collision=t.folders.some(f=>state.folders.some(x=>x.id!==f.id && x.parent===f.parent && x.name.toLowerCase()===f.name.toLowerCase()));
    if(collision){alert("Restore failed: a folder with the same name already exists at the original location.");return;}
    state.folders.push(...t.folders);
    state.articles.push(...t.articles);
  }

  state.trash.splice(i,1);
  saveState();renderNav();renderHome();renderManage();renderTrash();
}
function permanentTrash(i){if(confirm("Permanently delete this item? This cannot be undone.")){state.trash.splice(i,1);saveState();renderTrash();renderManage()}}
$("recycleBtn").onclick=()=>{show("recycleView");renderTrash()}
$("recycleBackBtn").onclick=()=>{show("manageView");renderManage()}
$("emptyTrashBtn").onclick=()=>{if(state.trash.length&&confirm("Permanently delete everything in the Recycle Bin?")){state.trash=[];saveState();renderTrash();renderManage()}}
document.addEventListener("contextmenu",e=>{
  const el=e.target.closest(".folder-title,.file");
  if(el) showContextMenu(e,el.dataset.type,el.dataset.id);
});
document.addEventListener("click",e=>{if(!e.target.closest("#contextMenu"))hideContextMenu()});

function editArticle(id){
  const a=state.articles.find(x=>x.id===id);
  if(!a){alert("Article not found.");return;}
  editingId=id;
  show("manageView");
  renderManage();
  $("editorEmpty").classList.add("hidden");
  $("folderEditor").classList.add("hidden");
  $("editor").classList.remove("hidden");
  $("editFolder").value=a.folder;
  $("editTitle").value=a.title;
  $("editContent").value=a.content;
  $("editTitle").focus();
}

function newArticle(folderId=null){
  editingId=null;
  show("manageView");
  renderManage();
  $("editorEmpty").classList.add("hidden");
  $("folderEditor").classList.add("hidden");
  $("editor").classList.remove("hidden");
  $("editTitle").value="";
  $("editContent").value="# New Topic\n\n## Overview\n\n- Start writing your notes here.\n- Add as many headings, subheadings and bullet points as you need.";
  if(folderId) $("editFolder").value=folderId;
  else if($("currentFolder").value) $("editFolder").value=$("currentFolder").value;
  $("editTitle").focus();
}

function newFolder(parentId=null){
  show("manageView");
  renderManage();
  $("editorEmpty").classList.add("hidden");
  $("editor").classList.add("hidden");
  $("folderEditor").classList.remove("hidden");
  $("folderName").value="";
  $("parentFolder").value=parentId || $("currentFolder").value || "";
  $("folderName").focus();
}

$("manageBtn").onclick=()=>{show("manageView");renderManage();};

$("newArticleBtn").onclick=()=>newArticle();
$("newFolderBtn").onclick=()=>newFolder();

$("saveBtn").onclick=async()=>{
  const title=$("editTitle").value.trim();
  const content=$("editContent").value.trim();
  const folder=$("editFolder").value;

  if(!title){alert("Please enter an article title.");$("editTitle").focus();return;}
  if(!content){alert("Please enter some content.");$("editContent").focus();return;}
  if(!folder){alert("Please select a folder.");$("editFolder").focus();return;}

  const duplicate=state.articles.find(a=>a.folder===folder && a.title.toLowerCase()===title.toLowerCase() && a.id!==editingId);
  if(duplicate){
    alert("An article with this name already exists in this folder.");
    $("editTitle").focus();
    return;
  }

  let saved;
  if(editingId){
    saved=state.articles.find(a=>a.id===editingId);
    if(!saved){alert("The article could not be found.");return;}
    Object.assign(saved,{title,content,folder});
  }else{
    saved={id:uid(),title,content,folder};
    state.articles.push(saved);
  }

  saveState();
  renderNav();renderHome();renderManage();

  if(connectedDir){
    try{
      await writeArticleToFolder(saved);
    }catch(err){
      console.error(err);
      alert("Article saved in the Knowledge Base, but it could not be written to CONTENT FOLDER. Check folder permission/access.");
    }
  }

  editingId=saved.id;
  alert("Article saved successfully.");
  openArticle(saved.id);
};

$("deleteBtn").onclick=()=>{
  if(!editingId){alert("This is a new unsaved article.");return;}
  deleteItem("article",editingId);
  editingId=null;
};

$("saveFolderBtn").onclick=()=>{
  const name=$("folderName").value.trim();
  const parent=$("parentFolder").value||null;

  if(!name){alert("Please enter a folder name.");$("folderName").focus();return;}
  if(state.folders.some(f=>f.parent===parent && f.name.toLowerCase()===name.toLowerCase())){
    alert("A folder with this name already exists here.");
    $("folderName").focus();
    return;
  }

  const f={id:uid(),name,parent};
  state.folders.push(f);
  saveState();renderNav();renderHome();renderManage();
  alert("Folder created successfully.");
  openFolder(f.id);
};

$("currentFolder").onchange=()=>{};

$("homeSearch").oninput=e=>renderHome(e.target.value)
$("sideSearch").oninput=e=>{
  const q=e.target.value.trim().toLowerCase();
  if(!q){renderNav();return;}

  const folderHits=state.folders.filter(f=>
    (f.name+" "+folderPath(f.id).join(" ")).toLowerCase().includes(q)
  );
  const articleHits=state.articles.filter(a=>
    (a.title+" "+a.content+" "+folderPath(a.folder).join(" ")).toLowerCase().includes(q)
  );

  if(!folderHits.length && !articleHits.length){
    $("nav").innerHTML=`<div class="group">SEARCH RESULTS</div><div style="padding:10px;color:#8eacc9;font-size:12px">No results for "${esc(e.target.value)}"</div>`;
    return;
  }

  $("nav").innerHTML=`<div class="group">SEARCH RESULTS</div>`+
    folderHits.map(f=>`<button onclick="openFolder('${f.id}')">📁 ${esc(f.name)}</button>`).join("")+
    articleHits.map(a=>`<button onclick="openArticle('${a.id}')">📄 ${esc(a.title)}</button>`).join("");
}
$("themeBtn").onclick=()=>document.body.classList.toggle("dark");
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(!$("homeView").classList.contains("hidden"))$("homeSearch").focus();else $("sideSearch").focus()}})
async function connectFolder(){
  if(!window.showDirectoryPicker)return alert("Your browser does not support folder access. Use current Edge/Chrome with the site running through Live Server.");
  try{connectedDir=await window.showDirectoryPicker({mode:"readwrite"});$("folderStatus").textContent="Connected: "+connectedDir.name;await importFolder(connectedDir);renderNav();renderHome();renderManage();alert("CONTENT FOLDER connected and read.")}
  catch(e){if(e.name!=="AbortError")alert("Could not connect to the folder: "+e.message)}
}
async function importFolder(dir){
  async function walk(d,parentName=""){
    for await(const [name,h] of d.entries()){
      if(h.kind==="directory"){let f=state.folders.find(x=>x.name===name&&x.parent===parentName);if(!f){f={id:uid(),name,parent:parentName||null};state.folders.push(f)}await walk(h,f.id)}
      else if(/\.(txt|md)$/i.test(name)){
        const file=await h.getFile(),content=await file.text(),title=name.replace(/\.(txt|md)$/i,"");
        let folder=state.folders.find(x=>x.id===parentName)||state.folders.find(x=>x.name==="Notes");
        if(!folder){folder={id:uid(),name:"Notes",parent:null};state.folders.push(folder)}
        let a=state.articles.find(x=>x.title===title&&x.folder===folder.id);if(a)a.content=content;else state.articles.push({id:uid(),folder:folder.id,title,content})
      }
    }
  }
  await walk(dir);saveState()
}
async function writeArticleToFolder(a){
  async function ensure(root,parts){let d=root;for(const p of parts){d=await d.getDirectoryHandle(p,{create:true})}return d}
  const d=await ensure(connectedDir,folderPath(a.folder));const h=await d.getFileHandle(a.title+".txt",{create:true});const w=await h.createWritable();await w.write(a.content);await w.close()
}
$("connectBtn").onclick=connectFolder;
$("importBtn").onclick=connectFolder;

$("folderBackBtn").onclick=()=>{
  if(window.currentFolderId){
    const current=state.folders.find(f=>f.id===window.currentFolderId);
    if(current?.parent) openFolder(current.parent); else showHome();
  }else showHome();
};
$("folderFilter").oninput=e=>{
  if(window.currentFolderId) renderFolderContents(window.currentFolderId,e.target.value);
};
$("folderNewArticleBtn").onclick=()=>{
  const current=state.folders.find(f=>f.id===window.currentFolderId);
  if(!current)return;
  show("manageView");renderManage();$("currentFolder").value=current.id;newArticle();
};
$("folderNewSubBtn").onclick=()=>{
  const current=state.folders.find(f=>f.id===window.currentFolderId);
  if(!current)return;
  show("manageView");renderManage();$("currentFolder").value=current.id;newFolder();
};

$("exportBtn").onclick=async()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="knowledge-base-backup.json";a.click();URL.revokeObjectURL(a.href)}

// GitHub Pages cannot write changes back to repository files. Hide editing controls
// so visitors do not mistake browser-only edits for TXT-file updates.
function enableReadOnlyMode(){
  ["manageBtn","folderNewSubBtn","folderNewArticleBtn","articleEditBtn","articleNewSubBtn","articleNewBtn","articleDeleteBtn"].forEach(id=>{
    const el=$(id); if(el) el.style.display="none";
  });
  ["manageView","recycleView"].forEach(id=>{const el=$(id); if(el) el.style.display="none";});
  const empty=$("overviewEmpty");
  if(empty) empty.innerHTML="<b>Content could not be loaded.</b><span>Check that content-index.json exists in the published website.</span>";
}
enableReadOnlyMode();
loadState().then(()=>{renderNav();renderHome();}).catch(err=>{
  console.error(err);
  const nav=$("nav"), cards=$("folderCards"), count=$("docCount");
  if(nav) nav.innerHTML='<div class="group">CONTENT ERROR</div><div style="padding:10px;color:#8eacc9;font-size:12px">Could not load the TXT content index.</div>';
  if(cards) cards.innerHTML='<div class="empty-state">Could not load content-index.json. Check the GitHub Pages deployment and repository files.</div>';
  if(count) count.textContent="Content unavailable";
});
