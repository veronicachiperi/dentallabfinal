const fs=require('fs');const vm=require('vm');const {JSDOM}=require('jsdom');
const dir='/sessions/gallant-peaceful-faraday/mnt/MONDAY - LABORATORY SYSTEM/dental-lab/';
const dom=new JSDOM('<!DOCTYPE html><body><div id="archiveShell"></div></body>',{url:'http://localhost/arhiva.html'});
const w=dom.window;
const ctx=vm.createContext({window:w,document:w.document,location:w.location,history:w.history,navigator:w.navigator,localStorage:w.localStorage,URLSearchParams:w.URLSearchParams,Blob:w.Blob,URL:w.URL,console,Date,Math,JSON,parseInt,parseFloat,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),alert:()=>{},confirm:()=>true,prompt:()=>''});
function load(f){vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx,{filename:f});}
load('js/data.js');load('js/app.js');
vm.runInContext(`
CLINICS.length=0;CLINICS.push({id:'CL1',name:'Clinica Alfa'},{id:'CL2',name:'Clinica Beta'});
CASES.length=0;
CASES.push({id:1,seq:1,name:'Urse Valentin',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'trimis',finala:'2026-05-10',sentDate:'2026-05-11'});
CASES.push({id:2,seq:2,name:'Pop Ion',doctor:'alex butnaru',clinic:'CL2',type:'ZR',stage:'terminat',finala:'2026-04-02',completedDate:'2026-04-02'});
CASES.push({id:5,seq:5,name:'Mos Ana',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'terminat',finala:'2026-01-15',completedDate:'2026-01-15'});
window.getCurrentUser=function(){return{role:'doctor',doctorName:'Dr. Alex Butnaru',name:'Alex Butnaru',initials:'AB'};};
getCurrentUser=window.getCurrentUser;
`,ctx);
function html(){return w.document.getElementById('archiveShell').innerHTML;}
let pass=0,fail=0;function ok(n,c){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n);}}

// baseline: doctor sees all 3 own cases
vm.runInContext('archiveFilter.clinic="all";archiveFilter.from="";archiveFilter.to="";archiveFilter.year=String(new Date().getFullYear());archiveFilter.month="all";renderArchive();',ctx);
let h=html();
ok('doctor baseline shows CL1 case Urse',h.includes('Urse Valentin'));
ok('doctor baseline shows CL2 case Pop',h.includes('Pop Ion'));

// CLINIC FILTER for doctor -> only CL1
vm.runInContext('archiveFilter.clinic="CL2";renderArchive();',ctx);
h=html();
ok('doctor clinic=CL2 hides CL1 Urse',!h.includes('Urse Valentin'));
ok('doctor clinic=CL2 shows CL2 Pop',h.includes('Pop Ion'));

// INTERVAL for doctor: from 2026-04-01 to 2026-06-01 -> excludes Jan case
vm.runInContext('archiveFilter.clinic="all";archiveFilter.from="2026-04-01";archiveFilter.to="2026-06-01";renderArchive();',ctx);
h=html();
ok('interval excludes Jan case Mos Ana',!h.includes('Mos Ana'));
ok('interval includes May Urse',h.includes('Urse Valentin'));
ok('interval includes Apr Pop',h.includes('Pop Ion'));

console.log('\nRESULT',pass,'passed,',fail,'failed');
