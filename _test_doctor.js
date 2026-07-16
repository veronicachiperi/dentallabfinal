const fs=require('fs');const vm=require('vm');const {JSDOM}=require('jsdom');
const dir='/sessions/gallant-peaceful-faraday/mnt/MONDAY - LABORATORY SYSTEM/dental-lab/';
const dom=new JSDOM('<!DOCTYPE html><body><div id="doctorShell"></div></body>',{url:'http://localhost/doctor.html'});
const w=dom.window;
const ctx=vm.createContext({window:w,document:w.document,location:w.location,history:w.history,navigator:w.navigator,localStorage:w.localStorage,URLSearchParams:w.URLSearchParams,Blob:w.Blob,URL:w.URL,console,Date,Math,JSON,parseInt,parseFloat,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),alert:()=>{},confirm:()=>true,prompt:()=>''});
function load(f){vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx,{filename:f});}
load('js/data.js');load('js/app.js');
vm.runInContext(`
CLINICS.length=0;CLINICS.push({id:'CL1',name:'Clinica Alfa'},{id:'CL2',name:'Clinica Beta'});
CASES.length=0;
CASES.push({id:1,seq:301,name:'Urse Valentin',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'PROVIZORIE',stage:'design',notStarted:true,finala:'2026-07-20'});
CASES.push({id:2,seq:304,name:'Gheorghiu Carmen',doctor:'dr alex butnaru',clinic:'CL2',type:'ZR FULL IMPL',stage:'cam',finala:'2026-07-20 11:00'});
CASES.push({id:3,seq:290,name:'Pop Ion',doctor:'Alex Butnaru',clinic:'CL1',type:'ZR',stage:'trimis',finala:'2026-06-10',sentDate:'2026-06-11'});
CASES.push({id:4,seq:291,name:'Ana Maria',doctor:'Alex Butnaru',clinic:'CL2',type:'ZR',stage:'trimis',finala:'2026-07-05',sentDate:'2026-07-06'});
CASES.push({id:9,seq:999,name:'Altul',doctor:'Dr. Ionescu',clinic:'CL1',type:'ZR',stage:'cam',finala:'2026-07-20'});
window.getCurrentUser=function(){return{role:'doctor',doctorName:'Dr. Alex Butnaru',name:'Alex Butnaru',initials:'AB'};};
getCurrentUser=window.getCurrentUser;
`,ctx);
function q(sel){return w.document.querySelectorAll(sel);}
function html(){return w.document.getElementById('doctorShell').innerHTML;}
let pass=0,fail=0;function ok(n,c){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n);}}

vm.runInContext('renderDoctor();',ctx);
ok('clinic sub-line present',/pc-row-clinic/.test(html()));
ok('shows Clinica Alfa under name',html().includes('Clinica Alfa'));
ok('note-strong button present',/note-strong/.test(html()));
ok('Data finala button present',html().includes('Dată finală'));
ok('only doctor cases (2 active rows)',q('.pc-row-grid[data-case-id]').length===2);
ok('no other-doctor case (#999)',!html().includes('#999'));

vm.runInContext("history.replaceState({},'','doctor.html?view=shipped');renderDoctor();",ctx);
ok('export bar present in shipped',/docShipExport/.test(html()));
ok('clinic filter has both clinics',/CL1/.test(html())&&/CL2/.test(html()));
ok('2 shipped rows before filter',q('.pc-row-grid[data-case-id]').length===2);

vm.runInContext("doctorShipFilter={from:'2026-07-01',to:'2026-07-31',clinic:'all'};renderDoctor();",ctx);
ok('date filter keeps 1 row',q('.pc-row-grid[data-case-id]').length===1);
ok('date filter kept #291',html().includes('#291'));

vm.runInContext("doctorShipFilter={from:'',to:'',clinic:'CL1'};renderDoctor();",ctx);
ok('clinic filter keeps only CL1 shipped (#290)',q('.pc-row-grid[data-case-id]').length===1 && html().includes('#290'));

vm.runInContext("doctorShipFilter={from:'',to:'',clinic:'all'};history.replaceState({},'','doctor.html?view=active');renderDoctor();openDoctorFinalaEdit(2);",ctx);
const dInput=w.document.getElementById('docFinDate');
ok('finala modal date input rendered',!!dInput);
ok('finala modal date value preset',dInput&&dInput.getAttribute('value')==='2026-07-20');
const tInput=w.document.getElementById('docFinTime');
ok('finala modal time value preset',tInput&&tInput.getAttribute('value')==='11:00');
if(dInput){dInput.value='2026-07-25';}
if(tInput){tInput.value='09:30';}
vm.runInContext("document.getElementById('docFinSave').click();",ctx);
const c2=vm.runInContext("getCase(2).finala",ctx);
ok('finala updated to 2026-07-25 09:30',c2==='2026-07-25 09:30');

console.log('\nRESULT',pass,'passed,',fail,'failed');
process.exit(fail?1:0);
