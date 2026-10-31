#!/usr/bin/env python3
"""Build content-index.json from content/**/*.txt and *.docx files.

TXT articles keep the original JSON structure. DOCX articles are indexed by
path and converted in the browser when opened, using Mammoth.js.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
OUTPUT = ROOT / "content-index.json"
SUPPORTED = {".txt", ".docx"}


def stable_id(prefix: str, path: str) -> str:
    return prefix + hashlib.sha256(path.encode("utf-8")).hexdigest()[:16]


if not CONTENT.exists():
    raise SystemExit("Missing content/ folder. Add your TXT/DOCX files under content/.")

folders = []
folder_id_by_path = {}
directories = sorted(
    (p for p in CONTENT.rglob("*") if p.is_dir()),
    key=lambda p: p.as_posix().casefold(),
)

for directory in directories:
    rel = directory.relative_to(CONTENT).as_posix()
    parent_rel = directory.parent.relative_to(CONTENT).as_posix()
    parent_path = None if parent_rel == "." else parent_rel
    folder_id = stable_id("f-", rel)
    folder_id_by_path[rel] = folder_id
    folders.append({
        "id": folder_id,
        "name": directory.name,
        "parent": folder_id_by_path.get(parent_path) if parent_path else None,
        "path": rel,
    })

articles = []
files = sorted(
    (p for p in CONTENT.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED),
    key=lambda p: p.as_posix().casefold(),
)

for file in files:
    rel = file.relative_to(CONTENT)
    folder_rel = "" if rel.parent == Path(".") else rel.parent.as_posix()
    folder_id = folder_id_by_path.get(folder_rel) if folder_rel else None
    article = {
        "id": stable_id("a-", rel.as_posix()),
        "folder": folder_id,
        "title": file.stem,
        "content": file.read_text(encoding="utf-8") if file.suffix.lower() == ".txt" else "",
        "path": rel.as_posix(),
    }
    if file.suffix.lower() == ".docx":
        article["sourceFormat"] = "docx"
        article["contentFormat"] = "docx"
    articles.append(article)

# Root-level supported files go into General, matching the original TXT behavior.
root_articles = [article for article in articles if article["folder"] is None]
if root_articles:
    general_path = "General"
    general_id = stable_id("f-", general_path)
    folders.append({"id": general_id, "name": "General", "parent": None, "path": general_path})
    for article in root_articles:
        article["folder"] = general_id

OUTPUT.write_text(json.dumps({
    "format_version": 1,
    "folders": folders,
    "articles": articles,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Generated {OUTPUT.name}: {len(folders)} folders, {len(articles)} articles")
