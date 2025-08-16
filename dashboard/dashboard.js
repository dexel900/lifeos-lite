// Dashboard <-> Notes umschalten
const navOverview = document.getElementById('navOverview');
const navNotes    = document.getElementById('navNotes');
const openNotesTile = document.getElementById('openNotesTile');

const topTitle    = document.getElementById('topTitle');
const viewOverview= document.getElementById('viewOverview');
const viewNotes   = document.getElementById('viewNotes');

function setActiveNav(btn){
  document.querySelectorAll('.nav .nav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function showOverview(){
  topTitle.textContent = 'Dashboard';
  viewOverview.classList.remove('hidden');
  viewNotes.classList.add('hidden');
  setActiveNav(navOverview);
}

function showNotes(){
  topTitle.textContent = 'Notizen';
  viewOverview.classList.add('hidden');
  viewNotes.classList.remove('hidden');
  setActiveNav(navNotes);
}

navOverview.addEventListener('click', showOverview);
navNotes.addEventListener('click', showNotes);
openNotesTile.addEventListener('click', showNotes);

// Start
showOverview();
