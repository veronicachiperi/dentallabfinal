const fs=require('fs');const vm=require('vm');const {JSDOM}=require('jsdom');
const dir='/sessions/gallant-peaceful-faraday/mnt/MONDAY - LABORATORY SYSTEM/dental-lab/';
const dom=new JSDOM('<!DOCTYPE html><body><div id="doctorShell"></div><div id="archiveShell"></div></body>',{url:'http://localhost/doctor.html'});
const w=dom.window;
const ctx=vm.createContext({window:w,document:w.document,location:w.location,history:w.history,navigator:w.navigator,localStorage:w.localStorage,URLSearchParams:w.URLSearchParams,Blob:w.Blob,URL:w.URL,console,Date,Math,JSON,parseInt,parseFloat,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),alert:()=>{},confirm:()=>true,prompt:()=>''});
function load(f){vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx,{filename:f});}
load('js/data.js');load('js/app.js');
vm.runInContext(`
CLINICS.length=0;CLINICS.push({id:'CL1',name:'Clinica Alfa'},{id:'CL2',name:'Clinica Beta'});
CASES.length=0;
CASES.push({id:1,seq:1,name:'Activ Iulie',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'cam',finala:'2026-07-20'});
CASES.push({id:2,seq:2,name:'Activ August',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'cam',finala:'2026-08-15'});
CASES.push({id:3,seq:3,name:'Arh Mai',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'trimis',finala:'2026-05-10',sentDate:'2026-05-11'});
CASES.push({id:4,seq:4,name:'Arh Iulie',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'trimis',finala:'2026-07-02',sentDate:'2026-07-03'});
window.getCurrentUser=function(){return{role:'doctor',doctorName:'Dr. Alex Butnaru',name:'Alex Butnaru',initials:'AB'};};
getCurrentUser=window.getCurrentUser;
`,ctx);
function q(sel){return w.document.querySelectorAll(sel);}
function dhtml(){return w.document.getElementById('doctorShell').innerHTML;}
function ahtml(){return w.document.getElementById('archiveShell').innerHTML;}
let pass=0,fail=0;function ok(n,c){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n);}}

// DOCTOR main-view interval
vm.runInContext("history.replaceState({},'','doctor.html?view=active');doctorMainFilter={from:'',to:''};renderDoctor();",ctx);
ok('main interval bar present in active',/docMainFrom/.test(dhtml()));
ok('active shows 2 rows before filter',q('.pc-row-grid[data-case-id]').length===2);
vm.runInContext("doctorMainFilter={from:'2026-07-01',to:'2026-07-31'};renderDoctor();",ctx);
ok('main interval keeps 1 row (July)',q('.pc-row-grid[data-case-id]').length===1);
ok('main interval kept Activ Iulie',dhtml().includes('Activ Iulie'));
ok('main interval dropped Activ August',!dhtml().includes('Activ August'));

// ARCHIVE interval
vm.runInContext("archiveFilter.from='';archiveFilter.to='';archiveFilter.year=String(new Date().getFullYear());renderArchive();",ctx);
ok('archive interval inputs present',/id="arFrom"/.test(ahtml())&&/id="arTo"/.test(ahtml()));
ok('archive shows both shipped before range',ahtml().includes('Arh Mai')&&ahtml().includes('Arh Iulie'));
vm.runInContext("archiveFilter.from='2026-07-01';archiveFilter.to='2026-07-31';renderArchive();",ctx);
ok('archive interval keeps only Arh Iulie',ahtml().includes('Arh Iulie')&&!ahtml().includes('Arh Mai'));
ok('archive range disables year select',/id="arY" disabled/.test(ahtml()));
ok('archive range clear button present',/id="arRangeClear"/.test(ahtml()));

console.log('\nRESULT',pass,'passed,',fail,'failed');
process.exit(fail?1:0);
