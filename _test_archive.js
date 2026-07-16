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
CASES.push({id:2,seq:2,name:'Pop Ion',doctor:'alex butnaru',clinic:'CL2',type:'ZR',stage:'terminat',finala:'2026-04-02'});
CASES.push({id:3,seq:3,name:'Alt Pacient',doctor:'Dr. Ionescu',clinic:'CL1',type:'ZR',stage:'trimis',finala:'2026-03-01',sentDate:'2026-03-02'});
CASES.push({id:4,seq:4,name:'Inca Unul',doctor:'Popescu Maria',clinic:'CL2',type:'ZR',stage:'terminat',finala:'2026-02-01'});
window.getCurrentUser=function(){return{role:'doctor',doctorName:'Dr. Alex Butnaru',name:'Alex Butnaru',initials:'AB'};};
getCurrentUser=window.getCurrentUser;
`,ctx);
function html(){return w.document.getElementById('archiveShell').innerHTML;}
let pass=0,fail=0;function ok(n,c){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n);}}

vm.runInContext('renderArchive();',ctx);
const h=html();
ok('archive title = Arhiva mea',/Arhiva mea/.test(h));
ok('shows own case Urse Valentin',h.includes('Urse Valentin'));
ok('shows own case Pop Ion (normalized name)',h.includes('Pop Ion'));
ok('HIDES other doctor case (Ionescu)',!h.includes('Alt Pacient'));
ok('HIDES other doctor case (Popescu)',!h.includes('Inca Unul'));
ok('export dropdown present',/data-export-id="arch"/.test(h));
ok('no technician filter for doctor',!/id="arT"/.test(h));
ok('clinic filter lists only doctor clinics (CL1+CL2 both used)',/value="CL1"/.test(h)&&/value="CL2"/.test(h));

console.log('\nRESULT',pass,'passed,',fail,'failed');
process.exit(fail?1:0);

// --- sidebar scope pentru medic ---
vm.runInContext('renderArchive();',ctx);
const sb=html();
ok('sidebar: are Portal',/href="doctor.html"[^]*Portal/.test(sb)||sb.includes('>Portal<'));
ok('sidebar: are Arhivă',/arhiva.html/.test(sb));
ok('sidebar: NU are Lucrări',!sb.includes('>Lucrări<'));
ok('sidebar: NU are Clinici',!sb.includes('>Clinici<'));
ok('sidebar: NU are WorkDrive',!sb.includes('WorkDrive'));
ok('sidebar: NU are Statistici',!sb.includes('Statistici'));
ok('sidebar: rol = Medic',sb.includes('Medic'));
console.log('\nSIDEBAR RESULT',pass,'passed,',fail,'failed');
