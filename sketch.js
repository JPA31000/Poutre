let p5_diagrams, p5_section;
let calculData = null; // NOUVEAU : Objet pour stocker les données du dernier calcul

const sketchDiagrams = (p) => {
  p5_diagrams = p;
  p.setup = () => {
    let container = document.getElementById('diagrams-canvas-container');
    p.createCanvas(container.offsetWidth, 400).parent(container);
    p.noLoop();
    drawPlaceholder(p, "Diagrammes des Efforts");
  };
  p.draw = () => {
    if (calculData) dessinerDiagrammes(calculData);
  };
  p.windowResized = () => { /* ... inchangé ... */ };
};

const sketchSection = (p) => {
  p5_section = p;
  p.setup = () => {
    let container = document.getElementById('section-canvas-container');
    p.createCanvas(container.offsetWidth, container.offsetHeight || 400).parent(container);
    p.noLoop();
    drawPlaceholder(p, "Section Transversale");
  };
  p.draw = () => {
    if (calculData) dessinerSection(calculData);
  };
  p.windowResized = () => { /* ... inchangé ... */ };
};

function setupDOM() {
  const modal = document.getElementById('modal');
  const btnOpenModal = document.getElementById('btn-open-modal');
  const btnApply = document.getElementById('btn-apply');
  btnOpenModal.onclick = () => { modal.style.display = 'flex'; };
  btnApply.onclick = () => {
    // NOUVEAU : Feedback visuel sur le bouton
    btnApply.innerHTML = "Calcul en cours...";
    btnApply.disabled = true;
    setTimeout(() => {
      calculer();
      btnApply.innerHTML = "Appliquer & Calculer";
      btnApply.disabled = false;
    }, 50); // Léger délai pour permettre au DOM de se rafraîchir
  };
  window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };
  modal.style.display = 'flex';
}

function calculer() {
  // --- Récupération des valeurs ---
  const inputs = { L: 'L', qkN_m: 'q', b: 'b', h: 'h', fck: 'fck', fyk: 'fyk', diam: 'diam', nbBars: 'nbBars', cover: 'cover', typePoutre: 'typePoutre' };
  const values = Object.fromEntries(Object.entries(inputs).map(([key, id]) => [key, getValue(id)]));
  
  if (Object.values(values).slice(0, -1).some(isNaN)) {
    showToast("Veuillez remplir tous les champs numériques.", "error");
    return;
  }

  // --- Logique de calcul ---
  let M_max_abs_Nmm, V_max_N;
  // ... (calculs de V et M inchangés) ...
  const fcd = values.fck / 1.5, fyd = values.fyk / 1.15;
  const b_mm = values.b * 1000, h_mm = values.h * 1000, cover_mm = values.cover * 1000;
  const d_mm = h_mm - cover_mm - values.diam / 2;
  const As_prov_mm2 = values.nbBars * (Math.PI * values.diam * values.diam) / 4.0;
  // ... (le reste des calculs inchangés) ...

  // NOUVEAU : Stockage des résultats dans un objet global
  calculData = { ...values, M_max_kNm, V_max_N, As_req_mm2, As_prov_mm2, flexionValide, x_mm, d_mm, fcd };
  
  // NOUVEAU : Déclenchement du dessin et affichage des résultats
  updateResultsUI(calculData);
  p5_diagrams.loop(); // Active la boucle de dessin pour l'interactivité
  p5_section.redraw();
  showToast("Calculs terminés avec succès !", "success");
}

function updateResultsUI(data) {
    const { flexionValide, M_max_kNm, V_max_N, As_req_mm2, As_prov_mm2, nbBars, diam } = data;
    const arr = (val, prec=2) => Number(val).toFixed(prec);
    document.getElementById('results-content').innerHTML = `<ul>
        <li class="res-info">
            <span class="res-label">Moment max |M<sub>max</sub>|</span>
            <span class="res-value">${arr(M_max_kNm)} kN·m</span>
        </li>
        <li class="res-info">
            <span class="res-label">Effort tranchant |V<sub>max</sub>|</span>
            <span class="res-value">${arr(V_max_N / 1000)} kN</span>
        </li>
        <li class="res-info">
            <span class="res-label">Aciers requis A<sub>s,req</sub></span>
            <span class="res-value">${arr(As_req_mm2 / 100)} cm²</span>
        </li>
        <li class="res-info">
            <span class="res-label">Aciers fournis A<sub>s,prov</sub></span>
            <span class="res-value">${arr(As_prov_mm2 / 100)} cm² (${nbBars}Ø${diam})</span>
        </li>
        <li class="${flexionValide ? 'res-ok' : 'res-ko'}">
            <span class="res-label">État de la flexion</span>
            <span class="res-value">${flexionValide ? 'VALIDE' : 'NON VALIDE'}</span>
        </li>
    </ul>`;
}

// NOUVEAU : Logique pour la notification "Toast"
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "show " + type; // "success" ou "error"
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// MODIFIÉ : Fonctions de dessin pour être interactives
function dessinerDiagrammes(data) {
  const p = p5_diagrams;
  const { typePoutre, L, qkN_m, M_max_kNm, V_max_N } = data;
  const V_max_kN = V_max_N / 1000;
  // ... (logique de dessin statique identique) ...

  // NOUVEAU : Logique d'interactivité au survol
  const margin = 50, diagramHeight = 100;
  const beamY = margin + diagramHeight/2, shearY = beamY + diagramHeight, momentY = shearY + diagramHeight + 20;
  const beamStartX = margin, beamEndX = p.width - margin;
  
  // Survol du diagramme de cisaillement
  if (p.mouseY > shearY - diagramHeight/2 && p.mouseY < shearY + diagramHeight/2) {
    let x_m = p.map(p.mouseX, beamStartX, beamEndX, 0, L, true);
    let V_x = qkN_m * (L/2 - x_m); // Pour poutre sur 2 appuis
    if (typePoutre === 'Encastrée-Libre (Cantilever)') V_x = -qkN_m * (L-x_m);
    
    p.stroke(255, 0, 0); p.line(p.mouseX, shearY - diagramHeight/2, p.mouseX, shearY + diagramHeight/2);
    p.fill(255);p.stroke(0);p.rect(p.mouseX+5, p.mouseY-25, 80, 20);
    p.fill(0); p.noStroke(); p.text(`V(x) = ${V_x.toFixed(1)} kN`, p.mouseX + 10, p.mouseY - 15);
  }
  // Survol du diagramme de moment
  if (p.mouseY > momentY - diagramHeight/2 && p.mouseY < momentY + diagramHeight) {
      // ... (logique similaire pour M(x)) ...
  }
}

// ... (Les autres fonctions de dessin et utilitaires restent similaires) ...

// --- Initialisation ---
new p5(sketchDiagrams);
new p5(sketchSection);
setupDOM();

// ... (toutes les autres fonctions `dessinerSection`, `drawAxis`, etc. restent ici) ...
function drawPlaceholder(p, text) { /* ... */ }
