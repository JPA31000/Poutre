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
  p.windowResized = () => {
    const container = document.getElementById('diagrams-canvas-container');
    p.resizeCanvas(container.offsetWidth, 400);
    p.redraw();
  };
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
  p.windowResized = () => {
    const container = document.getElementById('section-canvas-container');
    p.resizeCanvas(container.offsetWidth, container.offsetHeight || 400);
    p.redraw();
  };
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
  let M_max_abs_Nmm, V_max_N, M_max_kNm;
  const q = values.qkN_m, L = values.L;
  switch (values.typePoutre) {
    case 'Simplement Appuyée':
      M_max_kNm = q * L * L / 8;
      V_max_N = q * L / 2 * 1000;
      break;
    case 'Encastrée-Libre (Cantilever)':
      M_max_kNm = q * L * L / 2;
      V_max_N = q * L * 1000;
      break;
    default: // Bi-Encastrée
      M_max_kNm = q * L * L / 12;
      V_max_N = q * L / 2 * 1000;
  }
  M_max_abs_Nmm = M_max_kNm * 1e6;
  const fcd = values.fck / 1.5, fyd = values.fyk / 1.15;
  const b_mm = values.b * 1000, h_mm = values.h * 1000, cover_mm = values.cover * 1000;
  const d_mm = h_mm - cover_mm - values.diam / 2;
  const As_prov_mm2 = values.nbBars * (Math.PI * values.diam * values.diam) / 4.0;
  const Md = M_max_abs_Nmm;
  let As_req_mm2 = Md / (fyd * 0.9 * d_mm);
  let x_mm = As_req_mm2 * fyd / (0.85 * fcd * b_mm);
  if (x_mm > 0.45 * d_mm) {
    x_mm = 0.45 * d_mm;
    As_req_mm2 = 0.85 * fcd * b_mm * x_mm / fyd;
  }
  const z_mm = d_mm - x_mm / 2;
  As_req_mm2 = Md / (fyd * z_mm);
  const flexionValide = As_prov_mm2 >= As_req_mm2;

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
  const { typePoutre, L, qkN_m } = data;

  p.clear();
  const margin = 50,
        diagramHeight = 100,
        beamY = margin + diagramHeight / 2,
        shearY = beamY + diagramHeight,
        momentY = shearY + diagramHeight + 20,
        beamStartX = margin,
        beamEndX = p.width - margin;

  const n = 50;
  const shear = [], moment = [];
  for (let i = 0; i <= n; i++) {
    const x = L * i / n;
    shear.push(calcShear(typePoutre, qkN_m, L, x));
    moment.push(calcMoment(typePoutre, qkN_m, L, x));
  }
  const maxV = Math.max(...shear.map(v => Math.abs(v)));
  const maxM = Math.max(...moment.map(m => Math.abs(m)));
  const shearScale = diagramHeight / maxV;
  const momentScale = diagramHeight / maxM;

  // Axe de la poutre
  p.stroke(0);
  p.line(beamStartX, beamY, beamEndX, beamY);

  // Diagramme de cisaillement
  p.noFill();
  p.stroke(50, 100, 200);
  p.beginShape();
  for (let i = 0; i <= n; i++) {
    const xpx = p.map(i, 0, n, beamStartX, beamEndX);
    const ypx = shearY - shear[i] * shearScale;
    p.vertex(xpx, ypx);
  }
  p.endShape();
  p.stroke(0); p.line(beamStartX, shearY, beamEndX, shearY);

  // Diagramme de moments
  p.noFill();
  p.stroke(200, 50, 50);
  p.beginShape();
  for (let i = 0; i <= n; i++) {
    const xpx = p.map(i, 0, n, beamStartX, beamEndX);
    const ypx = momentY - moment[i] * momentScale;
    p.vertex(xpx, ypx);
  }
  p.endShape();
  p.stroke(0); p.line(beamStartX, momentY, beamEndX, momentY);

  // Interactivité : lecture des valeurs au survol
  if (p.mouseY > shearY - diagramHeight / 2 && p.mouseY < shearY + diagramHeight / 2) {
    const xm = p.map(p.mouseX, beamStartX, beamEndX, 0, L, true);
    const Vx = calcShear(typePoutre, qkN_m, L, xm);
    p.stroke(255, 0, 0);
    p.line(p.mouseX, shearY - diagramHeight / 2, p.mouseX, shearY + diagramHeight / 2);
    p.fill(255); p.stroke(0); p.rect(p.mouseX + 5, p.mouseY - 25, 90, 20);
    p.fill(0); p.noStroke(); p.text(`V(x)=${Vx.toFixed(1)} kN`, p.mouseX + 10, p.mouseY - 15);
  }
  if (p.mouseY > momentY - diagramHeight / 2 && p.mouseY < momentY + diagramHeight / 2) {
    const xm = p.map(p.mouseX, beamStartX, beamEndX, 0, L, true);
    const Mx = calcMoment(typePoutre, qkN_m, L, xm);
    p.stroke(255, 0, 0);
    p.line(p.mouseX, momentY - diagramHeight / 2, p.mouseX, momentY + diagramHeight / 2);
    p.fill(255); p.stroke(0); p.rect(p.mouseX + 5, p.mouseY - 25, 100, 20);
    p.fill(0); p.noStroke(); p.text(`M(x)=${Mx.toFixed(1)} kN·m`, p.mouseX + 10, p.mouseY - 15);
  }
}

function calcShear(type, q, L, x) {
  switch (type) {
    case 'Simplement Appuyée':
      return q * (L / 2 - x);
    case 'Encastrée-Libre (Cantilever)':
      return q * (x - L);
    default:
      return q * (L / 2 - x); // Bi-Encastrée
  }
}

function calcMoment(type, q, L, x) {
  switch (type) {
    case 'Simplement Appuyée':
      return q * x * (L - x) / 2;
    case 'Encastrée-Libre (Cantilever)':
      return -q * x * x / 2;
    default:
      return q * x * (L - x) / 2 - q * L * L / 12; // Bi-Encastrée
  }
}

function dessinerSection(data) {
  const p = p5_section;
  const { b, h, cover, nbBars, diam, x_mm } = data;
  const b_mm = b * 1000, h_mm = h * 1000;
  const margin = 20;
  const scale = Math.min((p.width - 2 * margin) / b_mm, (p.height - 2 * margin) / h_mm);
  const b_px = b_mm * scale, h_px = h_mm * scale;
  const originX = (p.width - b_px) / 2;
  const originY = (p.height - h_px) / 2;

  p.clear();
  p.push();
  p.translate(originX, originY);
  p.fill(240); p.stroke(0);
  p.rect(0, 0, b_px, h_px);

  const cover_px = cover * 1000 * scale;
  const diam_px = diam * scale;
  const spacing = (b_px - 2 * cover_px - nbBars * diam_px) / Math.max(1, nbBars - 1);
  p.fill(200, 0, 0);
  for (let i = 0; i < nbBars; i++) {
    const cx = cover_px + diam_px / 2 + i * (diam_px + spacing);
    const cy = h_px - cover_px - diam_px / 2;
    p.circle(cx, cy, diam_px);
  }

  if (x_mm) {
    const yNeutral = x_mm * scale;
    p.stroke(0, 0, 255); p.line(0, yNeutral, b_px, yNeutral);
  }
  p.pop();
}

function drawPlaceholder(p, text) {
  p.background(240);
  p.textAlign(p.CENTER, p.CENTER);
  p.fill(160);
  p.noStroke();
  p.text(text, p.width / 2, p.height / 2);
}

function getValue(id) {
  return parseFloat(document.getElementById(id).value);
}

// --- Initialisation ---
new p5(sketchDiagrams);
new p5(sketchSection);
setupDOM();
