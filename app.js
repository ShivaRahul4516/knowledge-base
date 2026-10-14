const KEY="ssr-kb-v4-complete-tree";
let state={folders:[],articles:[],trash:[]}, connectedDir=null, editingId=null, contextTarget=null;

const $=id=>document.getElementById(id);
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()}
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
function saveState(){localStorage.setItem(KEY,JSON.stringify(state))}
function loadState(){
  try{const x=JSON.parse(localStorage.getItem(KEY));if(x?.folders?.length){state=x; state.trash=state.trash||[]; return state}}catch(e){}
  state={folders:[{"id":"getting-started","name":"Getting Started","parent":null},{"id":"getting-started--login","name":"Login","parent":"getting-started"},{"id":"getting-started--interface-overview","name":"Interface Overview","parent":"getting-started"},{"id":"getting-started--navigation","name":"Navigation","parent":"getting-started"},{"id":"administration","name":"Administration","parent":null},{"id":"administration--users-groups","name":"Users & Groups","parent":"administration"},{"id":"administration--configuration","name":"Configuration","parent":"administration"},{"id":"dashboard","name":"Dashboard","parent":null},{"id":"dashboard--dashboard","name":"Dashboard","parent":"dashboard"},{"id":"dashboard--dashboard-beta","name":"Dashboard Beta","parent":"dashboard"},{"id":"browse","name":"Browse","parent":null},{"id":"browse--create-cabinet","name":"Create Cabinet","parent":"browse"},{"id":"browse--create-folder","name":"Create Folder","parent":"browse"},{"id":"browse--import-document-s","name":"Import Document(s)","parent":"browse"},{"id":"browse--import-with-document-capture-templates","name":"Import With Document Capture Templates","parent":"browse"},{"id":"browse--document-preview-view","name":"Document Preview View","parent":"browse"},{"id":"browse--find","name":"Find","parent":"browse"},{"id":"browse--tree-report","name":"Tree Report","parent":"browse"},{"id":"browse--right-menu","name":"Right Menu","parent":"browse"},{"id":"select-items","name":"Select Items","parent":null},{"id":"select-items--cut","name":"Cut","parent":"select-items"},{"id":"select-items--copy","name":"Copy","parent":"select-items"},{"id":"select-items--paste","name":"Paste","parent":"select-items"},{"id":"select-items--export-docs","name":"Export Docs","parent":"select-items"},{"id":"select-items--share-links","name":"Share Links","parent":"select-items"},{"id":"select-items--email-docs","name":"Email Docs","parent":"select-items"},{"id":"select-items--share","name":"Share","parent":"select-items"},{"id":"select-items--delete","name":"Delete","parent":"select-items"},{"id":"select-items--check-out","name":"Check Out","parent":"select-items"},{"id":"select-items--check-in","name":"Check In","parent":"select-items"},{"id":"select-items--mark-as-record","name":"Mark As Record","parent":"select-items"},{"id":"select-items--export-metadata","name":"Export Metadata","parent":"select-items"},{"id":"select-items--merge-email","name":"Merge & Email","parent":"select-items"},{"id":"select-items--refresh","name":"Refresh","parent":"select-items"},{"id":"search","name":"Search","parent":null},{"id":"search--search","name":"Search","parent":"search"},{"id":"search--results","name":"Results","parent":"search"},{"id":"manage","name":"Manage","parent":null},{"id":"manage--notifications","name":"Notifications","parent":"manage"},{"id":"manage--document-types","name":"Document Types","parent":"manage"},{"id":"manage--global-metadata-mapping","name":"Global Metadata Mapping","parent":"manage"},{"id":"manage--downloads","name":"Downloads","parent":"manage"},{"id":"manage--related-links","name":"Related Links","parent":"manage"},{"id":"manage--purge-mails","name":"Purge Mails","parent":"manage"},{"id":"manage--upload-logo","name":"Upload Logo","parent":"manage"},{"id":"manage--recycle-bin","name":"Recycle Bin","parent":"manage"},{"id":"manage--metadata-import","name":"Metadata Import","parent":"manage"},{"id":"manage--document-capture-template","name":"Document Capture Template","parent":"manage"},{"id":"manage--split-merge","name":"Split & Merge","parent":"manage"},{"id":"my","name":"My","parent":null},{"id":"my--shared","name":"Shared","parent":"my"},{"id":"my--bookmarks","name":"Bookmarks","parent":"my"},{"id":"my--profile","name":"Profile","parent":"my"},{"id":"my--signature-password","name":"Signature Password","parent":"my"},{"id":"my--checked-out-docs","name":"Checked Out Docs","parent":"my"},{"id":"my--update-email-ids","name":"Update Email IDs","parent":"my"},{"id":"my--options","name":"Options","parent":"my"},{"id":"my--set-landing-page","name":"Set Landing Page","parent":"my"},{"id":"my--workflow-form-view-config","name":"Workflow Form View Config","parent":"my"},{"id":"my--bulk-operation-status","name":"Bulk Operation Status","parent":"my"},{"id":"workflow","name":"Workflow","parent":null},{"id":"workflow--my-jobs","name":"My Jobs","parent":"workflow"},{"id":"workflow--new-job","name":"New Job","parent":"workflow"},{"id":"workflow--reassign-jobs","name":"Reassign Jobs","parent":"workflow"},{"id":"workflow--documents-in-workflow","name":"Documents in Workflow","parent":"workflow"},{"id":"workflow--form-reports","name":"Form Reports","parent":"workflow"},{"id":"workflow--designer","name":"Designer","parent":"workflow"},{"id":"reports","name":"Reports","parent":null},{"id":"reports--ecm","name":"ECM","parent":"reports"},{"id":"reports--workflow","name":"Workflow","parent":"reports"},{"id":"browse--select-items","name":"Select Items","parent":"browse"},{"id":"browse--select-items--cut","name":"Cut","parent":"browse--select-items"},{"id":"browse--select-items--copy","name":"Copy","parent":"browse--select-items"},{"id":"browse--select-items--paste","name":"Paste","parent":"browse--select-items"},{"id":"browse--select-items--export-docs","name":"Export Docs","parent":"browse--select-items"},{"id":"browse--select-items--share-links","name":"Share Links","parent":"browse--select-items"},{"id":"browse--select-items--email-docs","name":"Email Docs","parent":"browse--select-items"},{"id":"browse--select-items--share","name":"Share","parent":"browse--select-items"},{"id":"browse--select-items--delete","name":"Delete","parent":"browse--select-items"},{"id":"browse--select-items--check-out","name":"Check Out","parent":"browse--select-items"},{"id":"browse--select-items--check-in","name":"Check In","parent":"browse--select-items"},{"id":"browse--select-items--mark-as-record","name":"Mark As Record","parent":"browse--select-items"},{"id":"browse--select-items--export-metadata","name":"Export Metadata","parent":"browse--select-items"},{"id":"browse--select-items--merge-email","name":"Merge & Email","parent":"browse--select-items"},{"id":"browse--select-items--refresh","name":"Refresh","parent":"browse--select-items"},{"id":"browse--right-menu--security","name":"Security","parent":"browse--right-menu"},{"id":"workflow--designer--general","name":"General","parent":"workflow--designer"},{"id":"workflow--designer--advanced","name":"Advanced","parent":"workflow--designer"},{"id":"workflow--designer--general-2","name":"General","parent":"workflow--designer"},{"id":"workflow--designer--advanced-2","name":"Advanced","parent":"workflow--designer"}],articles:[{"id":"seed-1","folder":"getting-started--login","title":"Login","content":"# Login\n\n## Overview\n\n- Add what you learn about **Login** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-2","folder":"getting-started--interface-overview","title":"Interface Overview","content":"# Interface Overview\n\n## Overview\n\n- Add what you learn about **Interface Overview** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-3","folder":"getting-started--navigation","title":"Navigation","content":"# Navigation\n\n## Overview\n\n- Add what you learn about **Navigation** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-4","folder":"administration--users-groups","title":"Users & Groups","content":"# Users & Groups\n\n## Overview\n\n- Add what you learn about **Users & Groups** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-5","folder":"administration--configuration","title":"Configuration","content":"# Configuration\n\n## Overview\n\n- Add what you learn about **Configuration** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-6","folder":"dashboard--dashboard","title":"Dashboard","content":"# Dashboard\n\n## Overview\n\n- Add what you learn about **Dashboard** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-7","folder":"dashboard--dashboard-beta","title":"Dashboard Beta","content":"# Dashboard Beta\n\n## Overview\n\n- Add what you learn about **Dashboard Beta** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-8","folder":"browse--create-cabinet","title":"Create Cabinet","content":"# Create Cabinet\n\n## Overview\n\n- Add what you learn about **Create Cabinet** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-9","folder":"browse--create-folder","title":"Create Folder","content":"# Create Folder\n\n## Overview\n\n- Add what you learn about **Create Folder** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-10","folder":"browse--import-document-s","title":"Import Document(s)","content":"# Import Document(s)\n\n## Overview\n\n- Add what you learn about **Import Document(s)** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-11","folder":"browse--import-with-document-capture-templates","title":"Import With Document Capture Templates","content":"# Import With Document Capture Templates\n\n## Overview\n\n- Add what you learn about **Import With Document Capture Templates** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-12","folder":"browse--document-preview-view","title":"Document Preview View","content":"# Document Preview View\n\n## Overview\n\n- Add what you learn about **Document Preview View** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-13","folder":"browse--find","title":"Find","content":"# Find\n\n## Overview\n\n- Add what you learn about **Find** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-14","folder":"browse--tree-report","title":"Tree Report","content":"# Tree Report\n\n## Overview\n\n- Add what you learn about **Tree Report** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-15","folder":"select-items--cut","title":"Cut","content":"# Cut\n\n## Overview\n\n- Add what you learn about **Cut** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-16","folder":"select-items--copy","title":"Copy","content":"# Copy\n\n## Overview\n\n- Add what you learn about **Copy** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-17","folder":"select-items--paste","title":"Paste","content":"# Paste\n\n## Overview\n\n- Add what you learn about **Paste** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-18","folder":"select-items--export-docs","title":"Export Docs","content":"# Export Docs\n\n## Overview\n\n- Add what you learn about **Export Docs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-19","folder":"select-items--share-links","title":"Share Links","content":"# Share Links\n\n## Overview\n\n- Add what you learn about **Share Links** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-20","folder":"select-items--email-docs","title":"Email Docs","content":"# Email Docs\n\n## Overview\n\n- Add what you learn about **Email Docs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-21","folder":"select-items--share","title":"Share","content":"# Share\n\n## Overview\n\n- Add what you learn about **Share** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-22","folder":"select-items--delete","title":"Delete","content":"# Delete\n\n## Overview\n\n- Add what you learn about **Delete** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-23","folder":"select-items--check-out","title":"Check Out","content":"# Check Out\n\n## Overview\n\n- Add what you learn about **Check Out** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-24","folder":"select-items--check-in","title":"Check In","content":"# Check In\n\n## Overview\n\n- Add what you learn about **Check In** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-25","folder":"select-items--mark-as-record","title":"Mark As Record","content":"# Mark As Record\n\n## Overview\n\n- Add what you learn about **Mark As Record** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-26","folder":"select-items--export-metadata","title":"Export Metadata","content":"# Export Metadata\n\n## Overview\n\n- Add what you learn about **Export Metadata** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-27","folder":"select-items--merge-email","title":"Merge & Email","content":"# Merge & Email\n\n## Overview\n\n- Add what you learn about **Merge & Email** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-28","folder":"select-items--refresh","title":"Refresh","content":"# Refresh\n\n## Overview\n\n- Add what you learn about **Refresh** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-29","folder":"search--search","title":"Search","content":"# Search\n\n## Overview\n\n- Add what you learn about **Search** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-30","folder":"search--results","title":"Results","content":"# Results\n\n## Overview\n\n- Add what you learn about **Results** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-31","folder":"manage--notifications","title":"Notifications","content":"# Notifications\n\n## Overview\n\n- Add what you learn about **Notifications** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-32","folder":"manage--document-types","title":"Document Types","content":"# Document Types\n\n## Overview\n\n- Add what you learn about **Document Types** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-33","folder":"manage--global-metadata-mapping","title":"Global Metadata Mapping","content":"# Global Metadata Mapping\n\n## Overview\n\n- Add what you learn about **Global Metadata Mapping** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-34","folder":"manage--downloads","title":"Downloads","content":"# Downloads\n\n## Overview\n\n- Add what you learn about **Downloads** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-35","folder":"manage--related-links","title":"Related Links","content":"# Related Links\n\n## Overview\n\n- Add what you learn about **Related Links** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-36","folder":"manage--purge-mails","title":"Purge Mails","content":"# Purge Mails\n\n## Overview\n\n- Add what you learn about **Purge Mails** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-37","folder":"manage--upload-logo","title":"Upload Logo","content":"# Upload Logo\n\n## Overview\n\n- Add what you learn about **Upload Logo** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-38","folder":"manage--recycle-bin","title":"Recycle Bin","content":"# Recycle Bin\n\n## Overview\n\n- Add what you learn about **Recycle Bin** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-39","folder":"manage--metadata-import","title":"Metadata Import","content":"# Metadata Import\n\n## Overview\n\n- Add what you learn about **Metadata Import** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-40","folder":"manage--document-capture-template","title":"Document Capture Template","content":"# Document Capture Template\n\n## Overview\n\n- Add what you learn about **Document Capture Template** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-41","folder":"manage--split-merge","title":"Split & Merge","content":"# Split & Merge\n\n## Overview\n\n- Add what you learn about **Split & Merge** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-42","folder":"my--shared","title":"Shared","content":"# Shared\n\n## Overview\n\n- Add what you learn about **Shared** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-43","folder":"my--bookmarks","title":"Bookmarks","content":"# Bookmarks\n\n## Overview\n\n- Add what you learn about **Bookmarks** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-44","folder":"my--profile","title":"Profile","content":"# Profile\n\n## Overview\n\n- Add what you learn about **Profile** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-45","folder":"my--signature-password","title":"Signature Password","content":"# Signature Password\n\n## Overview\n\n- Add what you learn about **Signature Password** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-46","folder":"my--checked-out-docs","title":"Checked Out Docs","content":"# Checked Out Docs\n\n## Overview\n\n- Add what you learn about **Checked Out Docs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-47","folder":"my--update-email-ids","title":"Update Email IDs","content":"# Update Email IDs\n\n## Overview\n\n- Add what you learn about **Update Email IDs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-48","folder":"my--options","title":"Options","content":"# Options\n\n## Overview\n\n- Add what you learn about **Options** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-49","folder":"my--set-landing-page","title":"Set Landing Page","content":"# Set Landing Page\n\n## Overview\n\n- Add what you learn about **Set Landing Page** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-50","folder":"my--workflow-form-view-config","title":"Workflow Form View Config","content":"# Workflow Form View Config\n\n## Overview\n\n- Add what you learn about **Workflow Form View Config** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-51","folder":"my--bulk-operation-status","title":"Bulk Operation Status","content":"# Bulk Operation Status\n\n## Overview\n\n- Add what you learn about **Bulk Operation Status** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-52","folder":"workflow--my-jobs","title":"My Jobs","content":"# My Jobs\n\n## Overview\n\n- Add what you learn about **My Jobs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-53","folder":"workflow--new-job","title":"New Job","content":"# New Job\n\n## Overview\n\n- Add what you learn about **New Job** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-54","folder":"workflow--reassign-jobs","title":"Reassign Jobs","content":"# Reassign Jobs\n\n## Overview\n\n- Add what you learn about **Reassign Jobs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-55","folder":"workflow--documents-in-workflow","title":"Documents in Workflow","content":"# Documents in Workflow\n\n## Overview\n\n- Add what you learn about **Documents in Workflow** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-56","folder":"workflow--form-reports","title":"Form Reports","content":"# Form Reports\n\n## Overview\n\n- Add what you learn about **Form Reports** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-57","folder":"reports--ecm","title":"ECM","content":"# ECM\n\n## Overview\n\n- Add what you learn about **ECM** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-58","folder":"reports--workflow","title":"Workflow","content":"# Workflow\n\n## Overview\n\n- Add what you learn about **Workflow** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-59","folder":"browse--select-items--cut","title":"Cut","content":"# Cut\n\n## Overview\n\n- Add what you learn about **Cut** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-60","folder":"browse--select-items--copy","title":"Copy","content":"# Copy\n\n## Overview\n\n- Add what you learn about **Copy** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-61","folder":"browse--select-items--paste","title":"Paste","content":"# Paste\n\n## Overview\n\n- Add what you learn about **Paste** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-62","folder":"browse--select-items--export-docs","title":"Export Docs","content":"# Export Docs\n\n## Overview\n\n- Add what you learn about **Export Docs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-63","folder":"browse--select-items--share-links","title":"Share Links","content":"# Share Links\n\n## Overview\n\n- Add what you learn about **Share Links** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-64","folder":"browse--select-items--email-docs","title":"Email Docs","content":"# Email Docs\n\n## Overview\n\n- Add what you learn about **Email Docs** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-65","folder":"browse--select-items--share","title":"Share","content":"# Share\n\n## Overview\n\n- Add what you learn about **Share** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-66","folder":"browse--select-items--delete","title":"Delete","content":"# Delete\n\n## Overview\n\n- Add what you learn about **Delete** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-67","folder":"browse--select-items--check-out","title":"Check Out","content":"# Check Out\n\n## Overview\n\n- Add what you learn about **Check Out** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-68","folder":"browse--select-items--check-in","title":"Check In","content":"# Check In\n\n## Overview\n\n- Add what you learn about **Check In** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-69","folder":"browse--select-items--mark-as-record","title":"Mark As Record","content":"# Mark As Record\n\n## Overview\n\n- Add what you learn about **Mark As Record** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-70","folder":"browse--select-items--export-metadata","title":"Export Metadata","content":"# Export Metadata\n\n## Overview\n\n- Add what you learn about **Export Metadata** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-71","folder":"browse--select-items--merge-email","title":"Merge & Email","content":"# Merge & Email\n\n## Overview\n\n- Add what you learn about **Merge & Email** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-72","folder":"browse--select-items--refresh","title":"Refresh","content":"# Refresh\n\n## Overview\n\n- Add what you learn about **Refresh** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-73","folder":"browse--right-menu--security","title":"Security","content":"# Security\n\n## Overview\n\n- Add what you learn about **Security** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-74","folder":"workflow--designer--general","title":"General","content":"# General\n\n## Overview\n\n- Add what you learn about **General** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-75","folder":"workflow--designer--advanced","title":"Advanced","content":"# Advanced\n\n## Overview\n\n- Add what you learn about **Advanced** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-76","folder":"workflow--designer--general-2","title":"General","content":"# General\n\n## Overview\n\n- Add what you learn about **General** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"},{"id":"seed-77","folder":"workflow--designer--advanced-2","title":"Advanced","content":"# Advanced\n\n## Overview\n\n- Add what you learn about **Advanced** here.\n- Add the purpose, behavior and important details.\n\n## Details\n\n### Notes\n\n- Add notes as you learn them.\n- Add examples, screenshots and test observations here.\n\n## Important Points\n\n- Add important points here.\n"}],trash:[]}; saveState()
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
loadState();renderNav();renderHome();
