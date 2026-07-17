const fs=require('fs');const vm=require('vm');const {JSDOM}=require('jsdom');
const dir='/sessions/gallant-peaceful-faraday/mnt/MONDAY - LABORATORY SYSTEM/dental-lab/';
const dom=new JSDOM('<!DOCTYPE html><body><div id="doctorShell"></div><div id="modalRoot"></div></body>',{url:'http://localhost/doctor.html'});
const w=dom.window;
const ctx=vm.createContext({window:w,document:w.document,location:w.location,history:w.history,navigator:w.navigator,localStorage:w.localStorage,URLSearchParams:w.URLSearchParams,Blob:w.Blob,URL:w.URL,console,Date,Math,JSON,parseInt,parseFloat,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),alert:m=>console.log('ALERT',m),confirm:()=>true,prompt:()=>''});
function load(f){vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx,{filename:f});}
load('js/data.js');load('js/app.js');
vm.runInContext(`
SUPABASE_CONFIGURED=false;
CLINICS.length=0;CLINICS.push({id:'CL1',name:'Clinica Alfa'},{id:'CL2',name:'Clinica Beta'},{id:'CL3',name:'Clinica Gama'});
CASES.length=0;
CASES.push({id:1,seq:1,name:'Urse Valentin',doctor:'Dr. Alex Butnaru',clinic:'CL1',type:'ZR',stage:'design',finala:'2026-08-10'});
CASES.push({id:2,seq:2,name:'Pop Ion',doctor:'Dr. Alex Butnaru',clinic:'CL2',type:'ZR',stage:'design',finala:'2026-08-12'});
window.getCurrentUser=function(){return{role:'doctor',doctorName:'Dr. Alex Butnaru',name:'Alex Butnaru',initials:'AB'};};
getCurrentUser=window.getCurrentUser;
window.persistNewCase=function(){};persistNewCase=window.persistNewCase;
`,ctx);
let pass=0,fail=0;function ok(n,c){if(c){pass++;console.log('PASS',n);}else{fail++;console.log('FAIL',n);}}
const H=()=>w.document.body.innerHTML;

vm.runInContext('renderDoctor();',ctx);
ok('portal medic are buton + Caz nou',/id="doctorNewCaseBtn"/.test(H()));

// deschide modalul de creare ca medic
vm.runInContext('openNewCaseModal(null,"Dr. Alex Butnaru");',ctx);
const mh=H();
ok('modal: câmp Medic precompletat cu numele medicului',/id="ncDoctor"[^>]*value="Dr. Alex Butnaru"/.test(mh));
ok('modal: câmp Medic blocat (disabled)',/id="ncDoctor"[^>]*disabled/.test(mh));
ok('modal: clinicile limitate la CL1 si CL2',/value="CL1"/.test(mh)&&/value="CL2"/.test(mh));
ok('modal: NU arata CL3 (medicul nu are lucrari acolo)',!/value="CL3"/.test(mh));

// completeaza numele pacientului si salveaza
vm.runInContext(`
document.getElementById('ncLast').value='Test';
document.getElementById('ncFirst').value='Pacient';
document.getElementById('ncClinic').value='CL2';
document.getElementById('ncSave').click();
`,ctx);
// asincron nu e necesar: fara supabase, persistNewCase e sincron
setTimeout(()=>{
  const added=vm.runInContext('CASES.find(c=>c.name==="Test Pacient")',ctx);
  ok('caz nou adaugat in CASES',!!added);
  ok('caz nou are medicul corect',added&&added.doctor==='Dr. Alex Butnaru');
  ok('caz nou are clinica aleasa CL2',added&&added.clinic==='CL2');
  ok('caz nou stage=design (neinceput)',added&&added.stage==='design');
  // apare in portalul medicului
  vm.runInContext('renderDoctor();',ctx);
  ok('cazul nou apare in portal',/Test Pacient/.test(w.document.getElementById('doctorShell').innerHTML));
  // marcaj creator
  ok('caz nou marcat createdByRole=doctor',added&&added.createdByRole==='doctor');
  ok('caz nou are createdTs',added&&!!added.createdTs);
  // laboratorul primeste notificare "Caz nou de la medic"
  vm.runInContext('window.getCurrentUser=function(){return{role:"admin",name:"Lab",initials:"LB"};};getCurrentUser=window.getCurrentUser;refreshDerivedNotifications();',ctx);
  const nc=vm.runInContext('NOTIFICATIONS.filter(n=>n.kind==="Caz nou de la medic")',ctx);
  ok('exista notificare "Caz nou de la medic"',nc.length===1);
  ok('notificarea trimite la cazul nou',nc[0]&&nc[0].caseId===added.id);
  ok('notificarea necitita',nc[0]&&nc[0].unread===true);
  ok('notificarea contine numele pacientului',nc[0]&&nc[0].text.includes('Test Pacient'));
  console.log('\nRESULT',pass,'passed,',fail,'failed');
  process.exit(fail?1:0);
},50);
