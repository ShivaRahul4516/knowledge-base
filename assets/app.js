
const KEY = "ssr-kb-v4-complete-tree";

let state = { folders: [], articles: [], trash: [] };
let connectedDir = null;
let editingId = null;
let editingFormat = "markdown";
let contextTarget = null;

const $ = id => document.getElementById(id);

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random();
}

function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function byOrder(items) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function renumber(items) {
  items.forEach((item, index) => item.order = index);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

/* =========================================
   IMAGE STORAGE - INDEXED DB
========================================= */

const ASSET_DB = "technical-kb-assets";
const ASSET_STORE = "images";

function openAssetDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ASSET_DB, 1);

    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(ASSET_STORE)) {
        req.result.createObjectStore(ASSET_STORE);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAsset(id, blob) {
  const db = await openAssetDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).put(blob, id);

    tx.oncomplete = () => {
      db.close();
      resolve(id);
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getAsset(id) {
  const db = await openAssetDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE, "readonly");
    const req = tx.objectStore(ASSET_STORE).get(id);

    req.onsuccess = () => {
      db.close();
      resolve(req.result || null);
    };

    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function storeDataUrl(dataUrl) {
  const [meta, data] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "image/png";

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const id = uid();
  await putAsset(id, new Blob([bytes], { type: mime }));

  return id;
}

async function hydrateImages(root) {
  for (const img of root.querySelectorAll('img[src^="kbasset:"]')) {
    const id = img.getAttribute("src").slice(8);

    try {
      const blob = await getAsset(id);

      if (blob) {
        img.src = URL.createObjectURL(blob);
      } else {
        img.alt = (img.alt || "Image") + " (missing image file)";
      }
    } catch (err) {
      console.warn("Could not load stored image", err);
    }
  }
}

/* =========================================
   DOCX HTML CLEANING
========================================= */

function cleanDocxHtml(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");

  const allowed = new Set([
    "P", "BR", "H1", "H2", "H3", "H4",
    "UL", "OL", "LI", "STRONG", "B",
    "EM", "I", "U", "BLOCKQUOTE",
    "TABLE", "THEAD", "TBODY", "TR",
    "TH", "TD", "A", "IMG", "PRE", "CODE"
  ]);

  function clean(node) {
    for (const child of [...node.children]) {
      if (!allowed.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }

      for (const attr of [...child.attributes]) {
        if (
          child.tagName === "IMG" &&
          attr.name === "src" &&
          /^(data:image\/|kbasset:)/i.test(attr.value)
        ) continue;

        if (
          child.tagName === "A" &&
          attr.name === "href" &&
          /^https?:|^mailto:/i.test(attr.value)
        ) continue;

        child.removeAttribute(attr.name);
      }

      clean(child);
    }
  }

  clean(parsed.body);
  return parsed.body.innerHTML;
}

/* =========================================
   LOAD AND SAVE DATA
========================================= */

async function loadState() {
  const saved = localStorage.getItem(KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);

      if (
        Array.isArray(parsed.folders) &&
        Array.isArray(parsed.articles)
      ) {
        state = {
          folders: parsed.folders,
          articles: parsed.articles,
          trash: Array.isArray(parsed.trash) ? parsed.trash : []
        };

        return;
      }
    } catch (e) {
      console.warn("Saved browser data could not be read.", e);
    }
  }

  try {
    const response = await fetch("content-index.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("No published content-index.json found.");
    }

    const data = await response.json();

    if (
      !Array.isArray(data.folders) ||
      !Array.isArray(data.articles)
    ) {
      throw new Error("Unexpected content-index.json format.");
    }

    state = {
      folders: data.folders,
      articles: data.articles,
      trash: []
    };

    saveState();

  } catch (err) {
    state = { folders: [], articles: [], trash: [] };
    console.info("Starting with an empty workspace:", err.message);
  }
}

/* =========================================
   FOLDER HELPERS
========================================= */

function childrenFolders(parent = null) {
  return state.folders.filter(f => f.parent === parent);
}

function folderPath(id) {
  const path = [];
  let folder = state.folders.find(x => x.id === id);
  let guard = 0;

  while (folder && guard++ < 30) {
    path.unshift(folder.name);
    folder = state.folders.find(x => x.id === folder.parent);
  }

  return path;
}

function folderChildren(folderId) {
  return {
    folders: state.folders.filter(f => f.parent === folderId),
    articles: state.articles.filter(a => a.folder === folderId)
  };
}

/* =========================================
   DRAG AND DROP
========================================= */

function dragStart(event, type, id) {
  event.stopPropagation();
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
}

function allowDrop(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function dropOn(event, targetType, targetId) {
  event.preventDefault();
  event.stopPropagation();

  let dragged;

  try {
    dragged = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch (e) {
    return;
  }

  if (!dragged || dragged.id === targetId) return;

  const collection = dragged.type === "folder"
    ? state.folders
    : state.articles;

  const item = collection.find(x => x.id === dragged.id);

  if (!item) return;

  if (
    targetType === "folder-container" ||
    (targetType === "folder" && dragged.type === "article")
  ) {
    if (dragged.type === "folder") {
      let parent = state.folders.find(x => x.id === targetId);
      let guard = 0;

      while (parent && guard++ < 100) {
        if (parent.id === item.id) {
          alert("A folder cannot be moved into itself or one of its subfolders.");
          return;
        }

        parent = state.folders.find(x => x.id === parent.parent);
      }

      item.parent = targetId;

    } else {
      item.folder = targetId;
    }

    const siblings = dragged.type === "folder"
      ? state.folders.filter(x => x.parent === targetId && x.id !== item.id)
      : state.articles.filter(x => x.folder === targetId && x.id !== item.id);

    item.order = siblings.length;

  } else {
    if (dragged.type !== targetType) return;

    const target = (
      targetType === "folder" ? state.folders : state.articles
    ).find(x => x.id === targetId);

    if (!target) return;

    const parentKey = targetType === "folder" ? "parent" : "folder";

    item[parentKey] = target[parentKey];

    const siblings = (
      targetType === "folder" ? state.folders : state.articles
    ).filter(x => x[parentKey] === target[parentKey] && x.id !== item.id);

    const index = siblings.findIndex(x => x.id === targetId);

    siblings.splice(index < 0 ? siblings.length : index, 0, item);
    renumber(siblings);
  }

  saveState();
  renderNav();
  renderHome();
  renderManage();

  if (window.currentFolderId) {
    renderFolderContents(
      window.currentFolderId,
      $("folderFilter")?.value || ""
    );
  }
}

/* =========================================
   SIDEBAR NAVIGATION
========================================= */

function renderNavFolder(folder, depth = 0) {
  const articles = byOrder(
    state.articles.filter(a => a.folder === folder.id)
  );

  const subs = byOrder(childrenFolders(folder.id));

  return `
    <div class="nav-node" style="--depth:${depth}">
      <button
        class="nav-folder"
        type="button"
        onclick="openFolder('${folder.id}')"
        title="${esc(folder.name)}"
      >
        <span class="nav-folder-icon">📁</span>
        <span class="nav-item-name">${esc(folder.name)}</span>
      </button>

      ${articles.map(article => `
        <button
          class="nav-article"
          type="button"
          onclick="openArticle('${article.id}')"
          title="${esc(article.title)}"
        >
          <span class="nav-doc-icon">📄</span>
          <span class="nav-item-name">${esc(article.title)}</span>
        </button>
      `).join("")}

      ${subs.map(child => renderNavFolder(child, depth + 1)).join("")}
    </div>
  `;
}

function renderNav() {
  const roots = byOrder(childrenFolders(null));

  $("nav").innerHTML = `
    <div class="nav-section-label">YOUR LIBRARY</div>
    ${
      roots.map(folder => renderNavFolder(folder)).join("") ||
      '<div class="nav-empty">No folders yet.</div>'
    }
  `;
}

/* =========================================
   VIEW MANAGEMENT
========================================= */

function show(view) {
  [
    "homeView",
    "folderView",
    "articleView",
    "manageView",
    "recycleView"
  ].forEach(id => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });

  const target = $(view);

  if (target) {
    target.classList.remove("hidden");
  }
}


function showHome() {
  show("homeView");
  renderHome();
  window.scrollTo(0, 0);
}

window.showHome = showHome;

// Register the Home button click event only once.
$("homeBtn").addEventListener("click", showHome);


/* =========================================
   FOLDER BREADCRUMB
========================================= */

function folderBreadcrumbHtml(folderId) {
  const path = [];
  let folder = state.folders.find(x => x.id === folderId);
  let guard = 0;

  while (folder && guard++ < 30) {
    path.unshift(folder);
    folder = state.folders.find(x => x.id === folder.parent);
  }

  return `
    <button onclick="showHome()">Home</button>
    ${path.map(p => `
      <span>›</span>
      <button onclick="openFolder('${p.id}')">${esc(p.name)}</button>
    `).join("")}
  `;
}

/* =========================================
   OPEN FOLDER
========================================= */

function openFolder(id) {
  const folder = state.folders.find(x => x.id === id);

  if (!folder) return;

  window.currentFolderId = id;

  $("folderTitle").textContent = folder.name;
  $("folderBreadcrumb").innerHTML = folderBreadcrumbHtml(id);
  $("folderFilter").value = "";

  renderFolderContents(id, "");

  show("folderView");
  window.scrollTo(0, 0);
}

window.openFolder = openFolder;

/* =========================================
   RENDER FOLDER CONTENTS
========================================= */

function renderFolderContents(id, filter = "") {
  const folder = state.folders.find(x => x.id === id);

  if (!folder) return;

  const childFolders = byOrder(
    state.folders.filter(x => x.parent === id)
  );

  const childArticles = byOrder(
    state.articles.filter(x => x.folder === id)
  );

  const query = filter.toLowerCase();

  const folders = childFolders.filter(x =>
    !query || x.name.toLowerCase().includes(query)
  );

  const articles = childArticles.filter(x =>
    !query ||
    (x.title + " " + x.content).toLowerCase().includes(query)
  );

  let html = "";

  if (!query || folders.length) {
    html += `
      <div class="content-section">
        <div class="content-section-title">
          FOLDERS <span>${folders.length}</span>
        </div>

        <div class="item-grid">
          ${folders.map(x => `
            <div
              class="content-item folder-item"
              draggable="true"
              ondragstart='dragStart(event,"folder","${x.id}")'
              ondragover="allowDrop(event)"
              ondrop='dropOn(event,"folder","${x.id}")'
              data-type="folder"
              data-id="${x.id}"
              onclick="openFolder('${x.id}')"
              oncontextmenu="showContextMenu(event,'folder','${x.id}')"
            >
              <div class="item-icon">📁</div>
              <div>
                <b>${esc(x.name)}</b>
                <small>
                  ${state.folders.filter(s => s.parent === x.id).length}
                  subfolder(s) ·
                  ${state.articles.filter(a => a.folder === x.id).length}
                  article(s)
                </small>
              </div>
              <span>›</span>
            </div>
          `).join("")}

          ${
            folders.length === 0
              ? '<div class="empty-state compact">No subfolders here.</div>'
              : ""
          }
        </div>
      </div>
    `;
  }

  html += `
    <div class="content-section">
      <div class="content-section-title">
        ARTICLES <span>${articles.length}</span>
      </div>

      <div class="item-grid">
        ${articles.map(article => `
          <div
            class="content-item article-item"
            draggable="true"
            ondragstart='dragStart(event,"article","${article.id}")'
            ondragover="allowDrop(event)"
            ondrop='dropOn(event,"article","${article.id}")'
            data-type="article"
            data-id="${article.id}"
            onclick="openArticle('${article.id}')"
            oncontextmenu="showContextMenu(event,'article','${article.id}')"
          >
            <div class="item-icon">📄</div>
            <div>
              <b>${esc(article.title)}</b>
              <small>Documentation article</small>
            </div>
            <span>›</span>
          </div>
        `).join("")}

        ${
          articles.length === 0
            ? '<div class="empty-state compact">No articles here yet. Use New Article to add one.</div>'
            : ""
        }
      </div>
    </div>
  `;

  $("folderContents").innerHTML = html;
}

/* =========================================
   HOME PAGE
========================================= */

function renderHome(query = "") {
  const q = String(query || "").trim().toLowerCase();
  const container = $("folderCards");

  if (!container) return;

  const roots = byOrder(
    state.folders.filter(f => f.parent === null)
  );

  const folderHits = q
    ? state.folders.filter(f => f.name.toLowerCase().includes(q))
    : roots;

  const articleHits = q
    ? state.articles.filter(a =>
        (a.title + " " + a.content).toLowerCase().includes(q)
      )
    : [];

  $("docCount").textContent = q
    ? `${folderHits.length} folders · ${articleHits.length} articles`
    : `${state.articles.length} articles`;

  if (!q) {
    container.innerHTML = roots.map((folder, index) => {
      const subfolders = state.folders.filter(
        x => x.parent === folder.id
      ).length;

      const articles = state.articles.filter(
        a => a.folder === folder.id
      ).length;

      return `
        <div class="card folder-card" onclick="openFolder('${folder.id}')">
          <span class="num">${String(index + 1).padStart(2, "0")}</span>
          <h3>📁 ${esc(folder.name)}</h3>
          <p>${subfolders} subfolders · ${articles} articles</p>
          <button
            class="open"
            onclick="event.stopPropagation();openFolder('${folder.id}')"
          >Open →</button>
        </div>
      `;
    }).join("") || `
      <div class="empty-state">
        No folders yet. Use Manage Content to create one.
      </div>
    `;

    return;
  }

  let html = "";

  if (folderHits.length) {
    html += `
      <div style="grid-column:1/-1">
        <div class="content-section-title">
          FOLDERS <span>${folderHits.length}</span>
        </div>
      </div>
    `;

    html += folderHits.map(folder => `
      <div class="card folder-card" onclick="openFolder('${folder.id}')">
        <span class="num">FOLDER</span>
        <h3>📁 ${esc(folder.name)}</h3>
        <p>${esc(folderPath(folder.id).join(" / "))}</p>
        <button
          class="open"
          onclick="event.stopPropagation();openFolder('${folder.id}')"
        >Open →</button>
      </div>
    `).join("");
  }

  if (articleHits.length) {
    html += `
      <div style="grid-column:1/-1;margin-top:8px">
        <div class="content-section-title">
          ARTICLES <span>${articleHits.length}</span>
        </div>
      </div>
    `;

    html += articleHits.map(article => `
      <div class="card folder-card" onclick="openArticle('${article.id}')">
        <span class="num">ARTICLE</span>
        <h3>📄 ${esc(article.title)}</h3>
        <p>${esc(folderPath(article.folder).join(" / "))}</p>
        <button
          class="open"
          onclick="event.stopPropagation();openArticle('${article.id}')"
        >Open →</button>
      </div>
    `).join("");
  }

  if (!html) {
    html = `
      <div class="empty-state">
        No folders or articles match <b>${esc(query)}</b>.
      </div>
    `;
  }

  container.innerHTML = html;
}

/* =========================================
   MARKDOWN RENDERING
========================================= */

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output = [];

  let ul = false;
  let ol = false;

  function closeLists() {
    if (ul) {
      output.push("</ul>");
      ul = false;
    }

    if (ol) {
      output.push("</ol>");
      ol = false;
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeLists();
      continue;
    }

    let match;

    if (match = line.match(/^###\s+(.+)/)) {
      closeLists();
      output.push(`<h3>${esc(match[1])}</h3>`);
      continue;
    }

    if (match = line.match(/^##\s+(.+)/)) {
      closeLists();
      output.push(`<h2>${esc(match[1])}</h2>`);
      continue;
    }

    if (match = line.match(/^#\s+(.+)/)) {
      closeLists();
      output.push(`<h1>${esc(match[1])}</h1>`);
      continue;
    }

    if (match = line.match(/^[-*]\s+(.+)/)) {
      if (!ul) {
        closeLists();
        output.push("<ul>");
        ul = true;
      }

      output.push(`<li>${inline(match[1])}</li>`);
      continue;
    }

    if (match = line.match(/^\d+\.\s+(.+)/)) {
      if (!ol) {
        closeLists();
        output.push("<ol>");
        ol = true;
      }

      output.push(`<li>${inline(match[1])}</li>`);
      continue;
    }

    if (match = line.match(/^>\s?(.+)/)) {
      closeLists();
      output.push(`<blockquote>${inline(match[1])}</blockquote>`);
      continue;
    }

    if (match = line.match(/^!\[([^\]]*)\]\((kbasset:[^)]+)\)$/)) {
      closeLists();
      output.push(`
        <p>
          <img
            class="kb-inline-image"
            alt="${esc(match[1])}"
            src="${match[2]}"
          >
        </p>
      `);
      continue;
    }

    closeLists();
    output.push(`<p>${inline(line)}</p>`);
  }

  closeLists();

  return output.join("");
}

/* =========================================
   OPEN ARTICLE
========================================= */


function openArticle(id) {
  const article = state.articles.find(x => x.id === id);

  if (!article) return;

  const path = [];
  let folder = state.folders.find(x => x.id === article.folder);
  let guard = 0;

  while (folder && guard++ < 30) {
    path.unshift(folder);
    folder = state.folders.find(x => x.id === folder.parent);
  }

  $("articlePath").innerHTML = `
    <button class="breadcrumb-link" onclick="showHome()">Home</button>
    ${path.map(item => `
      <span class="breadcrumb-separator">/</span>
      <button
        class="breadcrumb-link"
        onclick="openFolder('${item.id}')"
      >${esc(item.name)}</button>
    `).join("")}
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">${esc(article.title)}</span>
  `;

  $("article").innerHTML =
    article.contentFormat === "html"
      ? cleanDocxHtml(article.content)
      : renderMarkdown(article.content);

  hydrateImages($("article"));

  $("articleEditBtn").onclick = () => editArticle(id);
  $("articleDeleteBtn").onclick = () => deleteItem("article", id);

  $("articleNewBtn").onclick = () => {
    show("manageView");
    renderManage();
    $("currentFolder").value = article.folder;
    newArticle();
  };

  $("articleNewSubBtn").onclick = () => {
    show("manageView");
    renderManage();
    $("currentFolder").value = article.folder;
    newFolder();
  };

  $("backBtn").onclick = () => openFolder(article.folder);

  show("articleView");
  window.scrollTo(0, 0);
}

window.openArticle = openArticle;

/* =========================================
   MANAGE CONTENT
========================================= */

function fillFolderSelect(select) {
  select.innerHTML = state.folders.map(folder => `
    <option value="${folder.id}">
      ${esc(folderPath(folder.id).join(" / "))}
    </option>
  `).join("");
}

function renderTree() {
  const roots = byOrder(childrenFolders(null));

  $("tree").innerHTML = roots.map(renderFolderTree).join("");
  $("trashCount").textContent = state.trash.length;
}

function renderFolderTree(folder) {
  const articles = byOrder(
    state.articles.filter(a => a.folder === folder.id)
  );

  const subs = byOrder(childrenFolders(folder.id));

  return `
    <div
      class="folder"
      data-type="folder"
      data-id="${folder.id}"
      ondragover="allowDrop(event)"
      ondrop='dropOn(event,"folder-container","${folder.id}")'
    >
      <div
        class="folder-title context-target"
        draggable="true"
        ondragstart='dragStart(event,"folder","${folder.id}")'
        ondragover="allowDrop(event)"
        ondrop='dropOn(event,"folder","${folder.id}")'
        data-type="folder"
        data-id="${folder.id}"
        oncontextmenu="showContextMenu(event,'folder','${folder.id}')"
      >
        📁 ${esc(folder.name)}
      </div>

      ${articles.map(article => `
        <button
          class="file"
          draggable="true"
          ondragstart='dragStart(event,"article","${article.id}")'
          ondragover="allowDrop(event)"
          ondrop='dropOn(event,"article","${article.id}")'
          data-type="article"
          data-id="${article.id}"
          onclick="editArticle('${article.id}')"
          oncontextmenu="showContextMenu(event,'article','${article.id}')"
        >
          📄 ${esc(article.title)}
        </button>
      `).join("")}

      ${subs.map(renderFolderTree).join("")}
    </div>
  `;
}

function renderManage() {
  fillFolderSelect($("currentFolder"));
  fillFolderSelect($("editFolder"));

  renderTree();

  $("parentFolder").innerHTML = `
    <option value="">Root</option>
    ${state.folders.map(folder => `
      <option value="${folder.id}">
        ${esc(folderPath(folder.id).join(" / "))}
      </option>
    `).join("")}
  `;
}

/* =========================================
   CREATE AND EDIT ARTICLES
========================================= */

function editArticle(id) {
  const article = state.articles.find(x => x.id === id);

  if (!article) {
    alert("Article not found.");
    return;
  }

  editingId = id;
  editingFormat = article.contentFormat || "markdown";

  show("manageView");
  renderManage();

  $("editorEmpty").classList.add("hidden");
  $("folderEditor").classList.add("hidden");
  $("editor").classList.remove("hidden");

  $("editFolder").value = article.folder;
  $("editTitle").value = article.title;
  $("editContent").value = article.content;

  $("editorFormatNote").textContent =
    article.contentFormat === "html"
      ? "Imported Word document: converted to displayable HTML."
      : "Text/Markdown editor. Uploaded images are inserted at the cursor position.";

  $("editTitle").focus();
}

function newArticle(folderId = null) {
  editingId = null;
  editingFormat = "markdown";

  show("manageView");
  renderManage();

  $("editorEmpty").classList.add("hidden");
  $("folderEditor").classList.add("hidden");
  $("editor").classList.remove("hidden");

  $("editTitle").value = "";

  $("editContent").value =
`# New Topic

## Overview

- Start writing your notes here.
- Add as many headings, subheadings and bullet points as you need.`;

  $("editorFormatNote").textContent =
    "Text/Markdown editor. Uploaded images are inserted at the cursor position.";

  if (folderId) {
    $("editFolder").value = folderId;
  } else if ($("currentFolder").value) {
    $("editFolder").value = $("currentFolder").value;
  }

  $("editTitle").focus();
}

function newFolder(parentId = null) {
  show("manageView");
  renderManage();

  $("editorEmpty").classList.add("hidden");
  $("editor").classList.add("hidden");
  $("folderEditor").classList.remove("hidden");

  $("folderName").value = "";
  $("parentFolder").value = parentId || $("currentFolder").value || "";

  $("folderName").focus();
}

$("manageBtn").onclick = () => {
  show("manageView");
  renderManage();
};

$("newArticleBtn").onclick = () => newArticle();
$("newFolderBtn").onclick = () => newFolder();

/* =========================================
   SAVE ARTICLE
========================================= */

$("saveBtn").onclick = async () => {
  const title = $("editTitle").value.trim();
  let content = $("editContent").value.trim();

  const contentFormat = editingId ? editingFormat : "markdown";
  const folder = $("editFolder").value;

  if (contentFormat === "html") {
    content = cleanDocxHtml(content);
  }

  if (!title) {
    alert("Please enter an article title.");
    $("editTitle").focus();
    return;
  }

  if (!content) {
    alert("Please enter some content.");
    $("editContent").focus();
    return;
  }

  if (!folder) {
    alert("Please select a folder.");
    $("editFolder").focus();
    return;
  }

  const duplicate = state.articles.find(article =>
    article.folder === folder &&
    article.title.toLowerCase() === title.toLowerCase() &&
    article.id !== editingId
  );

  if (duplicate) {
    alert("An article with this name already exists in this folder.");
    $("editTitle").focus();
    return;
  }

  let saved;

  if (editingId) {
    saved = state.articles.find(a => a.id === editingId);

    if (!saved) {
      alert("The article could not be found.");
      return;
    }

    Object.assign(saved, {
      title,
      content,
      folder,
      contentFormat
    });

  } else {
    saved = {
      id: uid(),
      title,
      content,
      folder,
      contentFormat: "markdown",
      order: state.articles.filter(a => a.folder === folder).length
    };

    state.articles.push(saved);
  }

  saveState();

  renderNav();
  renderHome();
  renderManage();

  if (connectedDir) {
    try {
      await writeArticleToFolder(saved);
    } catch (err) {
      console.error(err);

      alert(
        "Article saved in the browser, but it could not be written to CONTENT FOLDER. Check folder permissions."
      );
    }
  }

  editingId = saved.id;

  alert(
    "Article saved in this browser. Use Export content to create a portable backup."
  );

  openArticle(saved.id);
};

/* =========================================
   DELETE ARTICLE
========================================= */

$("deleteBtn").onclick = () => {
  if (!editingId) {
    alert("This is a new unsaved article.");
    return;
  }

  deleteItem("article", editingId);
  editingId = null;
};

/* =========================================
   CREATE FOLDER
========================================= */

$("saveFolderBtn").onclick = () => {
  const name = $("folderName").value.trim();
  const parent = $("parentFolder").value || null;

  if (!name) {
    alert("Please enter a folder name.");
    $("folderName").focus();
    return;
  }

  if (state.folders.some(folder =>
    folder.parent === parent &&
    folder.name.toLowerCase() === name.toLowerCase()
  )) {
    alert("A folder with this name already exists here.");
    $("folderName").focus();
    return;
  }

  const folder = {
    id: uid(),
    name,
    parent,
    order: state.folders.filter(x => x.parent === parent).length
  };

  state.folders.push(folder);

  saveState();
  renderNav();
  renderHome();
  renderManage();

  alert("Folder created successfully.");

  openFolder(folder.id);
};

/* =========================================
   SEARCH
========================================= */

$("homeSearch").oninput = event => {
  renderHome(event.target.value);
};

$("sideSearch").oninput = event => {
  const query = event.target.value.trim().toLowerCase();

  if (!query) {
    renderNav();
    return;
  }

  const folderHits = state.folders.filter(folder =>
    (folder.name + " " + folderPath(folder.id).join(" "))
      .toLowerCase()
      .includes(query)
  );

  const articleHits = state.articles.filter(article =>
    (
      article.title +
      " " +
      article.content +
      " " +
      folderPath(article.folder).join(" ")
    ).toLowerCase().includes(query)
  );

  $("nav").innerHTML = `
    <div class="nav-section-label">SEARCH RESULTS</div>

    ${
      folderHits.map(folder => `
        <button
          class="nav-folder"
          onclick="openFolder('${folder.id}')"
        >
          📁 ${esc(folder.name)}
        </button>
      `).join("")
    }

    ${
      articleHits.map(article => `
        <button
          class="nav-article"
          onclick="openArticle('${article.id}')"
        >
          📄 ${esc(article.title)}
        </button>
      `).join("")
    }

    ${
      !folderHits.length && !articleHits.length
        ? '<div class="nav-empty">No matching results.</div>'
        : ""
    }
  `;
};

$("themeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

document.addEventListener("keydown", event => {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();

    if (!$("homeView").classList.contains("hidden")) {
      $("homeSearch").focus();
    } else {
      $("sideSearch").focus();
    }
  }
});

/* =========================================
   DOCUMENT UPLOAD
========================================= */

$("uploadDocsBtn").addEventListener("click", () => {
  $("documentUpload").click();
});

$("documentUpload").addEventListener("change", async event => {
  const files = [...event.target.files || []];

  if (!files.length) return;

  const folder =
    window.currentFolderId ||
    $("currentFolder").value ||
    state.folders[0]?.id;

  if (!folder) {
    alert("Create a folder first, then upload files into it.");
    event.target.value = "";
    return;
  }

  let imported = 0;

  for (const file of files) {
    const ext = file.name.split(".").pop().toLowerCase();

    let content = "";
    let format = "markdown";

    try {
      if (
        ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext) ||
        file.type.startsWith("image/")
      ) {
        const id = uid();

        await putAsset(id, file);

        content =
          `![${file.name.replace(/\.[^.]+$/, "")}](kbasset:${id})`;

      } else if (ext === "txt" || ext === "md") {
        content = await file.text();

      } else if (ext === "docx") {
        if (!window.mammoth) {
          alert(
            "The Word DOCX reader did not load. Check your internet connection and retry."
          );
          continue;
        }

        const result = await window.mammoth.convertToHtml(
          { arrayBuffer: await file.arrayBuffer() },
          {
            convertImage: window.mammoth.images.inline(
              async image => ({
                src:
                  `data:${image.contentType};base64,${await image.read("base64")}`
              })
            )
          }
        );

        const html = cleanDocxHtml(result.value || "");
        const doc = new DOMParser().parseFromString(html, "text/html");

        for (const img of doc.querySelectorAll('img[src^="data:image/"]')) {
          const id = await storeDataUrl(img.getAttribute("src"));
          img.setAttribute("src", `kbasset:${id}`);
        }

        content = doc.body.innerHTML;
        format = "html";

      } else if (ext === "doc") {
        alert(
          file.name +
          " is an older .doc file. Save it as .docx in Word, then upload again."
        );
        continue;

      } else {
        continue;
      }

      const title = file.name.replace(
        /\.(txt|md|docx|png|jpe?g|gif|webp|bmp)$/i,
        ""
      );

      const existing = state.articles.find(article =>
        article.folder === folder &&
        article.title.toLowerCase() === title.toLowerCase()
      );

      if (existing) {
        if (!confirm(title + " already exists. Replace its content?")) {
          continue;
        }

        Object.assign(existing, {
          content,
          contentFormat: format,
          sourceFormat: ext
        });

      } else {
        state.articles.push({
          id: uid(),
          folder,
          title,
          content,
          contentFormat: format,
          sourceFormat: ext,
          order: state.articles.filter(a => a.folder === folder).length
        });
      }

      imported++;

    } catch (err) {
      console.error(err);
      alert("Could not import " + file.name + ": " + err.message);
    }
  }

  saveState();

  renderNav();
  renderHome();
  renderManage();

  event.target.value = "";

  if (window.currentFolderId) {
    renderFolderContents(window.currentFolderId);
  }

  alert(
    `${imported} file(s) imported. Images are stored in this browser's IndexedDB.`
  );
});

/* =========================================
   INSERT IMAGES INTO ARTICLE
========================================= */

$("addImagesBtn").addEventListener("click", () => {
  $("inlineImageUpload").click();
});

$("inlineImageUpload").addEventListener("change", async event => {
  const files = [...event.target.files || []];

  if (!files.length) return;

  const textarea = $("editContent");
  let inserted = "";

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    try {
      const id = uid();

      await putAsset(id, file);

      inserted +=
        `\n![${file.name.replace(/\.[^.]+$/, "")}](kbasset:${id})\n`;

    } catch (err) {
      alert("Could not store " + file.name + ": " + err.message);
    }
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  textarea.value =
    textarea.value.slice(0, start) +
    inserted +
    textarea.value.slice(end);

  textarea.focus();

  textarea.selectionStart =
    textarea.selectionEnd = start + inserted.length;

  event.target.value = "";
});

/* =========================================
   CONNECT LOCAL CONTENT FOLDER
========================================= */

async function connectFolder() {
  if (!window.showDirectoryPicker) {
    alert(
      "Your browser does not support folder access. Use current Edge or Chrome with the site running through Live Server."
    );
    return;
  }

  try {
    connectedDir = await window.showDirectoryPicker({
      mode: "readwrite"
    });

    $("folderStatus").textContent =
      "Connected: " + connectedDir.name;

    await importFolder(connectedDir);

    renderNav();
    renderHome();
    renderManage();

    alert("CONTENT FOLDER connected and read.");

  } catch (error) {
    if (error.name !== "AbortError") {
      alert("Could not connect to the folder: " + error.message);
    }
  }
}

async function importFolder(dir) {
  async function walk(directory, parentId = null) {
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind === "directory") {
        let folder = state.folders.find(
          x => x.name === name && x.parent === parentId
        );

        if (!folder) {
          folder = {
            id: uid(),
            name,
            parent: parentId,
            order: state.folders.filter(x => x.parent === parentId).length
          };

          state.folders.push(folder);
        }

        await walk(handle, folder.id);

      } else if (/\.(txt|md)$/i.test(name)) {
        const file = await handle.getFile();
        const content = await file.text();
        const title = name.replace(/\.(txt|md)$/i, "");

        let folderId = parentId;

        if (!folderId) {
          let notes = state.folders.find(
            x => x.name === "Notes" && x.parent === null
          );

          if (!notes) {
            notes = {
              id: uid(),
              name: "Notes",
              parent: null,
              order: state.folders.filter(x => x.parent === null).length
            };

            state.folders.push(notes);
          }

          folderId = notes.id;
        }

        const existing = state.articles.find(
          x => x.title === title && x.folder === folderId
        );

        if (existing) {
          existing.content = content;
        } else {
          state.articles.push({
            id: uid(),
            folder: folderId,
            title,
            content,
            contentFormat: "markdown",
            order: state.articles.filter(a => a.folder === folderId).length
          });
        }
      }
    }
  }

  await walk(dir);
  saveState();
}

async function writeArticleToFolder(article) {
  async function ensureDirectory(root, parts) {
    let directory = root;

    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, {
        create: true
      });
    }

    return directory;
  }

  const directory = await ensureDirectory(
    connectedDir,
    folderPath(article.folder)
  );

  const handle = await directory.getFileHandle(
    article.title + ".txt",
    { create: true }
  );

  const writable = await handle.createWritable();

  await writable.write(article.content);
  await writable.close();
}

$("connectBtn").onclick = connectFolder;
$("importBtn").onclick = connectFolder;

/* =========================================
   FOLDER PAGE CONTROLS
========================================= */

$("folderBackBtn").onclick = () => {
  if (window.currentFolderId) {
    const current = state.folders.find(
      f => f.id === window.currentFolderId
    );

    if (current?.parent) {
      openFolder(current.parent);
    } else {
      showHome();
    }

  } else {
    showHome();
  }
};

$("folderFilter").oninput = event => {
  if (window.currentFolderId) {
    renderFolderContents(
      window.currentFolderId,
      event.target.value
    );
  }
};

$("folderNewArticleBtn").onclick = () => {
  const current = state.folders.find(
    f => f.id === window.currentFolderId
  );

  if (!current) return;

  show("manageView");
  renderManage();

  $("currentFolder").value = current.id;

  newArticle();
};

$("folderNewSubBtn").onclick = () => {
  const current = state.folders.find(
    f => f.id === window.currentFolderId
  );

  if (!current) return;

  show("manageView");
  renderManage();

  $("currentFolder").value = current.id;

  newFolder();
};

/* =========================================
   CONTEXT MENU
========================================= */

function showContextMenu(event, type, id) {
  event.preventDefault();

  contextTarget = { type, id };

  let menu = document.getElementById("contextMenu");

  if (!menu) {
    menu = document.createElement("div");
    menu.id = "contextMenu";
    menu.className = "context-menu";

    menu.innerHTML = `
      <button data-act="article">📄 New Article / File</button>
      <button data-act="folder">📁 New Subfolder</button>
      <hr>
      <button data-act="rename">✎ Rename</button>
      <button data-act="delete">🗑 Delete</button>
    `;

    document.body.appendChild(menu);
    menu.addEventListener("click", contextAction);
  }

  menu.style.left =
    Math.min(event.clientX, window.innerWidth - 230) + "px";

  menu.style.top =
    Math.min(event.clientY, window.innerHeight - 210) + "px";

  menu.classList.add("show");
}

function hideContextMenu() {
  const menu = document.getElementById("contextMenu");

  if (menu) {
    menu.classList.remove("show");
  }
}

async function contextAction(event) {
  const action = event.target.closest("button")?.dataset.act;

  if (!action || !contextTarget) return;

  const { type, id } = contextTarget;

  hideContextMenu();

  if (action === "article" && type === "folder") {
    show("manageView");
    renderManage();

    $("currentFolder").value = id;

    newArticle();
    return;
  }

  if (action === "folder" && type === "folder") {
    show("manageView");
    renderManage();

    $("currentFolder").value = id;

    newFolder();
    return;
  }

  if (action === "rename") {
    if (type === "folder") {
      const folder = state.folders.find(x => x.id === id);

      if (!folder) return;

      const name = prompt("New folder name:", folder.name);

      if (name && name.trim()) {
        const clean = name.trim();

        if (state.folders.some(x =>
          x.id !== id &&
          x.parent === folder.parent &&
          x.name.toLowerCase() === clean.toLowerCase()
        )) {
          alert("A folder with this name already exists here.");
          return;
        }

        folder.name = clean;

        saveState();
        renderNav();
        renderHome();
        renderManage();
      }

    } else {
      const article = state.articles.find(x => x.id === id);

      if (!article) return;

      const name = prompt("New article/file name:", article.title);

      if (name && name.trim()) {
        const clean = name.trim();

        if (state.articles.some(x =>
          x.id !== id &&
          x.folder === article.folder &&
          x.title.toLowerCase() === clean.toLowerCase()
        )) {
          alert("An article with this name already exists in this folder.");
          return;
        }

        article.title = clean;

        saveState();
        renderNav();
        renderHome();
        renderManage();
      }
    }

    return;
  }

  if (action === "delete") {
    deleteItem(type, id);
  }
}

document.addEventListener("contextmenu", event => {
  const element = event.target.closest(".folder-title, .file");

  if (element) {
    showContextMenu(event, element.dataset.type, element.dataset.id);
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest("#contextMenu")) {
    hideContextMenu();
  }
});

/* =========================================
   RECYCLE BIN
========================================= */

function deleteItem(type, id) {
  if (!confirm("Move this item to the Recycle Bin?")) return;

  if (type === "article") {
    const index = state.articles.findIndex(a => a.id === id);

    if (index < 0) return;

    const [article] = state.articles.splice(index, 1);

    state.trash.push({
      type: "article",
      item: article,
      deletedAt: new Date().toISOString()
    });

    saveState();

    renderNav();
    renderHome();
    renderManage();
    renderTrash();

    if (window.currentFolderId === article.folder) {
      openFolder(article.folder);
    }

    return;
  }

  const folderIds = [id];

  for (let i = 0; i < folderIds.length; i++) {
    for (const folder of state.folders) {
      if (folder.parent === folderIds[i]) {
        folderIds.push(folder.id);
      }
    }
  }

  const articles = state.articles.filter(
    article => folderIds.includes(article.folder)
  );

  const folders = state.folders.filter(
    folder => folderIds.includes(folder.id)
  );

  const rootFolder = folders.find(folder => folder.id === id);

  state.articles = state.articles.filter(
    article => !folderIds.includes(article.folder)
  );

  state.folders = state.folders.filter(
    folder => !folderIds.includes(folder.id)
  );

  state.trash.push({
    type: "folder",
    item: { name: rootFolder?.name || "Folder" },
    folders,
    articles,
    deletedAt: new Date().toISOString()
  });

  saveState();

  renderNav();
  renderHome();
  renderManage();
  renderTrash();

  if (
    window.currentFolderId &&
    folderIds.includes(window.currentFolderId)
  ) {
    if (rootFolder?.parent) {
      openFolder(rootFolder.parent);
    } else {
      showHome();
    }
  }
}

function renderTrash() {
  $("trashCount").textContent = state.trash.length;

  $("trashList").innerHTML = state.trash.length
    ? state.trash.map((item, index) => {
        const name = item.type === "article"
          ? item.item.title
          : item.item.name;

        const icon = item.type === "article" ? "📄" : "📁";

        return `
          <div class="trash-row">
            <div>
              ${icon} <b>${esc(name)}</b>
              <small>
                ${item.type} · deleted
                ${new Date(item.deletedAt).toLocaleString()}
              </small>
            </div>

            <div>
              <button onclick="restoreTrash(${index})">Restore</button>
              <button
                class="danger-small"
                onclick="permanentTrash(${index})"
              >Delete permanently</button>
            </div>
          </div>
        `;
      }).join("")
    : '<div class="empty-trash">Recycle Bin is empty.</div>';
}

function restoreTrash(index) {
  const item = state.trash[index];

  if (!item) return;

  if (item.type === "article") {
    const article = item.item;

    if (state.articles.some(x =>
      x.folder === article.folder &&
      x.title.toLowerCase() === article.title.toLowerCase()
    )) {
      alert(
        "Restore failed: an article with this name already exists in the original folder."
      );
      return;
    }

    state.articles.push(article);

  } else {
    const collision = item.folders.some(folder =>
      state.folders.some(x =>
        x.id !== folder.id &&
        x.parent === folder.parent &&
        x.name.toLowerCase() === folder.name.toLowerCase()
      )
    );

    if (collision) {
      alert(
        "Restore failed: a folder with the same name already exists at the original location."
      );
      return;
    }

    state.folders.push(...item.folders);
    state.articles.push(...item.articles);
  }

  state.trash.splice(index, 1);

  saveState();

  renderNav();
  renderHome();
  renderManage();
  renderTrash();
}

function permanentTrash(index) {
  if (
    confirm("Permanently delete this item? This cannot be undone.")
  ) {
    state.trash.splice(index, 1);

    saveState();

    renderTrash();
    renderManage();
  }
}

$("recycleBtn").onclick = () => {
  show("recycleView");
  renderTrash();
};

$("recycleBackBtn").onclick = () => {
  show("manageView");
  renderManage();
};

$("emptyTrashBtn").onclick = () => {
  if (
    state.trash.length &&
    confirm("Permanently delete everything in the Recycle Bin?")
  ) {
    state.trash = [];

    saveState();

    renderTrash();
    renderManage();
  }
};

/* =========================================
   EXPORT BACKUP
========================================= */

$("exportBtn").onclick = async () => {
  const ids = new Set();

  const allArticles = [
    ...state.articles,
    ...state.trash.flatMap(item =>
      item.type === "article"
        ? [item.item]
        : (item.articles || [])
    )
  ];

  for (const article of allArticles) {
    for (const match of String(article.content || "").matchAll(
      /kbasset:([A-Za-z0-9-]+)/g
    )) {
      ids.add(match[1]);
    }
  }

  const assets = {};

  for (const id of ids) {
    const blob = await getAsset(id);

    if (blob) {
      assets[id] = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(blob);
      });
    }
  }

  const backup = { ...state, assets };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "knowledge-base-backup.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* =========================================
   FOLDER PAGE BUTTONS
========================================= */

$("folderBackBtn").onclick = () => {
  if (window.currentFolderId) {
    const current = state.folders.find(
      f => f.id === window.currentFolderId
    );

    if (current?.parent) {
      openFolder(current.parent);
    } else {
      showHome();
    }
  } else {
    showHome();
  }
};

$("folderFilter").oninput = event => {
  if (window.currentFolderId) {
    renderFolderContents(
      window.currentFolderId,
      event.target.value
    );
  }
};

$("folderNewArticleBtn").onclick = () => {
  const current = state.folders.find(
    f => f.id === window.currentFolderId
  );

  if (!current) return;

  show("manageView");
  renderManage();

  $("currentFolder").value = current.id;

  newArticle();
};

$("folderNewSubBtn").onclick = () => {
  const current = state.folders.find(
    f => f.id === window.currentFolderId
  );

  if (!current) return;

  show("manageView");
  renderManage();

  $("currentFolder").value = current.id;

  newFolder();
};

/* =========================================
   INITIALISE WEBSITE
========================================= */

async function initialiseKnowledgeHub() {
  try {
    await loadState();

    renderNav();
    renderHome();
    renderManage();

  } catch (error) {
    console.error("Knowledge Hub initialisation failed:", error);

    $("nav").innerHTML =
      '<div class="nav-empty">Could not load the knowledge base.</div>';

    $("folderCards").innerHTML =
      '<div class="empty-state">Could not initialise the workspace.</div>';
  }
}

initialiseKnowledgeHub();
