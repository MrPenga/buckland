// Incolla in Google Sheets: Estensioni > Apps Script.
const FOGLI = {
  Ordini: ['id','data','cliente','articolo','qty','importo','note','stato'],
  Eventi: ['id','evento','data','persona','oggetto','qty']
};
function out(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try{
    const p = JSON.parse(e.postData.contents);
    const h = FOGLI[p.sheet]; if(!h) return out({error:'foglio'});
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(p.sheet);
    if(!sh){ sh = ss.insertSheet(p.sheet); sh.appendRow(h); sh.setFrozenRows(1); }
    const n = sh.getLastRow();
    const rows = n>1 ? sh.getRange(2,1,n-1,h.length).getValues() : [];
    if(p.action==='list'){
      return out({rows: rows.map(r=>Object.fromEntries(h.map((k,i)=>[k, r[i] instanceof Date ? Utilities.formatDate(r[i],'Europe/Rome','yyyy-MM-dd') : r[i]])))});
    }
    if(p.action==='add'){
      const o = Object.assign({id:Utilities.getUuid(), data:Utilities.formatDate(new Date(),'Europe/Rome','yyyy-MM-dd')}, p.row);
      sh.appendRow(h.map(k=>o[k]===undefined?'':o[k])); return out({ok:1});
    }
    const i = rows.findIndex(r=>r[0]===p.id); if(i<0) return out({error:'riga non trovata'});
    if(p.action==='update'){ Object.keys(p.row).forEach(k=>{const c=h.indexOf(k); if(c>0) sh.getRange(i+2,c+1).setValue(p.row[k]);}); }
    if(p.action==='delete'){ sh.deleteRow(i+2); }
    return out({ok:1});
  } catch(err){ return out({error:String(err)}); }
  finally{ lock.releaseLock(); }
}
