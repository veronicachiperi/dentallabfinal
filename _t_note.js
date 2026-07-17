const fs=require('fs');const vm=require('vm');const {JSDOM}=require('jsdom');
const dir='/sessions/gallant-peaceful-faraday/mnt/MONDAY - LABORATORY SYSTEM/dental-lab/';
const dom=new JSDOM('<!DOCTYPE html><body><div id="doctorShell"></div></body>',{url:'http://localhost/doctor.html'});
const w=dom.window;
const ctx=vm.createContext({window:w,document:w.document,location:w.location,history:w.history,navigator:w.navigator,localStorage:w.localStorage,URLSearchParams:w.URLSearchParams,Blob:w.Blob,URL:w.URL,console,Date,Math,JSON,parseInt,parseFloat,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),alert:()=>{},confirm:()=>true,prompt:()=>''});
function load(f){vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx,{filename:f});}
load('js/data.js');load('js/app.js');
vm.runInContext(`
SUPABASE_CONFIGURED=false;
CLINICS.length=0;CLINICS.push({id:'CL1',name:'Clinica Alfa'});
CASES.length=0;
CASES.push({id:1,seq:1,name:'Urse Valentin',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'design',finala:'2026-09-10'});
window._syncCase=function(){};_syncCase=window._syncCase;
`,ctx);
let pass=0,fail=0;function ok(n,c){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n);}}

// ---- 1. Medicul scrie o notă ----
vm.runInContext('window.getCurrentUser=function(){return{role:"doctor",doctorName:"Dr. Alex Butnaru",name:"Alex Butnaru",initials:"AB"};};getCurrentUser=window.getCurrentUser;',ctx);
vm.runInContext('renderDoctor();',ctx);
// deschide modal notă și salvează
vm.runInContext(`
handleClinicAction('note',1);
document.getElementById('clinicNoteInput').value='Vă rog verificați culoarea A2';
document.getElementById('clinicNoteSave').click();
`,ctx);
const c=vm.runInContext('getCase(1)',ctx);
const notes=vm.runInContext('_parseNotes(getCase(1).notes)',ctx);
ok('nota salvată pe caz',notes.length===1);
ok('nota are textul corect',notes[0].text.includes('culoarea A2'));
ok('nota marcată cu rol doctor',notes[0].role==='doctor');
ok('nota are autor',notes[0].author==='Alex Butnaru');

// nota se vede în portalul medicului (contor)
ok('portal medic arată contor Notă (1)',/Not[ăa] \(1\)/.test(w.document.getElementById('doctorShell').innerHTML));

// ---- 2. Laboratorul (admin) primește notificare ----
vm.runInContext('window.getCurrentUser=function(){return{role:"admin",name:"Lab",initials:"LB"};};getCurrentUser=window.getCurrentUser;',ctx);
vm.runInContext('refreshDerivedNotifications();',ctx);
const noteNotifs=vm.runInContext('NOTIFICATIONS.filter(n=>n.kind==="Notă de la medic")',ctx);
ok('există notificare "Notă de la medic"',noteNotifs.length===1);
ok('notificarea trimite la cazul corect',noteNotifs[0]&&noteNotifs[0].caseId===1);
ok('notificarea e necitită',noteNotifs[0]&&noteNotifs[0].unread===true);
ok('notificarea conține numele pacientului',noteNotifs[0]&&noteNotifs[0].text.includes('Urse Valentin'));
// admin o vede
const vis=vm.runInContext('visibleNotificationsForCurrentUser().filter(n=>n.kind==="Notă de la medic")',ctx);
ok('admin vede notificarea',vis.length===1);

// ---- 3. Notă mai veche de 21 zile NU notifică ----
vm.runInContext(`
const old=_parseNotes(getCase(1).notes);
old.push({text:'nota veche',author:'Alex Butnaru',initials:'AB',role:'doctor',ts:Date.now()-30*86400000});
getCase(1).notes=JSON.stringify(old);
refreshDerivedNotifications();
`,ctx);
const after=vm.runInContext('NOTIFICATIONS.filter(n=>n.kind==="Notă de la medic")',ctx);
ok('nota veche (>21 zile) nu produce notificare',after.length===1);

console.log('\nRESULT',pass,'passed,',fail,'failed');
process.exit(fail?1:0);
