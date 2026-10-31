const KEY="ssr-kb-v4-complete-tree";
let state={folders:[],articles:[],trash:[]}, connectedDir=null, editingId=null, editingFormat="markdown", contextTarget=null;

const $=id=>document.getElementById(id);
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
function saveState(){localStorage.setItem(KEY,JSON.stringify(state))}

// Image binaries live in IndexedDB (not localStorage) so larger images do not
// exhaust the browser's small localStorage quota.
const ASSET_DB="technical-kb-assets", ASSET_STORE="images";
function openAssetDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(ASSET_DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(ASSET_STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putAsset(id,blob){const db=await openAssetDB();return new Promise((resolve,reject)=>{const tx=db.transaction(ASSET_STORE,"readwrite");tx.objectStore(ASSET_STORE).put(blob,id);tx.oncomplete=()=>{db.close();resolve(id)};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function getAsset(id){const db=await openAssetDB();return new Promise((resolve,reject)=>{const tx=db.transaction(ASSET_STORE,"readonly"),req=tx.objectStore(ASSET_STORE).get(id);req.onsuccess=()=>{db.close();resolve(req.result||null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function storeDataUrl(dataUrl){const [meta,data]=dataUrl.split(",");const mime=(meta.match(/data:(.*?);base64/)||[])[1]||"image/png";const binary=atob(data);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const id=uid();await putAsset(id,new Blob([bytes],{type:mime}));return id}
async function hydrateImages(root){for(const img of root.querySelectorAll('img[src^="kbasset:"]')){const id=img.getAttribute("src").slice(8);try{const blob=await getAsset(id);if(blob)img.src=URL.createObjectURL(blob);else img.alt=(img.alt||"Image")+" (missing image file)"}catch(err){console.warn("Could not load stored image",err)}}}
function cleanDocxHtml(html){const parsed=new DOMParser().parseFromString(html,"text/html");const allowed=new Set(["P","BR","H1","H2","H3","H4","UL","OL","LI","STRONG","B","EM","I","U","BLOCKQUOTE","TABLE","THEAD","TBODY","TR","TH","TD","A","IMG","PRE","CODE"]);function clean(node){for(const child of [...node.children]){if(!allowed.has(child.tagName)){child.replaceWith(...child.childNodes);continue}for(const attr of [...child.attributes]){if(child.tagName==="IMG"&&attr.name==="src"&&(/^(data:image\/|kbasset:)/i).test(attr.value))continue;if(child.tagName==="A"&&attr.name==="href"&&/^https?:|^mailto:/i.test(attr.value))continue;child.removeAttribute(attr.name)}clean(child)}}clean(parsed.body);return parsed.body.innerHTML}

async function loadState(){
  let savedState=null;
  const saved=localStorage.getItem(KEY);
  if(saved){
    try{
      const parsed=JSON.parse(saved);
      if(Array.isArray(parsed.folders)&&Array.isArray(parsed.articles)) savedState=parsed;
    }catch(e){console.warn("Saved browser data could not be read.",e)}
  }
  try{
    const response=await fetch("content-index.json",{cache:"no-store"});
    if(!response.ok)throw new Error("No published content-index.json found.");
    const data=await response.json();
    if(!Array.isArray(data.folders)||!Array.isArray(data.articles))throw new Error("Unexpected content-index.json format.");
    // Published repository entries take precedence; browser-only entries and trash remain.
    const mergeById=(published,local)=>{
      const merged=new Map((local||[]).map(item=>[item.id,item]));
      for(const item of (published||[])) merged.set(item.id,item);
      return [...merged.values()];
    };
    state={
      folders:mergeById(data.folders,savedState?.folders),
      articles:mergeById(data.articles,savedState?.articles),
      trash:Array.isArray(savedState?.trash)?savedState.trash:[]
    };
    saveState();
  }catch(err){
    if(savedState){state={folders:savedState.folders,articles:savedState.articles,trash:Array.isArray(savedState.trash)?savedState.trash:[]};}
    else state={folders:[],articles:[],trash:[]};
    console.info("Using saved browser content because the published index could not be refreshed:",err.message);
  }
}
function byOrder(items){return [...items].sort((a,b)=>(a.order??0)-(b.order??0))}
function renumber(items){items.forEach((item,index)=>item.order=index)}
function dragStart(event,type,id){
  event.stopPropagation();event.dataTransfer.effectAllowed="move";
  event.dataTransfer.setData("text/plain",JSON.stringify({type,id}));
}
function allowDrop(event){event.preventDefault();event.dataTransfer.dropEffect="move"}
function dropOn(event,targetType,targetId){
  event.preventDefault();event.stopPropagation();
  let dragged;try{dragged=JSON.parse(event.dataTransfer.getData("text/plain"))}catch(e){return}
  if(!dragged||dragged.id===targetId)return;
  const collection=dragged.type==="folder"?state.folders:state.articles;
  const item=collection.find(x=>x.id===dragged.id);if(!item)return;
  if(targetType==="folder-container" || (targetType==="folder" && dragged.type==="article")){
    if(dragged.type==="folder"){
      let parent=state.folders.find(x=>x.id===targetId),guard=0;
      while(parent&&guard++<100){if(parent.id===item.id){alert("A folder cannot be moved into itself or one of its subfolders.");return}parent=state.folders.find(x=>x.id===parent.parent)}
      item.parent=targetId;
    }else item.folder=targetId;
    const siblings=dragged.type==="folder"?state.folders.filter(x=>x.parent===targetId&&x.id!==item.id):state.articles.filter(x=>x.folder===targetId&&x.id!==item.id);
    item.order=siblings.length;
  }else{
    if(dragged.type!==targetType)return;
    const target=(targetType==="folder"?state.folders:state.articles).find(x=>x.id===targetId);if(!target)return;
    const parentKey=targetType==="folder"?"parent":"folder";item[parentKey]=target[parentKey];
    const siblings=(targetType==="folder"?state.folders:state.articles).filter(x=>x[parentKey]===target[parentKey]&&x.id!==item.id);
    const index=siblings.findIndex(x=>x.id===targetId);siblings.splice(index<0?siblings.length:index,0,item);renumber(siblings);
  }
  saveState();renderNav();renderHome();renderManage();
  if(window.currentFolderId)renderFolderContents(window.currentFolderId,$("folderFilter")?.value||"");
}
function folderPath(id){let a=[],f=state.folders.find(x=>x.id===id),guard=0;while(f&&guard++<30){a.unshift(f.name);f=state.folders.find(x=>x.id===f.parent)}return a}
function childrenFolders(parent=null){return state.folders.filter(f=>f.parent===parent)}
function renderNavFolder(f, depth=0){
  const articles=byOrder(state.articles.filter(a=>a.folder===f.id));
  const subs=byOrder(childrenFolders(f.id));
  return `
    <div class="nav-node" style="--depth:${depth}">
      <button class="nav-folder" type="button" onclick="openFolder('${f.id}')" title="${esc(f.name)}">
        <span class="nav-folder-icon">>📁</span><span class="nav-item-name">${esc(f.name)}</span>
      </button>
      ${articles.map(a=>`<button class="nav-article" type="button" onclick="openArticle('${a.id}')" title="${esc(a.title)}"><span class="nav-doc-icon">▤</span><span class="nav-item-name">${esc(a.title)}</span></button>`).join("")}
      ${subs.map(child=>renderNavFolder(child,depth+1)).join("")}
    </div>`;
}
function renderNav(){
  const roots=byOrder(childrenFolders(null));
  $("nav").innerHTML=`
    <div class="nav-section-label">YOUR LIBRARY</div>
    ${roots.map(f=>renderNavFolder(f)).join("") || '<div class="nav-empty">No folders yet.</div>'}`;
}

window.openFolder = openFolder;
window.openArticle = openArticle;

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
  if($("crumb")) $("crumb").textContent=f.name;
  show("folderView");
  window.scrollTo(0,0);
}

function renderFolderContents(id,filter=""){
  const f=state.folders.find(x=>x.id===id); if(!f)return;
  const childFolders=byOrder(state.folders.filter(x=>x.parent===id));
  const childArticles=byOrder(state.articles.filter(x=>x.folder===id));
  const q=filter.toLowerCase();
  const folders=childFolders.filter(x=>!q||x.name.toLowerCase().includes(q));
  const articles=childArticles.filter(x=>!q||(x.title+" "+x.content).toLowerCase().includes(q));

  let html="";
  if(!q || folders.length){
    html += `<div class="content-section"><div class="content-section-title">FOLDERS <span>${folders.length}</span></div><div class="item-grid">
      ${folders.map(x=>`<div class="content-item folder-item" draggable="true" ondragstart='dragStart(event,"folder","${x.id}")' ondragover="allowDrop(event)" ondrop='dropOn(event,"folder","${x.id}")' data-type="folder" data-id="${x.id}" onclick="openFolder('${x.id}')" oncontextmenu="showContextMenu(event,'folder','${x.id}')">
        <div class="item-icon">📁</div><div><b>${esc(x.name)}</b><small>${state.folders.filter(s=>s.parent===x.id).length} subfolder(s) · ${state.articles.filter(a=>a.folder===x.id).length} article(s)</small></div><span>›</span>
      </div>`).join("")}
      ${folders.length===0?`<div class="empty-state compact">No subfolders here.</div>`:""}
    </div></div>`;
  }

  html += `<div class="content-section"><div class="content-section-title">ARTICLES <span>${articles.length}</span></div><div class="item-grid">
    ${articles.map(a=>`<div class="content-item article-item" draggable="true" ondragstart='dragStart(event,"article","${a.id}")' ondragover="allowDrop(event)" ondrop='dropOn(event,"article","${a.id}")' data-type="article" data-id="${a.id}" onclick="openArticle('${a.id}')" oncontextmenu="showContextMenu(event,'article','${a.id}')">
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
function showHome(){show("homeView");if($("crumb")) $("crumb").textContent="Home";renderHome();window.scrollTo(0,0)}


function renderHome(query=""){
  const q=String(query||"").trim().toLowerCase();
  const container=$("folderCards");
  if(!container)return;

  const roots=byOrder(state.folders.filter(f=>f.parent===null));
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


window.showHome = showHome;

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
    if(m=l.match(/^!\[([^\]]*)\]\((kbasset:[^)]+)\)$/)){close();out.push(`<p><img class="kb-inline-image" alt="${esc(m[1])}" src="${m[2]}"></p>`);continue}
    close();out.push(`<p>${inline(l)}</p>`);
  } close(); return out.join("")
}
function esc(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>")}

async function openArticle(id){
  const a=state.articles.find(x=>x.id===id);if(!a)return;
  $("articlePath").textContent=folderPath(a.folder).join(" / ")+" / "+a.title;
  const articleElement=$("article");
  articleElement.innerHTML='<p class="muted">Loading document...</p>';
  show("articleView");window.scrollTo(0,0);
  try{
    if(a.sourceFormat==="docx"||a.contentFormat==="docx"){
      if(!window.mammoth)throw new Error("The Word DOCX reader did not load. Check your internet connection and retry.");
      if(!a.path)throw new Error("The DOCX file path is missing from content-index.json.");
      const relativePath=a.path.split("/").map(encodeURIComponent).join("/");
      const response=await fetch("content/"+relativePath,{cache:"no-store"});
      if(!response.ok)throw new Error("Could not load content/"+a.path+" (HTTP "+response.status+").");
      const result=await window.mammoth.convertToHtml({arrayBuffer:await response.arrayBuffer()},{
        convertImage:window.mammoth.images.inline(async image=>({src:`data:${image.contentType};base64,${await image.read("base64")}`}))
      });
      articleElement.innerHTML=cleanDocxHtml(result.value||"");
    }else{
      articleElement.innerHTML=a.contentFormat==="html"?a.content:renderMarkdown(a.content);
    }
    hydrateImages(articleElement);
  }catch(err){
    console.error("Document display failed:",err);
    articleElement.innerHTML="<p>Unable to display this document. "+esc(err.message)+"</p>";
  }
  $("articleEditBtn").onclick=()=>editArticle(id);
  $("articleDeleteBtn").onclick=()=>deleteItem("article",id);
  $("articleNewBtn").onclick=()=>{ $("currentFolder").value=a.folder; show("manageView"); renderManage(); newArticle(); };
  $("articleNewSubBtn").onclick=()=>{ $("currentFolder").value=a.folder; show("manageView"); renderManage(); newFolder(); };
  $("backBtn").onclick=()=>openFolder(a.folder);
  if($("crumb")) $("crumb").textContent=a.title;
  show("articleView");window.scrollTo(0,0)
}

function fillFolderSelect(sel,includeRoot=false){
  const arr=includeRoot?state.folders:[...state.folders];
  sel.innerHTML=arr.map(f=>`<option value="${f.id}">${folderPath(f.id).join(" / ")}</option>`).join("")
}
function renderTree(){
  const roots=byOrder(childrenFolders(null));
  $("tree").innerHTML=roots.map(renderFolder).join("");
  $("trashCount").textContent=state.trash.length;
}
function renderFolder(f){
  const arts=byOrder(state.articles.filter(a=>a.folder===f.id)).map(a=>`<button class="file" draggable="true" ondragstart='dragStart(event,"article","${a.id}")' ondragover="allowDrop(event)" ondrop='dropOn(event,"article","${a.id}")' data-type="article" data-id="${a.id}" onclick="editArticle('${a.id}')" oncontextmenu="showContextMenu(event,'article','${a.id}')">📄 ${a.title}</button>`).join("");
  const subs=byOrder(childrenFolders(f.id)).map(renderFolder).join("");
  return `<div class="folder" data-type="folder" data-id="${f.id}" ondragover="allowDrop(event)" ondrop='dropOn(event,"folder-container","${f.id}")'>
    <div class="folder-title context-target" draggable="true" ondragstart='dragStart(event,"folder","${f.id}")' ondragover="allowDrop(event)" ondrop='dropOn(event,"folder","${f.id}")' data-type="folder" data-id="${f.id}" oncontextmenu="showContextMenu(event,'folder','${f.id}')">📁 ${f.name}</div>
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
  editingFormat=a.contentFormat||"markdown";
  show("manageView");
  renderManage();
  $("editorEmpty").classList.add("hidden");
  $("folderEditor").classList.add("hidden");
  $("editor").classList.remove("hidden");
  $("editFolder").value=a.folder;
  $("editTitle").value=a.title;
  $("editContent").value=a.content;
  $("editorFormatNote").textContent=a.contentFormat==="html"?"Imported Word document: converted to displayable HTML. Edit the text below only if you want to replace the imported layout.":"Text/Markdown editor. Uploaded images are inserted at the cursor position.";
  $("editTitle").focus();
}

function newArticle(folderId=null){
  editingId=null;editingFormat="markdown";
  show("manageView");
  renderManage();
  $("editorEmpty").classList.add("hidden");
  $("folderEditor").classList.add("hidden");
  $("editor").classList.remove("hidden");
  $("editTitle").value="";
  $("editContent").value="# New Topic\n\n## Overview\n\n- Start writing your notes here.\n- Add as many headings, subheadings and bullet points as you need.";
  $("editorFormatNote").textContent="Text/Markdown editor. Uploaded images are inserted at the cursor position.";
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
  let content=$("editContent").value.trim();
  const contentFormat=editingId?editingFormat:"markdown";
  if(contentFormat==="html")content=cleanDocxHtml(content);
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
    Object.assign(saved,{title,content,folder,contentFormat});
  }else{
    saved={id:uid(),title,content,folder,contentFormat:"markdown",order:state.articles.filter(a=>a.folder===folder).length};
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
  alert("Article saved in this browser. Use Export content to create a portable backup.");
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

  const f={id:uid(),name,parent,order:state.folders.filter(x=>x.parent===parent).length};
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

$("uploadDocsBtn")?.addEventListener("click",()=> $("documentUpload").click());
$("documentUpload")?.addEventListener("change",async e=>{
  const files=[...e.target.files||[]];if(!files.length)return;
  const folder=window.currentFolderId||$("currentFolder")?.value||state.folders[0]?.id;
  if(!folder){alert("Create a folder first, then upload files into it.");e.target.value="";return}
  let imported=0;
  for(const file of files){
    const ext=file.name.split(".").pop().toLowerCase();let content="",format="markdown";
    try{
      if(["png","jpg","jpeg","gif","webp","bmp"].includes(ext)||file.type.startsWith("image/")){
        const id=uid();await putAsset(id,file);content=`![${file.name.replace(/\.[^.]+$/,"") }](kbasset:${id})`;
      }else if(ext==="txt"||ext==="md")content=await file.text();
      else if(ext==="docx"){
        if(!window.mammoth){alert("The Word DOCX reader did not load. Check your internet connection and retry.");continue}
        const result=await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{convertImage:window.mammoth.images.inline(async image=>({src:`data:${image.contentType};base64,${await image.read("base64")}`}))});
        let html=cleanDocxHtml(result.value||"");
        const doc=new DOMParser().parseFromString(html,"text/html");
        for(const img of doc.querySelectorAll('img[src^="data:image/"]')){const id=await storeDataUrl(img.getAttribute("src"));img.setAttribute("src",`kbasset:${id}`)}
        content=doc.body.innerHTML;format="html";
      }else if(ext==="doc"){alert(file.name+" is an older .doc file. Save it as .docx in Word, then upload again.");continue}
      else continue;
      const title=file.name.replace(/\.(txt|md|docx|png|jpe?g|gif|webp|bmp)$/i,"");
      const existing=state.articles.find(a=>a.folder===folder&&a.title.toLowerCase()===title.toLowerCase());
      if(existing){if(!confirm(title+" already exists. Replace its content?"))continue;Object.assign(existing,{content,contentFormat:format,sourceFormat:ext})}
      else state.articles.push({id:uid(),folder,title,content,contentFormat:format,sourceFormat:ext,order:state.articles.filter(a=>a.folder===folder).length});
      imported++;
    }catch(err){console.error(err);alert("Could not import "+file.name+": "+err.message)}
  }
  saveState();renderNav();renderHome();renderManage();e.target.value="";
  if(window.currentFolderId)renderFolderContents(window.currentFolderId);
  alert(`${imported} file(s) imported. Images are stored in this browser's IndexedDB.`);
});

$("addImagesBtn")?.addEventListener("click",()=>$("inlineImageUpload").click());
$("inlineImageUpload")?.addEventListener("change",async e=>{
  const files=[...e.target.files||[]];if(!files.length)return;
  const textarea=$("editContent");let inserted="";
  for(const file of files){
    if(!file.type.startsWith("image/"))continue;
    try{const id=uid();await putAsset(id,file);inserted+=`\n![${file.name.replace(/\.[^.]+$/,"") }](kbasset:${id})\n`;}
    catch(err){alert("Could not store "+file.name+": "+err.message)}
  }
  const start=textarea.selectionStart,end=textarea.selectionEnd;
  textarea.value=textarea.value.slice(0,start)+inserted+textarea.value.slice(end);
  textarea.focus();textarea.selectionStart=textarea.selectionEnd=start+inserted.length;e.target.value="";
});

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

$("exportBtn").onclick=async()=>{
  const ids=new Set();
  const allArticles=[...state.articles,...state.trash.flatMap(t=>t.type==="article"?[t.item]:(t.articles||[]))];
  for(const article of allArticles){for(const match of String(article.content||"").matchAll(/kbasset:([A-Za-z0-9-]+)/g))ids.add(match[1])}
  const assets={};
  for(const id of ids){const blob=await getAsset(id);if(blob)assets[id]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
  const backup={...state,assets};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="knowledge-base-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

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
// Editing is enabled. GitHub Pages stores changes in this browser; export a backup to move them elsewhere.
loadState().then(()=>{renderNav();renderHome();}).catch(err=>{
  console.error(err);
  const nav=$("nav"), cards=$("folderCards"), count=$("docCount");
  if(nav) nav.innerHTML='<div class="group">CONTENT ERROR</div><div style="padding:10px;color:#8eacc9;font-size:12px">No published content index found. Create folders or upload documents.</div>';
  if(cards) cards.innerHTML='<div class="empty-state">Your workspace is empty. Create a folder or upload a document to get started.</div>';
  if(count) count.textContent="Content unavailable";
});
