// @ts-nocheck
/**
 * Sales Monev Control — engine.
 *
 * Faithful port of the standalone `datah/index (1).html` app into the unified
 * dashboard's sales module. The original manipulated the global `document`; here
 * everything is scoped to the `root` element passed to `mountMonev`, so it lives
 * safely inside the React shell (the outer sales tabs also use class `.tab`, so
 * global queries would clobber them — every lookup below is root-scoped).
 *
 * Data is self-contained: client-side XLSX upload + Google-Sheets sync (gviz CSV
 * or Sheets API v4). No sales backend involved.
 */
import * as XLSX from "xlsx";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

export function mountMonev(root: HTMLElement): () => void {
  /* ============================ CONFIG ============================ */
  const AGENTS = [
    ["Martin","Martin"],["Ardan","Ardan"],["Ayu","Ayu"],["Iwan","Iwan"],["Doni","Doni"],
    ["Erwin","Erwin"],["Seto","Seto"],["Suseno","Suseno"],["Eka Rizki","Eka"],
    ["Teguh Riski Susanto","Teguh"],["Hasyim Rasyid","Hasyim"],["Muhammad Ilham","Ilham"],["Tria Ardi","Tria"]
  ].map(([name,key])=>({name,key}));

  const REASON_LAYERS = {
    L1:["UNR","ENG","REJ","NQ"],
    L2:["SCH","FOR","COM","INF","REM","EXP"],
    L3:["FIN","POL","PRD","NST","TIM","CMP","DM"]
  };
  const WEEK1_START = new Date(2026,0,5); // 05 Jan 2026 (Monday)

  /* ============================ STATE ============================ */
  let LEADS = [];
  let SALES = [];
  let META  = {};
  const charts = {};

  /* ============================ HELPERS ============================ */
  const fmt = n => (n||0).toLocaleString('id-ID');
  const pct = (num,den) => den>0 ? (100*num/den) : 0;
  const pctStr = (num,den) => den>0 ? (100*num/den).toFixed(1)+'%' : '–';
  const round = Math.round;

  function parseDate(v){
    if(v==null||v==='') return null;
    if(v instanceof Date) return isNaN(v)?null:v;
    const s=String(v).trim();
    let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m) return new Date(+m[3],+m[2]-1,+m[1]);
    m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if(m) return new Date(+m[1],+m[2]-1,+m[3]);
    const d=new Date(s); return isNaN(d)?null:d;
  }
  function parseRevenue(v){
    if(v==null) return 0;
    if(typeof v==='number') return v;
    const s=String(v).replace(/[^\d]/g,'');
    return s?+s:0;
  }
  function primaryAgent(agentSales){
    if(!agentSales) return '';
    return String(agentSales).split(',')[0].trim();
  }
  function normProject(p){
    if(!p) return '';
    let u=String(p).trim().replace(/\s+/g,' ').toUpperCase();
    if(u.startsWith('VERLIM3')||u.startsWith('VERLIM 3')) return 'VERLIM3';
    if(u.startsWith('VERLIM')) return 'VERLIM';
    if(u==='ZHL2'||u.startsWith('ZHL 2')) return 'ZHL 2';
    if(u.startsWith('ZHL')) return 'ZHL';
    if(u.startsWith('VERBUR')) return 'VERBUR';
    if(u==='THP J'||u.startsWith('THPJ')) return 'THPJ';
    if(u.startsWith('MAVIL')) return 'MAVILL';
    return u;
  }
  function reasonPrefix(r){
    if(!r) return '';
    return String(r).split('-')[0].trim().toUpperCase();
  }
  function reasonLayer(code){
    for(const L in REASON_LAYERS) if(REASON_LAYERS[L].includes(code)) return L;
    return null;
  }
  function dInRange(d,from,to){
    if(!d) return false;
    if(from && d<from) return false;
    if(to && d>to) return false;
    return true;
  }
  function light(rate,g,y){
    if(rate>=g) return 'l-g'; if(rate>=y) return 'l-y'; return 'l-r';
  }
  function cellShade(rate,g,y){
    if(rate>=g) return 'cell-g'; if(rate>=y) return 'cell-y'; return 'cell-r';
  }
  function gapCell(g){
    const cls = g<0?'gap-neg':(g>0?'gap-pos':'');
    return `<td class="${cls}">${g>0?'+':''}${g}</td>`;
  }

  /* ============================ PARSING ============================ */
  function classifySheet(header){
    const h = header.map(x=>String(x||'').toLowerCase());
    const hit = re => h.some(c=>re.test(c));
    if(hit(/follow up/) ) return 'leads';
    if(hit(/deal closer/)) return 'sales';
    return null;
  }
  function parseMetaRows(rows){
    let hr=-1, cProj=-1, cQ=[];
    for(let i=0;i<Math.min(rows.length,8);i++){
      const r=(rows[i]||[]).map(x=>String(x||'').trim());
      const pj=r.findIndex(c=>/project/i.test(c));
      const sp=r.map((c,idx)=>/spent/i.test(c)?idx:-1).filter(x=>x>=0);
      if(pj>=0 && sp.length){ hr=i; cProj=pj; cQ=sp; break; }
    }
    if(hr<0) return null;
    const map={};
    for(let i=hr+1;i<rows.length;i++){
      const r=rows[i]||[];
      const proj=String(r[cProj]||'').trim();
      if(!proj) continue;
      if(/^total$/i.test(proj)) continue;
      const np=normProject(proj);
      const q=cQ.map(c=>parseRevenue(r[c]));
      const total=q.reduce((a,b)=>a+b,0);
      if(total<=0) continue;
      const cur=map[np]||{q1:0,q2:0,q3:0,q4:0,total:0};
      cur.q1+=q[0]||0; cur.q2+=q[1]||0; cur.q3+=q[2]||0; cur.q4+=q[3]||0; cur.total+=total;
      map[np]=cur;
    }
    return Object.keys(map).length?map:null;
  }
  function parseLeadsRows(rows){
    const out=[];
    for(let i=1;i<rows.length;i++){
      const r=rows[i]; if(!r) continue;
      const name=String(r[1]||'').trim();
      const agentFull=String(r[3]||'').trim();
      if(!name && !agentFull && !r[0]) continue;
      const fu1=String(r[6]||'').trim().toLowerCase();
      const fu2=String(r[7]||'').trim().toLowerCase();
      const fu3=String(r[8]||'').trim().toLowerCase();
      const reason=String(r[11]||'').trim();
      const rc=reasonPrefix(reason);
      const phone=String(r[2]||'').trim();
      out.push({
        date:parseDate(r[0]), name, phone,
        hasPhone: phone!=='',
        agentFull, primary:primaryAgent(agentFull),
        project:normProject(r[4]), source:String(r[5]||'').trim(),
        fu1Raw:String(r[6]||'').trim(), fu2Raw:String(r[7]||'').trim(), fu3Raw:String(r[8]||'').trim(),
        temp:String(r[9]||'').trim(), status:String(r[10]||'').trim(),
        reason, reasonCode:rc, reasonLayer:reasonLayer(rc),
        isVL: fu1==='contacted',
        isCV: (fu2==='confirmed visit'),
        isPV: fu3==='visit',
        isMeta:/meta/i.test(String(r[5]||''))
      });
    }
    return out;
  }
  function parseSalesRows(rows){
    const out=[];
    for(let i=1;i<rows.length;i++){
      const r=rows[i]; if(!r) continue;
      const sumber=String(r[2]||'').trim();
      const project=String(r[1]||'').trim();
      if(sumber.toLowerCase()==='sumber'||project.toLowerCase()==='project') continue;
      if(!sumber && !project && !r[5]) continue;
      const status=String(r[14]||'').trim().toLowerCase();
      const isLeads = sumber.toUpperCase()==='LEADS';
      out.push({
        project:normProject(project), sumber:sumber.toUpperCase(),
        nama:String(r[3]||'').trim(), hp:String(r[4]||'').trim(),
        dealCloser:String(r[5]||'').trim(),
        tglBooking:parseDate(r[7]), tglAkad:parseDate(r[8]),
        revenue:parseRevenue(r[10]), statusRaw:String(r[14]||'').trim(),
        isLeads,
        isP: isLeads && status!=='batal/cancel' && status!=='',
        isAkad: isLeads && status==='akad',
        isBatal: isLeads && status==='batal/cancel'
      });
    }
    return out;
  }
  let DATA_LOADED=false, LAST_SYNC=null;
  function setStatus(el,type,html){ if(!el)return; el.className='status-line '+type; el.innerHTML=html; }

  function ingestWorkbookBuffer(buf){
    const wb=XLSX.read(buf,{type:'array',cellDates:true});
    let foundLeads=false, foundSales=false;
    for(const sn of wb.SheetNames){
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:''});
      if(!rows.length) continue;
      const kind=classifySheet(rows[0]);
      if(kind==='leads'){ LEADS=LEADS.concat(parseLeadsRows(rows)); foundLeads=true; }
      else if(kind==='sales'){ SALES=SALES.concat(parseSalesRows(rows)); foundSales=true; }
      else { const m=parseMetaRows(rows); if(m) META=m; }
    }
    return {foundLeads,foundSales};
  }
  function dedupeLeads(arr){
    const seen=new Set(), out=[];
    for(const l of arr){ const k=(l.phone||'')+'|'+(l.name||'').toLowerCase()+'|'+isoD(l.date)+'|'+(l.primary||'').toLowerCase();
      if(seen.has(k)) continue; seen.add(k); out.push(l); }
    return out;
  }
  function dedupeSales(arr){
    const seen=new Set(), out=[];
    for(const s of arr){ const k=s.project+'|'+(s.nama||'').toLowerCase()+'|'+s.hp+'|'+(s.dealCloser||'').toLowerCase()+'|'+s.statusRaw+'|'+s.revenue;
      if(seen.has(k)) continue; seen.add(k); out.push(s); }
    return out;
  }
  function okMessage(){
    return `✅ Data dimuat. Leads: <b>${fmt(LEADS.length)}</b> rows · Data Penjualan: <b>${fmt(SALES.length)}</b> rows`+
      (LAST_SYNC?` · sinkron terakhir ${LAST_SYNC.toLocaleTimeString('id-ID')}`:'');
  }
  async function handleFiles(files,statusEl){
    try{
      LEADS=[]; SALES=[];
      let fl=false,fs=false;
      for(const file of files){
        const r=ingestWorkbookBuffer(await file.arrayBuffer());
        fl=fl||r.foundLeads; fs=fs||r.foundSales;
      }
      if(!fl && !fs) throw new Error('Tidak menemukan sheet LEADS atau DATA PENJUALAN. Pastikan header berisi "Follow up - 1" / "Deal Closer".');
      LEADS=dedupeLeads(LEADS); SALES=dedupeSales(SALES);
      LAST_SYNC=new Date();
      setStatus(statusEl,'ok',okMessage()+(files.length>1?` · digabung dari ${files.length} file`:''));
      afterDataLoaded();
    }catch(e){ setStatus(statusEl,'err','❌ '+e.message); console.error(e); }
  }

  /* ---- Google Sheets sync via gviz CSV / Sheets API v4 ---- */
  function extractSheetId(s){
    if(!s) return '';
    const m=String(s).match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m?m[1]:String(s).trim();
  }
  const SHEET_NAMES={leads:'MASTER DATA_LEADS', sales:'DATA PENJUALAN', meta:'META ADS INPUT'};
  function parseCSV(text){
    const rows=[]; let row=[], field='', q=false, i=0;
    while(i<text.length){
      const c=text[i];
      if(q){
        if(c==='"'){ if(text[i+1]==='"'){field+='"';i+=2;continue;} q=false;i++;continue; }
        field+=c;i++;continue;
      }
      if(c==='"'){q=true;i++;continue;}
      if(c===','){row.push(field);field='';i++;continue;}
      if(c==='\r'){i++;continue;}
      if(c==='\n'){row.push(field);rows.push(row);row=[];field='';i++;continue;}
      field+=c;i++;
    }
    if(field!==''||row.length){row.push(field);rows.push(row);}
    return rows;
  }
  async function fetchSheetRows(id,name){
    const url=`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    const resp=await fetch(url);
    if(!resp.ok) throw new Error('HTTP '+resp.status+' ('+name+')');
    return parseCSV(await resp.text());
  }
  async function fetchSheetValues(id,name,key){
    const url=`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(name)}?key=${encodeURIComponent(key)}&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;
    const resp=await fetch(url);
    if(!resp.ok){
      let msg='API '+resp.status;
      try{ const j=await resp.json(); if(j.error&&j.error.message) msg+=': '+j.error.message; }catch(e){}
      if(resp.status===403) msg+=' (cek: API key valid? Google Sheets API aktif? sheet di-share "Anyone with link"?)';
      throw new Error(msg+' — '+name);
    }
    const j=await resp.json();
    return j.values||[];
  }
  async function syncFromSheets(idOrUrl,statusEl){
    const id=extractSheetId(idOrUrl);
    if(!id){ setStatus(statusEl,'err','❌ Spreadsheet ID / URL kosong.'); return false; }
    const apiKey=(localStorage.getItem('gp_api_key')||'').trim();
    const useApi=!!apiKey;
    let mode = useApi?'API v4':'gviz CSV';
    setStatus(statusEl,'ok',`⏳ Mengambil data dari Google Sheets (${mode})…`);
    try{
      let get = useApi ? (n)=>fetchSheetValues(id,n,apiKey) : (n)=>fetchSheetRows(id,n);
      let leadRows, saleRows;
      try{
        leadRows=await get(SHEET_NAMES.leads);
        saleRows=await get(SHEET_NAMES.sales);
      }catch(apiErr){
        if(useApi){
          console.warn('API gagal, fallback ke gviz:',apiErr.message);
          get=(n)=>fetchSheetRows(id,n); mode='gviz CSV (fallback)';
          leadRows=await get(SHEET_NAMES.leads);
          saleRows=await get(SHEET_NAMES.sales);
        } else throw apiErr;
      }
      if(leadRows.length<2 || saleRows.length<2) throw new Error('Sheet kosong / nama sheet beda.');
      LEADS=parseLeadsRows(leadRows);
      SALES=parseSalesRows(saleRows);
      try{ const m=parseMetaRows(await get(SHEET_NAMES.meta)); if(m)META=m; }
      catch(err){ console.warn('META ADS INPUT skip:',err.message); }
      LAST_SYNC=new Date();
      localStorage.setItem('gp_sheet_id',id);
      const warn = (mode.indexOf('gviz')>=0 && LEADS.length<20000) ? ' ⚠️ gviz hanya menarik '+fmt(LEADS.length)+' baris — kemungkinan ada baris kosong pemisah di sheet, atau data terpecah. Rapikan jadi 1 sheet tanpa baris kosong.' : '';
      setStatus(statusEl,'ok',`🔄 [${mode}] `+okMessage()+warn);
      afterDataLoaded();
      return true;
    }catch(e){
      const fileProto = location.protocol==='file:';
      setStatus(statusEl,'err',`❌ Gagal sinkron: ${e.message}.`+
        (fileProto?` <b>Dashboard dibuka via file:// — Google blokir CORS.</b> Jalankan via server lokal, atau upload manual.`
         :` Pastikan sheet di-share <b>"Anyone with the link · Viewer"</b>. Bila perlu, upload manual.`));
      console.error(e);
      return false;
    }
  }
  let SYNC_TIMER=null;
  function setAutoSync(on,id){
    if(SYNC_TIMER){ clearInterval(SYNC_TIMER); SYNC_TIMER=null; }
    localStorage.setItem('gp_autosync',on?'1':'0');
    if(on){ SYNC_TIMER=setInterval(()=>syncFromSheets(id,root.querySelector('#syncStatus')),5*60*1000); }
  }

  /* ============================ METRICS ============================ */
  function filterLeads(from,to){ return LEADS.filter(l=>!from&&!to?true:dInRange(l.date,from,to)); }
  function filterSales(from,to){ return SALES.filter(s=>!from&&!to?true:dInRange(s.tglBooking,from,to)); }

  function matchAgentLead(l,key){ return l.primary.toLowerCase().includes(key.toLowerCase()); }
  function matchAgentSale(s,key){ return s.dealCloser.toLowerCase().includes(key.toLowerCase()); }

  function computeRow(agent, leads, sales){
    const L=leads.filter(l=>matchAgentLead(l,agent.key));
    const sa=sales.filter(s=>matchAgentSale(s,agent.key));
    const leadsN=L.length;
    const vl=L.filter(l=>l.isVL).length;
    const cv=L.filter(l=>l.isCV).length;
    const pv=L.filter(l=>l.isPV).length;
    const meta=L.filter(l=>l.isMeta).length;
    const p=sa.filter(s=>s.isP).length;
    const akad=sa.filter(s=>s.isAkad).length;
    const batal=sa.filter(s=>s.isBatal).length;
    const tCV=round(vl*0.20), tPV=round(cv*0.70), tP=round(pv*0.30);
    return {agent:agent.name,key:agent.key,leads:leadsN,vl,cv,pv,meta,p,akad,batal,
      vlRate:pct(vl,leadsN),cvRate:pct(cv,vl),pvRate:pct(pv,cv),pRate:pct(p,pv),akadRate:pct(akad,p),
      tCV,gapCV:cv-tCV,tPV,gapPV:pv-tPV,tP,gapP:p-tP,
      rows:L, sales:sa};
  }
  function globalFunnel(){
    const total=LEADS.length;
    const vl=LEADS.filter(l=>l.isVL).length;
    const cv=LEADS.filter(l=>l.isCV).length;
    const pv=LEADS.filter(l=>l.isPV).length;
    const p=SALES.filter(s=>s.isP).length;
    const akad=SALES.filter(s=>s.isAkad).length;
    const batal=SALES.filter(s=>s.isBatal).length;
    return {total,vl,cv,pv,p,akad,batal};
  }

  /* week helpers */
  function weekRange(idx){
    const start=new Date(WEEK1_START); start.setDate(start.getDate()+idx*7);
    const end=new Date(start); end.setDate(end.getDate()+6); end.setHours(23,59,59);
    return [start,end];
  }
  function fmtD(d){ return d? String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0') : ''; }
  function isoD(d){ return d? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') : ''; }
  function isoMonth(d){ return d? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0') : ''; }
  const MONTH_ID=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  function monthLabel(ym){ const [y,m]=ym.split('-').map(Number); return MONTH_ID[m-1]+' '+y; }
  function monthWeeks(year,m0){
    const last=new Date(year,m0+1,0).getDate();
    const bounds=[[1,7],[8,14],[15,21],[22,28]];
    if(last>28) bounds.push([29,last]);
    return bounds.map((b,i)=>({n:i+1,start:new Date(year,m0,b[0]),end:new Date(year,m0,b[1],23,59,59)}));
  }

  /* ============================ FUNNEL CORONG (SVG) ============================ */
  function funnelSVG(stages){
    const W=600, H=stages.length*70+20, padTop=10;
    const widths=[0.94,0.76,0.58,0.42,0.30,0.22];
    let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%">`;
    stages.forEach((s,i)=>{
      const wTop=W*widths[i], wBot=W*(widths[i+1]!=null?widths[i+1]:widths[i]*0.8);
      const y=padTop+i*70, h=58;
      const xTopL=(W-wTop)/2, xTopR=(W+wTop)/2, xBotL=(W-wBot)/2, xBotR=(W+wBot)/2;
      svg+=`<g class="funnel-stage" data-stage="${s.key||''}">
        <polygon points="${xTopL},${y} ${xTopR},${y} ${xBotR},${y+h} ${xBotL},${y+h}" fill="${s.color}" stroke="#fff" stroke-width="2"/>
        <text x="${W/2}" y="${y+24}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">${s.label}</text>
        <text x="${W/2}" y="${y+45}" text-anchor="middle" fill="#fff" font-size="20" font-weight="800">${fmt(s.value)}</text>
      </g>`;
    });
    svg+=`</svg>`;
    return svg;
  }
  function funnelView(host,m,opts){
    opts=opts||{};
    const cvR=pct(m.cv,m.vl), pvR=pct(m.pv,m.cv), pR=pct(m.p,m.pv), vlR=pct(m.vl,m.total), akR=pct(m.akad,m.p);
    const stages=[
      {key:'leads',label:'TOTAL LEADS',value:m.total,color:'#2E7D32'},
      {key:'vl',label:'VALID LEADS',value:m.vl,color:'#388E3C'},
      {key:'cv',label:'CONFIRMED VISIT (CV)',value:m.cv,color:'#1565C0'},
      {key:'pv',label:'PROJECT VISITOR (PV)',value:m.pv,color:'#FB8C00'},
      {key:'p',label:'PURCHASER (P)',value:m.p,color:'#E53935'}
    ];
    const dot=(r,gg,yy)=>`<span class="light ${light(r,gg,yy)}"></span>`;
    const tCV=round(m.vl*0.20), tPV=round(m.cv*0.70), tP=round(m.pv*0.30);
    host.innerHTML=`<div class="funnel-wrap">
      <div>${funnelSVG(stages)}</div>
      <div class="conv-list">
        <div class="conv"><span class="ctxt"><b>VL Rate</b><div class="sub">Valid Leads / Total Leads</div></span><span class="ctgt">baseline</span><span class="cval">${vlR.toFixed(1)}%</span></div>
        <div class="conv"><span class="ctxt"><b>${dot(cvR,20,15)}CV Rate</b><div class="sub">CV / Valid Leads · target ${tCV}</div></span><span class="ctgt">≥20%</span><span class="cval">${cvR.toFixed(1)}%</span></div>
        <div class="conv"><span class="ctxt"><b>${dot(pvR,70,50)}PV Rate</b><div class="sub">PV / CV · target ${tPV}</div></span><span class="ctgt">≥70%</span><span class="cval">${pvR.toFixed(1)}%</span></div>
        <div class="conv"><span class="ctxt"><b>${dot(pR,30,20)}P Rate (Closing)</b><div class="sub">Purchaser / PV · target ${tP}</div></span><span class="ctgt">≥30%</span><span class="cval">${pR.toFixed(1)}%</span></div>
        <div class="conv" style="background:var(--mv-blue-l)"><span class="ctxt"><b>Akad Rate</b><div class="sub">Akad ${m.akad} / Purchaser · Batal ${m.batal}</div></span><span class="ctgt">baseline</span><span class="cval" style="color:var(--mv-blue)">${akR.toFixed(1)}%</span></div>
      </div></div>`;
    if(opts.nav) host.querySelectorAll('.funnel-stage').forEach(el=>el.onclick=()=>switchTab(el.dataset.stage==='p'?'ranking':'mingguan'));
  }
  function rowToFunnelM(r){ return {total:r.leads,vl:r.vl,cv:r.cv,pv:r.pv,p:r.p,akad:r.akad,batal:r.batal}; }
  function renderFunnel(host){ funnelView(host,globalFunnel(),{nav:true}); }
  function kpiStrip(host){
    const g=globalFunnel();
    const cvR=pct(g.cv,g.vl), pvR=pct(g.pv,g.cv), pR=pct(g.p,g.pv);
    host.innerHTML=`
      <div class="kpi"><div class="label">Total Leads</div><div class="val">${fmt(g.total)}</div></div>
      <div class="kpi green"><div class="label">Valid Leads</div><div class="val">${fmt(g.vl)}</div><div class="rate">${pctStr(g.vl,g.total)} of leads</div></div>
      <div class="kpi"><div class="label">Confirmed Visit</div><div class="val">${fmt(g.cv)}</div><div class="rate"><span class="light ${light(cvR,20,15)}"></span>${cvR.toFixed(1)}% CV/VL · tgt 20%</div></div>
      <div class="kpi"><div class="label">Project Visitor</div><div class="val">${fmt(g.pv)}</div><div class="rate"><span class="light ${light(pvR,70,50)}"></span>${pvR.toFixed(1)}% PV/CV · tgt 70%</div></div>
      <div class="kpi blue"><div class="label">Purchaser (excl Batal)</div><div class="val">${fmt(g.p)}</div><div class="rate"><span class="light ${light(pR,30,20)}"></span>${pR.toFixed(1)}% P/PV · tgt 30%</div></div>
      <div class="kpi blue"><div class="label">Akad</div><div class="val">${fmt(g.akad)}</div><div class="rate">${pctStr(g.akad,g.p)} of P · Batal ${g.batal}</div></div>`;
  }

  /* ============================ PAGE 0: OVERVIEW ============================ */
  function pageOverview(){
    const page=document.createElement('div');
    const k=document.createElement('div'); k.className='card';
    k.innerHTML=`<h2>Funnel Keseluruhan (semua periode)</h2><div class="desc">Sumber kebenaran Purchaser = DATA PENJUALAN (Sumber=LEADS, exclude Batal).</div><div class="kpis" id="kpiHost"></div>`;
    page.appendChild(k);
    const f=document.createElement('div'); f.className='card';
    f.innerHTML=`<h2>🔻 Funnel Corong</h2><div class="desc">Leads → Valid Leads → CV → PV → Purchaser. CV = Follow up-2 "Confirmed Visit" (sesuai sheet). Klik stage untuk drill ke laporan.</div><div id="funnelHost"></div>`;
    page.appendChild(f);
    kpiStrip(k.querySelector('#kpiHost'));
    renderFunnel(f.querySelector('#funnelHost'));
    return page;
  }

  /* ============================ PAGE: DATA & SYNC ============================ */
  function pageData(){
    const page=document.createElement('div');
    const savedId=localStorage.getItem('gp_sheet_id')||'1FR0xlB5pEmrbsm3SAtfVAUUG3sDM9MHiseUdTyTD1j8';
    const autoOn=localStorage.getItem('gp_autosync')==='1';
    const card=document.createElement('div'); card.className='card';
    const savedKey=localStorage.getItem('gp_api_key')||'';
    card.innerHTML=`<h2>🔄 Auto-Sync Google Sheets</h2>
      <div class="desc">Sheet harus di-share <b>"Anyone with the link · Viewer"</b>.<br>
      ✅ <b>Untuk data PENUH (25rb+ baris), isi API Key</b> di bawah — tanpa key, sync gviz akan <b>memotong</b> data di ±14rb baris (batasan Google).</div>
      <div class="sync-row">
        <input type="text" id="sheetUrl" placeholder="URL / ID Spreadsheet" value="${savedId}">
      </div>
      <div class="sync-row">
        <input type="text" id="apiKey" placeholder="Google Sheets API Key (utk data penuh) — kosongkan utk mode gviz" value="${savedKey}">
        <button class="btn" id="syncNow">⬇️ Sinkron Sekarang</button>
        <label class="switch"><input type="checkbox" id="autoSync" ${autoOn?'checked':''}> Auto-sync 5 menit</label>
      </div>
      <div class="status-line" id="syncStatus"></div>
      <details style="margin-top:10px;font-size:11.5px;color:var(--mv-muted)"><summary style="cursor:pointer;font-weight:600">📘 Cara dapat API Key (gratis, 1× setup)</summary>
        <ol style="margin:8px 0 0 16px;line-height:1.7">
          <li>Buka <b>console.cloud.google.com</b> → buat project (atau pakai yang ada).</li>
          <li>Menu <b>APIs &amp; Services → Library</b> → cari <b>"Google Sheets API"</b> → <b>Enable</b>.</li>
          <li><b>APIs &amp; Services → Credentials → Create Credentials → API key</b>. Salin key-nya.</li>
          <li>Tempel di kolom "API Key" di atas, lalu klik <b>Sinkron Sekarang</b>.</li>
          <li>Spreadsheet tetap harus di-share "Anyone with the link · Viewer".</li>
        </ol></details>`;
    page.appendChild(card);

    const up=document.createElement('div'); up.className='card';
    up.innerHTML=`<h2>📤 Upload Manual</h2>
      <div class="desc">Upload satu atau <b>beberapa file sekaligus</b> — semuanya <b>digabung otomatis</b> (anti-duplikat). Sheet (leads/penjualan/meta) dideteksi otomatis.</div>
      <div class="dropzone" id="dropzone">
        <div class="big">⬆️ Klik atau seret file ke sini</div>
        <div class="small">.xlsx / .xls / .csv · multi-sheet auto-detect</div>
        <input type="file" id="fileInput" multiple accept=".xlsx,.xls,.csv" style="display:none">
      </div>
      <div class="status-line" id="uploadStatus"></div>`;
    page.appendChild(up);

    setTimeout(()=>{
      const urlEl=card.querySelector('#sheetUrl'), st=card.querySelector('#syncStatus'), keyEl=card.querySelector('#apiKey');
      const saveKey=()=>localStorage.setItem('gp_api_key',(keyEl.value||'').trim());
      keyEl.onchange=saveKey;
      card.querySelector('#syncNow').onclick=()=>{ saveKey(); syncFromSheets(urlEl.value,st); };
      card.querySelector('#autoSync').onchange=e=>{ setAutoSync(e.target.checked, extractSheetId(urlEl.value)); if(e.target.checked) setStatus(st,'ok','✅ Auto-sync aktif (tiap 5 menit).'); else setStatus(st,'ok','⏸️ Auto-sync dimatikan.'); };
      if(DATA_LOADED) setStatus(st,'ok',okMessage());
      const dz=up.querySelector('#dropzone'), fi=up.querySelector('#fileInput'), ust=up.querySelector('#uploadStatus');
      dz.onclick=()=>fi.click();
      fi.onchange=e=>handleFiles([...e.target.files],ust);
      dz.ondragover=e=>{e.preventDefault();dz.classList.add('drag');};
      dz.ondragleave=()=>dz.classList.remove('drag');
      dz.ondrop=e=>{e.preventDefault();dz.classList.remove('drag');handleFiles([...e.dataTransfer.files],ust);};
    },0);
    return page;
  }

  /* ============================ DATE CONTROL widget ============================ */
  function dateControls(id, onChange, defaultFrom, defaultTo){
    const wrap=document.createElement('div'); wrap.className='controls';
    wrap.innerHTML=`
      <label>Dari</label><input type="date" id="${id}-from">
      <label>Sampai</label><input type="date" id="${id}-to">
      <button class="preset" data-p="all">Semua Data</button>
      <button class="preset" data-p="week">Minggu Ini</button>
      <button class="preset" data-p="month">Bulan Ini</button>`;
    setTimeout(()=>{
      const from=wrap.querySelector(`#${id}-from`), to=wrap.querySelector(`#${id}-to`);
      if(defaultFrom) from.value=isoD(defaultFrom);
      if(defaultTo) to.value=isoD(defaultTo);
      const fire=()=>onChange(from.value?parseDate(from.value):null, to.value?parseDate(to.value):null);
      from.onchange=to.onchange=fire;
      wrap.querySelectorAll('.preset').forEach(b=>b.onclick=()=>{
        wrap.querySelectorAll('.preset').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        const p=b.dataset.p; const now=new Date(2026,5,27);
        if(p==='all'){from.value='';to.value='';}
        else if(p==='week'){const mon=new Date(now);mon.setDate(now.getDate()-((now.getDay()+6)%7));const fri=new Date(mon);fri.setDate(mon.getDate()+4);from.value=isoD(mon);to.value=isoD(fri);}
        else if(p==='month'){from.value=isoD(new Date(now.getFullYear(),now.getMonth(),1));to.value=isoD(new Date(now.getFullYear(),now.getMonth()+1,0));}
        fire();
      });
    },0);
    return wrap;
  }

  /* ============================ DETAIL LEADS TABLE ============================ */
  function detailTable(getLeads, agentFilterRef){
    const box=document.createElement('div'); box.className='card';
    box.innerHTML=`<h2>🔎 Detail Identitas Leads</h2>
      <div class="desc">Klik nama sales di tabel atas untuk filter. Atau pilih di bawah.</div>
      <div class="controls">
        <label>Sales</label><select class="detail-agent"><option value="">— Semua —</option>${AGENTS.map(a=>`<option value="${a.key}">${a.name}</option>`).join('')}</select>
        <input type="text" class="detail-search" placeholder="cari nama / phone / project…" style="min-width:220px">
        <span class="muted detail-count"></span>
      </div>
      <div class="tbl-scroll"><table><thead><tr>
        <th>Lead In Date</th><th>Name</th><th>Phone</th><th>Primary Agent</th><th>Project</th><th>Source</th>
        <th>FU-1</th><th>FU-2</th><th>FU-3</th><th>Temp</th><th>Status</th><th>Reason Code</th>
      </tr></thead><tbody class="detail-body"></tbody></table></div>
      <div class="note">Menampilkan maksimum 500 baris pertama untuk performa.</div>`;
    const sel=box.querySelector('.detail-agent'), search=box.querySelector('.detail-search'),
          body=box.querySelector('.detail-body'), count=box.querySelector('.detail-count');
    function render(){
      let rows=getLeads();
      const key=sel.value, q=search.value.trim().toLowerCase();
      if(key) rows=rows.filter(l=>matchAgentLead(l,key));
      if(q) rows=rows.filter(l=>(l.name+l.phone+l.project+l.agentFull).toLowerCase().includes(q));
      count.textContent=`${fmt(rows.length)} leads`;
      body.innerHTML=rows.slice(0,500).map(l=>`<tr>
        <td>${isoD(l.date)}</td><td style="text-align:left">${l.name}</td><td>${l.phone}</td>
        <td style="text-align:left">${l.primary}</td><td>${l.project}</td><td style="text-align:left">${l.source}</td>
        <td>${l.fu1Raw}</td><td>${l.fu2Raw}</td><td>${l.fu3Raw}</td><td>${l.temp}</td><td>${l.status}</td><td style="text-align:left">${l.reason}</td>
      </tr>`).join('');
    }
    sel.onchange=render; search.oninput=render;
    box._render=render; box._setAgent=k=>{sel.value=k;render();};
    agentFilterRef.fn=box._setAgent;
    render();
    return box;
  }

  /* ============================ PAGE 1: REPORT JUMAT ============================ */
  function pageJumat(){
    const page=document.createElement('div');
    const agentRef={};
    let from=null,to=null;
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h2>Report Jumat — Weekly Leads Monitoring</h2>
      <div class="desc">Monitoring leads masuk per sales. Akumulasi = sepanjang seluruh data. Traffic light pada CV Rate (🟢≥20% 🟡≥15% 🔴&lt;15%).</div>`;
    const ctrl=dateControls('jumat',(f,t)=>{from=f;to=t;draw();});
    card.appendChild(ctrl);
    const tblScroll=document.createElement('div'); tblScroll.className='tbl-scroll';
    const tbl=document.createElement('table');
    tblScroll.appendChild(tbl); card.appendChild(tblScroll);
    page.appendChild(card);
    const detail=detailTable(()=>filterLeads(from,to),agentRef);
    page.appendChild(detail);

    function draw(){
      const leads=filterLeads(from,to);
      const accLeads=LEADS;
      let html=`<thead><tr>
        <th>Sales</th><th>Leads Masuk</th><th>Valid Leads</th><th>VL Rate</th><th>CV</th><th>CV Rate</th>
        <th>Akum L</th><th>Akum VL</th><th>Akum CV</th><th>Akum VL→CV%</th></tr></thead><tbody>`;
      let tL=0,tVL=0,tCV=0;
      AGENTS.forEach(a=>{
        const r=computeRow(a,leads,[]);
        const ac=computeRow(a,accLeads,[]);
        tL+=r.leads;tVL+=r.vl;tCV+=r.cv;
        html+=`<tr>
          <td class="name" data-key="${a.key}">${a.name}</td>
          <td>${fmt(r.leads)}</td><td>${fmt(r.vl)}</td><td>${r.vlRate.toFixed(1)}%</td>
          <td>${fmt(r.cv)}</td><td class="${cellShade(r.cvRate,20,15)}"><span class="light ${light(r.cvRate,20,15)}"></span>${r.cvRate.toFixed(1)}%</td>
          <td class="muted">${fmt(ac.leads)}</td><td class="muted">${fmt(ac.vl)}</td><td class="muted">${fmt(ac.cv)}</td><td class="muted">${ac.cvRate.toFixed(1)}%</td>
        </tr>`;
      });
      html+=`<tr class="total-row"><td>TOTAL</td><td>${fmt(tL)}</td><td>${fmt(tVL)}</td><td>${pct(tVL,tL).toFixed(1)}%</td><td>${fmt(tCV)}</td><td>${pct(tCV,tVL).toFixed(1)}%</td><td colspan="4"></td></tr></tbody>`;
      tbl.innerHTML=html;
      tbl.querySelectorAll('.name').forEach(td=>td.onclick=()=>agentRef.fn(td.dataset.key));
      detail._render();
    }
    draw();
    return page;
  }

  /* ============================ PAGE 2: REPORT MINGGUAN ============================ */
  function pageMingguan(){
    const page=document.createElement('div');
    const agentRef={}; let from=null,to=null;
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h2>Report Mingguan — Full Funnel</h2>
      <div class="desc">Evaluasi handling leads end-to-end. Kolom <span style="color:var(--mv-blue);font-weight:700">biru</span> = data dari DATA PENJUALAN. Target CV = ROUND(VL×0.20).</div>`;
    card.appendChild(dateControls('ming',(f,t)=>{from=f;to=t;draw();}));
    const sc=document.createElement('div'); sc.className='tbl-scroll';
    const tbl=document.createElement('table'); sc.appendChild(tbl); card.appendChild(sc);
    card.insertAdjacentHTML('beforeend',`<div class="legend-row">
      <span><span class="pill" style="background:var(--mv-blue-l);color:var(--mv-blue)">P / Akad / Batal</span> sumber DATA PENJUALAN (Deal Closer match)</span>
      <span><span class="light l-g"></span>≥target <span class="light l-y"></span>warning <span class="light l-r"></span>kritis</span></div>`);
    page.appendChild(card);
    const detail=detailTable(()=>filterLeads(from,to),agentRef);
    page.appendChild(detail);

    function draw(){
      const leads=filterLeads(from,to), sales=filterSales(from,to);
      let html=`<thead><tr>
        <th>Sales</th><th>Leads</th><th>VL</th><th>CV</th><th>PV</th>
        <th class="blue-col">P</th><th class="blue-col">Akad</th><th class="blue-col">Batal</th>
        <th>VL%</th><th>CV%</th><th>PV%</th><th>P%</th><th>Akad%</th><th>Target CV</th><th>Gap CV</th></tr></thead><tbody>`;
      const T={leads:0,vl:0,cv:0,pv:0,p:0,akad:0,batal:0,tCV:0};
      AGENTS.forEach(a=>{
        const r=computeRow(a,leads,sales);
        for(const k in T) if(k in r) T[k]+=r[k];
        html+=`<tr>
          <td class="name" data-key="${a.key}">${a.name}</td>
          <td>${fmt(r.leads)}</td><td>${fmt(r.vl)}</td><td>${fmt(r.cv)}</td><td>${fmt(r.pv)}</td>
          <td class="blue-col">${fmt(r.p)}</td><td class="blue-col">${fmt(r.akad)}</td><td class="blue-col">${fmt(r.batal)}</td>
          <td>${r.vlRate.toFixed(1)}%</td>
          <td class="${cellShade(r.cvRate,20,15)}"><span class="light ${light(r.cvRate,20,15)}"></span>${r.cvRate.toFixed(1)}%</td>
          <td class="${cellShade(r.pvRate,70,50)}">${r.pvRate.toFixed(1)}%</td>
          <td class="${cellShade(r.pRate,30,20)}">${r.pRate.toFixed(1)}%</td>
          <td>${r.akadRate.toFixed(1)}%</td>
          <td>${r.tCV}</td>${gapCell(r.gapCV)}</tr>`;
      });
      html+=`<tr class="total-row"><td>TOTAL</td><td>${fmt(T.leads)}</td><td>${fmt(T.vl)}</td><td>${fmt(T.cv)}</td><td>${fmt(T.pv)}</td>
        <td>${fmt(T.p)}</td><td>${fmt(T.akad)}</td><td>${fmt(T.batal)}</td>
        <td>${pct(T.vl,T.leads).toFixed(1)}%</td><td>${pct(T.cv,T.vl).toFixed(1)}%</td><td>${pct(T.pv,T.cv).toFixed(1)}%</td>
        <td>${pct(T.p,T.pv).toFixed(1)}%</td><td>${pct(T.akad,T.p).toFixed(1)}%</td><td>${round(T.vl*0.2)}</td>${gapCell(T.cv-round(T.vl*0.2))}</tr></tbody>`;
      tbl.innerHTML=html;
      tbl.querySelectorAll('.name').forEach(td=>td.onclick=()=>agentRef.fn(td.dataset.key));
      detail._render();
    }
    draw();
    return page;
  }

  /* ============================ PAGE 4: RANKING ============================ */
  function pageRanking(){
    const page=document.createElement('div');
    let from=null,to=null,sortKey='cv',sortDir=-1,selAgent=null,drillMonth='';
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h2>Ranking Semua Sales</h2><div class="desc">Klik header kolom untuk sortir. <b>Klik baris sales</b> untuk lihat funnel, tren mingguan &amp; identitas leads-nya. Heatmap pada rate.</div>`;
    card.appendChild(dateControls('rank',(f,t)=>{from=f;to=t;draw();}));
    const sc=document.createElement('div'); sc.className='tbl-scroll';
    const tbl=document.createElement('table'); sc.appendChild(tbl); card.appendChild(sc);
    page.appendChild(card);

    const drill=document.createElement('div'); drill.className='card'; drill.style.display='none';
    drill.innerHTML=`<h2>🔎 Drill-down: <span class="dr-name"></span> <button class="preset dr-close" style="float:right">✕ Tutup</button></h2>
      <div class="kpis dr-kpi" style="margin-bottom:14px"></div>
      <h3 style="color:var(--mv-green);font-size:13px;margin:6px 0">📅 Tabel Pekanan</h3>
      <div class="controls"><label>Filter Bulan</label><select class="dr-month"></select></div>
      <div class="dr-weekly"></div>
      <h3 style="color:var(--mv-green);font-size:13px;margin:16px 0 6px">Funnel Corong</h3><div class="dr-funnel"></div>
      <h3 style="color:var(--mv-green);font-size:13px;margin:16px 0 6px">Tren Mingguan</h3>
      <div class="chart-grid">
        <div class="chart-box"><h3>Volume Funnel / Minggu</h3><canvas class="dr-c1"></canvas></div>
        <div class="chart-box"><h3>CV Rate (target 20%)</h3><canvas class="dr-c2"></canvas></div>
      </div>
      <h3 style="color:var(--mv-green);font-size:13px;margin:16px 0 6px">Identitas Leads</h3>
      <div class="controls"><input type="text" class="dr-search" placeholder="cari nama / phone / project…" style="min-width:240px"><span class="muted dr-count"></span></div>
      <div class="tbl-scroll"><table><thead><tr>
        <th>Lead In Date</th><th>Name</th><th>Phone</th><th>Primary Agent</th><th>Project</th><th>Source</th>
        <th>FU-1</th><th>FU-2</th><th>FU-3</th><th>Temp</th><th>Status</th><th>Reason Code</th></tr></thead><tbody class="dr-body"></tbody></table></div>
      <div class="note">Maks 500 baris. Periode mengikuti filter tanggal di atas.</div>`;
    page.appendChild(drill);
    drill.querySelector('.dr-close').onclick=()=>{selAgent=null;draw();};
    drill.querySelector('.dr-search').oninput=()=>renderDrillLeads();

    function renderDrillLeads(){
      if(!selAgent) return;
      const leads=filterLeads(from,to);
      let rows=leads.filter(l=>matchAgentLead(l,selAgent.key));
      const q=drill.querySelector('.dr-search').value.trim().toLowerCase();
      if(q) rows=rows.filter(l=>(l.name+l.phone+l.project).toLowerCase().includes(q));
      drill.querySelector('.dr-count').textContent=`${fmt(rows.length)} leads`;
      drill.querySelector('.dr-body').innerHTML=rows.slice(0,500).map(l=>`<tr>
        <td>${isoD(l.date)}</td><td style="text-align:left">${l.name}</td><td>${l.phone}</td><td style="text-align:left">${l.primary}</td>
        <td>${l.project}</td><td style="text-align:left">${l.source}</td><td>${l.fu1Raw}</td><td>${l.fu2Raw}</td><td>${l.fu3Raw}</td>
        <td>${l.temp}</td><td>${l.status}</td><td style="text-align:left">${l.reason}</td></tr>`).join('');
    }
    function pekanBlock(title,r,isTotal){
      return `<div class="pekan-blk">
        <div class="pekan-title">${title}</div>
        <table class="pekan-tbl ${isTotal?'pekan-total':''}"><thead><tr class="pekan-hd">
          <th>L</th><th>VL</th><th>CV</th><th>PV</th><th>P</th><th>VL Rate</th><th>CV Rate</th><th>PV Rate</th><th>P Rate</th></tr></thead>
        <tbody><tr><td>${fmt(r.leads)}</td><td>${fmt(r.vl)}</td><td>${fmt(r.cv)}</td><td>${fmt(r.pv)}</td><td>${fmt(r.p)}</td>
          <td>${r.vlRate.toFixed(1)}%</td><td><span class="light ${light(r.cvRate,20,15)}"></span>${r.cvRate.toFixed(1)}%</td>
          <td><span class="light ${light(r.pvRate,70,50)}"></span>${r.pvRate.toFixed(1)}%</td><td>${r.pRate.toFixed(1)}%</td></tr></tbody></table></div>`;
    }
    function renderWeekly(){
      if(!selAgent || !drillMonth){ drill.querySelector('.dr-weekly').innerHTML=''; return; }
      const [y,m]=drillMonth.split('-').map(Number);
      const weeks=monthWeeks(y,m-1);
      let html='', T={leads:0,vl:0,cv:0,pv:0,p:0};
      weeks.forEach(w=>{
        const r=computeRow(selAgent,LEADS.filter(l=>dInRange(l.date,w.start,w.end)),SALES.filter(s=>dInRange(s.tglBooking,w.start,w.end)));
        ['leads','vl','cv','pv','p'].forEach(k=>T[k]+=r[k]);
        html+=pekanBlock(`Pekan ${w.n} · ${fmtD(w.start)}–${fmtD(w.end)}`,r,false);
      });
      const rt={leads:T.leads,vl:T.vl,cv:T.cv,pv:T.pv,p:T.p,vlRate:pct(T.vl,T.leads),cvRate:pct(T.cv,T.vl),pvRate:pct(T.pv,T.cv),pRate:pct(T.p,T.pv)};
      html+=pekanBlock(`TOTAL ${monthLabel(drillMonth)}`,rt,true);
      drill.querySelector('.dr-weekly').innerHTML=html;
    }
    function renderDrill(){
      if(!selAgent){ drill.style.display='none'; return; }
      drill.style.display='';
      const r=computeRow(selAgent,filterLeads(from,to),filterSales(from,to));
      drill.querySelector('.dr-name').textContent=selAgent.name;
      drill.querySelector('.dr-kpi').innerHTML=`
        <div class="kpi"><div class="label">Leads</div><div class="val">${fmt(r.leads)}</div></div>
        <div class="kpi green"><div class="label">VL</div><div class="val">${fmt(r.vl)}</div></div>
        <div class="kpi"><div class="label">CV</div><div class="val">${fmt(r.cv)}</div><div class="rate"><span class="light ${light(r.cvRate,20,15)}"></span>${r.cvRate.toFixed(1)}%</div></div>
        <div class="kpi"><div class="label">PV</div><div class="val">${fmt(r.pv)}</div></div>
        <div class="kpi blue"><div class="label">Purchaser</div><div class="val">${fmt(r.p)}</div></div>
        <div class="kpi blue"><div class="label">Akad</div><div class="val">${fmt(r.akad)}</div></div>`;
      const months=[...new Set(LEADS.filter(l=>l.date).map(l=>isoMonth(l.date)))].sort();
      if(!drillMonth || months.indexOf(drillMonth)<0){
        const cnt={}; LEADS.forEach(l=>{const k=isoMonth(l.date); if(k)cnt[k]=(cnt[k]||0)+1;});
        drillMonth=months.slice().sort((a,b)=>(cnt[b]||0)-(cnt[a]||0))[0]||'';
      }
      const msel=drill.querySelector('.dr-month');
      msel.innerHTML=months.map(m=>`<option value="${m}" ${m===drillMonth?'selected':''}>${monthLabel(m)}</option>`).join('');
      msel.onchange=()=>{ drillMonth=msel.value; renderWeekly(); };
      renderWeekly();
      funnelView(drill.querySelector('.dr-funnel'),rowToFunnelM(r),{});
      const weeks=[];
      for(let i=0;i<26;i++){ const [ws,we]=weekRange(i);
        weeks.push(computeRow(selAgent,LEADS.filter(l=>dInRange(l.date,ws,we)),SALES.filter(s=>dInRange(s.tglBooking,ws,we)))); }
      const labels=weeks.map((w,i)=>'W'+(i+1));
      const baseOpt={responsive:true,plugins:{legend:{labels:{font:{size:10},boxWidth:12}}},scales:{x:{ticks:{font:{size:8}}},y:{beginAtZero:true,ticks:{font:{size:9}}}}};
      const mk=(cls,cfg)=>{ if(charts[cls])charts[cls].destroy(); charts[cls]=new Chart(drill.querySelector('.'+cls),cfg); };
      setTimeout(()=>{
        mk('dr-c1',{type:'bar',data:{labels,datasets:[
          {label:'Leads',data:weeks.map(w=>w.leads),backgroundColor:'#4CAF50'},
          {label:'VL',data:weeks.map(w=>w.vl),backgroundColor:'#1565C0'},
          {label:'CV',data:weeks.map(w=>w.cv),backgroundColor:'#FF9800'},
          {label:'PV',data:weeks.map(w=>w.pv),backgroundColor:'#F44336'}]},options:baseOpt});
        mk('dr-c2',{type:'line',data:{labels,datasets:[
          {label:'CV Rate %',data:weeks.map(w=>+w.cvRate.toFixed(1)),borderColor:'#FF9800',backgroundColor:'rgba(255,152,0,.15)',tension:.3,fill:true},
          {label:'Target 20%',data:weeks.map(()=>20),borderColor:'#4CAF50',borderDash:[6,4],pointRadius:0}]},options:baseOpt});
      },0);
      renderDrillLeads();
    }

    const cols=[['#','',null],['Sales','agent',null],['Leads','leads',1],['VL','vl',1],['CV','cv',1],['PV','pv',1],
      ['P','p',1],['Akad','akad',1],['VL%','vlRate',1],['CV%','cvRate',1],['PV%','pvRate',1],['P%','pRate',1],['Akad%','akadRate',1],
      ['Tgt CV','tCV',1],['Gap CV','gapCV',1]];

    function draw(){
      const leads=filterLeads(from,to), sales=filterSales(from,to);
      let rows=AGENTS.map(a=>computeRow(a,leads,sales));
      rows.sort((x,y)=> (x[sortKey]<y[sortKey]?-1:x[sortKey]>y[sortKey]?1:0)*sortDir);
      const rankCV=[...rows].sort((a,b)=>b.cv-a.cv);
      const rankP=[...rows].sort((a,b)=>b.p-a.p);
      let html=`<thead><tr>${cols.map(c=>`<th data-sort="${c[1]}">${c[0]}${c[1]===sortKey?(sortDir<0?' ▼':' ▲'):''}</th>`).join('')}<th>Rank CV</th><th>Rank P</th></tr></thead><tbody>`;
      rows.forEach((r,i)=>{
        const isSel=selAgent&&selAgent.key===r.key;
        html+=`<tr class="week-row ${isSel?'sel':''}" data-key="${r.key}"><td>${i+1}</td><td class="name">${r.agent}</td>
          <td>${fmt(r.leads)}</td><td>${fmt(r.vl)}</td><td>${fmt(r.cv)}</td><td>${fmt(r.pv)}</td>
          <td class="blue-col">${fmt(r.p)}</td><td class="blue-col">${fmt(r.akad)}</td>
          <td>${r.vlRate.toFixed(1)}%</td>
          <td class="${cellShade(r.cvRate,20,15)}">${r.cvRate.toFixed(1)}%</td>
          <td class="${cellShade(r.pvRate,70,50)}">${r.pvRate.toFixed(1)}%</td>
          <td class="${cellShade(r.pRate,30,20)}">${r.pRate.toFixed(1)}%</td>
          <td>${r.akadRate.toFixed(1)}%</td>
          <td>${r.tCV}</td>${gapCell(r.gapCV)}
          <td>#${rankCV.indexOf(r)+1}</td><td>#${rankP.indexOf(r)+1}</td></tr>`;
      });
      html+=`</tbody>`;
      tbl.innerHTML=html;
      tbl.querySelectorAll('th[data-sort]').forEach(th=>{
        const k=th.dataset.sort; if(!k)return;
        th.onclick=()=>{ if(sortKey===k)sortDir*=-1; else{sortKey=k;sortDir=-1;} draw(); };
      });
      tbl.querySelectorAll('tr.week-row').forEach(tr=>tr.onclick=ev=>{
        if(ev.target.closest('th'))return;
        const key=tr.dataset.key;
        selAgent=(selAgent&&selAgent.key===key)?null:AGENTS.find(a=>a.key===key);
        draw();
        if(selAgent) drill.scrollIntoView({behavior:'smooth',block:'start'});
      });
      renderDrill();
    }
    draw();
    return page;
  }

  /* ============================ PAGE 5: REASON CODE ============================ */
  function pageReason(){
    const page=document.createElement('div');
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h2>Reason Code Analysis</h2><div class="desc">Pivot Agent × Reason Code, dikelompokkan per Layer. L1 Leads→CV · L2 CV→PV · L3 PV→Booking.</div>`;
    const chartBox=document.createElement('div'); chartBox.className='chart-box'; chartBox.style.marginBottom='16px';
    chartBox.innerHTML=`<h3>Top 10 Reason Code</h3><canvas class="c-reason" style="max-height:260px"></canvas>`;
    card.appendChild(chartBox);
    const sc=document.createElement('div'); sc.className='tbl-scroll';
    const tbl=document.createElement('table'); sc.appendChild(tbl); card.appendChild(sc);
    page.appendChild(card);

    const allCodes=[];
    ['L1','L2','L3'].forEach(L=>REASON_LAYERS[L].forEach(c=>{ if(LEADS.some(l=>l.reasonCode===c)) allCodes.push({code:c,layer:L}); }));
    let head=`<thead><tr><th>Sales</th>`;
    allCodes.forEach(c=>{ head+=`<th title="${c.layer}">${c.code}</th>`; });
    head+=`<th>Total</th></tr></thead><tbody>`;
    let body='';
    const colTot={}; allCodes.forEach(c=>colTot[c.code]=0); let grand=0;
    AGENTS.forEach(a=>{
      const L=LEADS.filter(l=>matchAgentLead(l,a.key));
      let row=`<tr><td class="name">${a.name}</td>`; let rt=0;
      allCodes.forEach(c=>{ const n=L.filter(l=>l.reasonCode===c.code).length; colTot[c.code]+=n; rt+=n; row+=`<td>${n||''}</td>`; });
      grand+=rt; row+=`<td><b>${rt}</b></td></tr>`; body+=row;
    });
    let totRow=`<tr class="total-row"><td>TOTAL</td>`;
    allCodes.forEach(c=>totRow+=`<td>${colTot[c.code]}</td>`); totRow+=`<td>${grand}</td></tr>`;
    tbl.innerHTML=head+body+totRow+`</tbody>`;

    const sorted=Object.entries(colTot).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const layerColor=code=>{const l=reasonLayer(code);return l==='L1'?'#F44336':l==='L2'?'#FF9800':'#1565C0';};
    if(charts['c-reason'])charts['c-reason'].destroy();
    setTimeout(()=>{
      charts['c-reason']=new Chart(card.querySelector('.c-reason'),{type:'bar',
        data:{labels:sorted.map(s=>s[0]),datasets:[{label:'Jumlah',data:sorted.map(s=>s[1]),backgroundColor:sorted.map(s=>layerColor(s[0]))}]},
        options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});
    },0);
    return page;
  }

  /* ============================ PAGE 6: META ADS vs FUNNEL ============================ */
  const fmtRp = n => 'Rp'+(Math.round(n||0)).toLocaleString('id-ID');
  const fmtJt = n => (n? (n/1e6).toLocaleString('id-ID',{maximumFractionDigits:1}) : '0')+' Jt';

  function funnelOf(leads,sales){
    const total=leads.length;
    const vl=leads.filter(l=>l.isVL).length, cv=leads.filter(l=>l.isCV).length, pv=leads.filter(l=>l.isPV).length;
    const metaLeads=leads.filter(l=>l.isMeta).length;
    const p=sales.filter(s=>s.isP).length, akad=sales.filter(s=>s.isAkad).length;
    const revenue=sales.filter(s=>s.isP).reduce((a,s)=>a+s.revenue,0);
    return {total,vl,cv,pv,metaLeads,p,akad,revenue};
  }
  function pageMeta(){
    const page=document.createElement('div');
    if(!META || !Object.keys(META).length){
      const w=document.createElement('div'); w.className='card';
      w.innerHTML=`<h2>5 · Meta Ads vs Funnel</h2>
        <div class="empty"><div class="big">Data Meta Ads belum tersedia 📭</div>
        <div>Sheet <b>META ADS INPUT</b> (kolom PROJECT + Q1/Q2/Q3/Q4 SPENT) belum terbaca. Update spend di sheet itu lalu sinkron/upload ulang — laporan akan otomatis terisi.</div></div>`;
      page.appendChild(w); return page;
    }
    const projects=Object.keys(META).sort();
    const projRows=projects.map(pj=>{
      const lf=LEADS.filter(l=>l.project===pj);
      const sf=SALES.filter(s=>s.project===pj && s.isLeads);
      const f=funnelOf(lf,sf);
      const spend=META[pj].total;
      return {pj,spend,...f,
        cpl: f.metaLeads? spend/f.metaLeads : 0,
        costCV: f.cv? spend/f.cv : 0,
        cac: f.p? spend/f.p : 0,
        roas: spend? f.revenue/spend : 0};
    });
    const T=projRows.reduce((a,r)=>{['spend','total','vl','cv','pv','metaLeads','p','akad','revenue'].forEach(k=>a[k]=(a[k]||0)+r[k]);return a;},{});

    const kpi=document.createElement('div'); kpi.className='card';
    kpi.innerHTML=`<h2>5 · Meta Ads vs Funnel Per Sales</h2>
      <div class="desc">Budget iklan Meta (sheet <b>META ADS INPUT</b>, per project) diadu dengan funnel hasilnya. Spend per-sales = alokasi spend project menurut porsi <i>Meta leads</i> sales tsb.</div>
      <div class="kpis">
        <div class="kpi blue"><div class="label">Total Meta Spend</div><div class="val">${fmtJt(T.spend)}</div><div class="rate">${fmtRp(T.spend)}</div></div>
        <div class="kpi"><div class="label">Meta Leads</div><div class="val">${fmt(T.metaLeads)}</div><div class="rate">dari ${fmt(T.total)} total leads project ber-budget</div></div>
        <div class="kpi"><div class="label">CPL (Cost / Meta Lead)</div><div class="val">${fmtRp(T.metaLeads?T.spend/T.metaLeads:0)}</div></div>
        <div class="kpi"><div class="label">CV</div><div class="val">${fmt(T.cv)}</div><div class="rate">Cost/CV ${fmtRp(T.cv?T.spend/T.cv:0)}</div></div>
        <div class="kpi blue"><div class="label">Purchaser</div><div class="val">${fmt(T.p)}</div><div class="rate">CAC ${fmtRp(T.p?T.spend/T.p:0)}</div></div>
        <div class="kpi green"><div class="label">Revenue (LEADS)</div><div class="val">${fmtJt(T.revenue)}</div><div class="rate">ROAS ${(T.spend?T.revenue/T.spend:0).toFixed(2)}×</div></div>
      </div>`;
    page.appendChild(kpi);

    const chartCard=document.createElement('div'); chartCard.className='card';
    chartCard.innerHTML=`<h2>Spend vs Hasil per Project</h2><div class="chart-grid">
      <div class="chart-box"><h3>Meta Spend (Jt) vs Purchaser</h3><canvas class="m-c1"></canvas></div>
      <div class="chart-box"><h3>CAC per Project (Rp / Purchaser)</h3><canvas class="m-c2"></canvas></div></div>`;
    page.appendChild(chartCard);

    const projCard=document.createElement('div'); projCard.className='card';
    projCard.innerHTML=`<h2>Per Project</h2><div class="tbl-scroll"><table class="meta-proj"></table></div>`;
    page.appendChild(projCard);

    const salesCard=document.createElement('div'); salesCard.className='card';
    salesCard.innerHTML=`<h2>Per Sales (spend dialokasikan)</h2>
      <div class="desc">Spend tiap project dibagi ke sales sesuai porsi Meta leads-nya di project itu, lalu dijumlah lintas project.</div>
      <div class="tbl-scroll"><table class="meta-sales"></table></div>`;
    page.appendChild(salesCard);

    let ph=`<thead><tr><th>Project</th><th class="blue-col">Meta Spend</th><th>Total Leads</th><th>Meta Leads</th><th>VL</th><th>CV</th><th>PV</th>
      <th class="blue-col">P</th><th class="blue-col">Akad</th><th>CPL</th><th>Cost/CV</th><th>CAC</th><th class="blue-col">Revenue</th><th>ROAS</th></tr></thead><tbody>`;
    projRows.forEach(r=>{
      ph+=`<tr><td>${r.pj}</td><td class="blue-col">${fmtJt(r.spend)}</td><td>${fmt(r.total)}</td><td>${fmt(r.metaLeads)}</td>
        <td>${fmt(r.vl)}</td><td>${fmt(r.cv)}</td><td>${fmt(r.pv)}</td><td class="blue-col">${fmt(r.p)}</td><td class="blue-col">${fmt(r.akad)}</td>
        <td>${r.cpl?fmtRp(r.cpl):'–'}</td><td>${r.costCV?fmtRp(r.costCV):'–'}</td><td>${r.cac?fmtRp(r.cac):'–'}</td>
        <td class="blue-col">${fmtJt(r.revenue)}</td><td>${r.roas?r.roas.toFixed(2)+'×':'–'}</td></tr>`;
    });
    ph+=`<tr class="total-row"><td>TOTAL</td><td>${fmtJt(T.spend)}</td><td>${fmt(T.total)}</td><td>${fmt(T.metaLeads)}</td><td>${fmt(T.vl)}</td><td>${fmt(T.cv)}</td><td>${fmt(T.pv)}</td>
      <td>${fmt(T.p)}</td><td>${fmt(T.akad)}</td><td>${fmtRp(T.metaLeads?T.spend/T.metaLeads:0)}</td><td>${fmtRp(T.cv?T.spend/T.cv:0)}</td><td>${fmtRp(T.p?T.spend/T.p:0)}</td>
      <td>${fmtJt(T.revenue)}</td><td>${(T.spend?T.revenue/T.spend:0).toFixed(2)}×</td></tr></tbody>`;
    projCard.querySelector('.meta-proj').innerHTML=ph;

    const alloc={}; AGENTS.forEach(a=>alloc[a.key]={spend:0});
    projRows.forEach(r=>{
      let lf=LEADS.filter(l=>l.project===r.pj && l.isMeta);
      if(!lf.length) lf=LEADS.filter(l=>l.project===r.pj);
      const byAgent={}; let tot=0;
      AGENTS.forEach(a=>{ const n=lf.filter(l=>matchAgentLead(l,a.key)).length; byAgent[a.key]=n; tot+=n; });
      if(tot>0) AGENTS.forEach(a=>{ alloc[a.key].spend += r.spend*(byAgent[a.key]/tot); });
    });
    let sh=`<thead><tr><th>Sales</th><th class="blue-col">Alloc Spend</th><th>Meta Leads</th><th>VL</th><th>CV</th><th>PV</th>
      <th class="blue-col">P</th><th class="blue-col">Akad</th><th>CPL</th><th>Cost/CV</th><th>CAC</th></tr></thead><tbody>`;
    const ST={spend:0,metaLeads:0,vl:0,cv:0,pv:0,p:0,akad:0};
    AGENTS.forEach(a=>{
      const r=computeRow(a,LEADS,SALES);
      const ml=LEADS.filter(l=>matchAgentLead(l,a.key)&&l.isMeta).length;
      const sp=alloc[a.key].spend;
      ST.spend+=sp;ST.metaLeads+=ml;ST.vl+=r.vl;ST.cv+=r.cv;ST.pv+=r.pv;ST.p+=r.p;ST.akad+=r.akad;
      sh+=`<tr><td class="name">${a.name}</td><td class="blue-col">${fmtJt(sp)}</td><td>${fmt(ml)}</td>
        <td>${fmt(r.vl)}</td><td>${fmt(r.cv)}</td><td>${fmt(r.pv)}</td><td class="blue-col">${fmt(r.p)}</td><td class="blue-col">${fmt(r.akad)}</td>
        <td>${ml?fmtRp(sp/ml):'–'}</td><td>${r.cv?fmtRp(sp/r.cv):'–'}</td><td>${r.p?fmtRp(sp/r.p):'–'}</td></tr>`;
    });
    sh+=`<tr class="total-row"><td>TOTAL</td><td>${fmtJt(ST.spend)}</td><td>${fmt(ST.metaLeads)}</td><td>${fmt(ST.vl)}</td><td>${fmt(ST.cv)}</td><td>${fmt(ST.pv)}</td>
      <td>${fmt(ST.p)}</td><td>${fmt(ST.akad)}</td><td>${fmtRp(ST.metaLeads?ST.spend/ST.metaLeads:0)}</td><td>${fmtRp(ST.cv?ST.spend/ST.cv:0)}</td><td>${fmtRp(ST.p?ST.spend/ST.p:0)}</td></tr></tbody>`;
    salesCard.querySelector('.meta-sales').innerHTML=sh;

    setTimeout(()=>{
      const labels=projRows.map(r=>r.pj);
      const baseOpt={responsive:true,plugins:{legend:{labels:{font:{size:10},boxWidth:12}}},scales:{x:{ticks:{font:{size:8}}},y:{beginAtZero:true,ticks:{font:{size:9}}}}};
      if(charts['m-c1'])charts['m-c1'].destroy();
      charts['m-c1']=new Chart(chartCard.querySelector('.m-c1'),{data:{labels,datasets:[
        {type:'bar',label:'Meta Spend (Jt)',data:projRows.map(r=>+(r.spend/1e6).toFixed(1)),backgroundColor:'#1565C0',yAxisID:'y'},
        {type:'line',label:'Purchaser',data:projRows.map(r=>r.p),borderColor:'#E53935',backgroundColor:'#E53935',yAxisID:'y1',tension:.3}
      ]},options:{...baseOpt,scales:{x:{ticks:{font:{size:8}}},y:{position:'left',beginAtZero:true,ticks:{font:{size:9}}},y1:{position:'right',beginAtZero:true,grid:{drawOnChartArea:false},ticks:{font:{size:9}}}}}});
      if(charts['m-c2'])charts['m-c2'].destroy();
      charts['m-c2']=new Chart(chartCard.querySelector('.m-c2'),{type:'bar',data:{labels,datasets:[
        {label:'CAC (Rp/Purchaser)',data:projRows.map(r=>Math.round(r.cac)),backgroundColor:projRows.map(r=>r.p?'#4CAF50':'#bbb')}]},options:baseOpt});
    },0);
    return page;
  }

  /* ============================ ROUTER ============================ */
  const PAGES={overview:pageOverview,jumat:pageJumat,mingguan:pageMingguan,ranking:pageRanking,reason:pageReason,meta:pageMeta,data:pageData};
  let CURRENT_PAGE='overview';
  function emptyState(){
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<div class="empty"><div class="big">Belum ada data 📭</div>
      <div style="margin-bottom:16px">Sinkronkan dengan Google Sheets atau upload file untuk mulai.</div>
      <button class="btn go-data">🔄 Buka Data &amp; Sync</button></div>`;
    d.querySelector('.go-data').onclick=()=>switchTab('data');
    return d;
  }
  function showPage(name){
    CURRENT_PAGE=name;
    const host=pagesEl; host.innerHTML='';
    if(!DATA_LOADED && name!=='data'){ host.appendChild(emptyState()); return; }
    host.appendChild(PAGES[name]());
  }
  function switchTab(name){
    tabsEl.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
    showPage(name);
  }
  function afterDataLoaded(){
    DATA_LOADED=true;
    showPage(CURRENT_PAGE==='data'?'overview':CURRENT_PAGE);
    if(CURRENT_PAGE==='data') switchTab('overview');
  }

  /* ============================ SHELL ============================ */
  root.classList.add('monev-root');
  root.innerHTML=`
    <header class="mv-appbar">
      <div>
        <h1>Sales Monev Control</h1>
        <div class="sub">Sales Monitoring &amp; Evaluation · 13 Agent · 14 Project</div>
      </div>
      <div class="spacer"></div>
      <div class="target">🎯 Target 2026: <b>500 unit</b></div>
    </header>
    <div class="wrap">
      <div class="tabs" id="mv-tabs">
        <div class="tab active" data-page="overview">📊 Funnel Overview</div>
        <div class="tab" data-page="jumat">1 · Report Jumat</div>
        <div class="tab" data-page="mingguan">2 · Report Mingguan</div>
        <div class="tab" data-page="ranking">3 · Ranking Sales</div>
        <div class="tab" data-page="reason">4 · Reason Code</div>
        <div class="tab" data-page="meta">5 · Meta Ads vs Funnel</div>
        <div class="tab tab-data" data-page="data">🔄 Data &amp; Sync</div>
      </div>
      <div id="mv-pages"></div>
    </div>`;
  const tabsEl=root.querySelector('#mv-tabs');
  const pagesEl=root.querySelector('#mv-pages');
  tabsEl.querySelectorAll('.tab').forEach(t=>t.onclick=()=>switchTab(t.dataset.page));

  /* ============================ STARTUP ============================ */
  showPage('overview');
  const savedId=localStorage.getItem('gp_sheet_id');
  const auto=localStorage.getItem('gp_autosync')==='1';
  if(savedId && auto){
    syncFromSheets(savedId,null).then(ok=>{ if(ok) setAutoSync(true,savedId); });
  }

  /* ============================ CLEANUP ============================ */
  return function cleanup(){
    if(SYNC_TIMER){ clearInterval(SYNC_TIMER); SYNC_TIMER=null; }
    Object.values(charts).forEach(c=>{ try{ c.destroy(); }catch(e){} });
    root.innerHTML='';
    root.classList.remove('monev-root');
  };
}
