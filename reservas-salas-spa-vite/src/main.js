// ===============================
// 0) CARGA DE ESTILOS (Vite)
// - Esto importa el CSS para que se aplique a la SPA.
// - Vite lo procesa y lo inyecta en la página.
// ===============================
import "./style.css";

// ===============================
// 1) UTILIDADES BÁSICAS
// $: atajo para document.querySelector
// LS_KEY: llave única para guardar/leer en localStorage
// todayISO: fecha actual en formato YYYY-MM-DD (ideal para <input type="date">)
// ===============================
const $ = (sel) => document.querySelector(sel);
const LS_KEY = "control_docentes_salas_bloques_v1";
const todayISO = () => new Date().toISOString().slice(0, 10);

// -------------------- Config --------------------
// ===============================
// 2) CONFIGURACIÓN (CATÁLOGOS)
// Aquí definimos "datos base" del sistema:
// - bloques horarios disponibles
// - edificios y sus salas
// - docentes de ejemplo
//
// Importante: estos arrays suelen ser "constantes" del sistema.
// Luego podrías cargarlos desde API o BD (Full Stack).
// ===============================
const bloques = [
  { id: "06-08", label: "06:00–08:00" },
  { id: "08-10", label: "08:00–10:00" },
  { id: "10-12", label: "10:00–12:00" },
  { id: "14-16", label: "14:00–16:00" },
  { id: "16-18", label: "16:00–18:00" },
  { id: "18-20", label: "18:00–20:00" },
];

const edificios = [
  { id: "GB", nombre: "Giordano Bruno", salas: ["1E","2E","3E","4E"] },
  { id: "SD", nombre: "Santo Domingo",  salas: ["1F","2F","3F","4F"] },
];

const docentes = [
  "Jeimy Rodríguez",
  "Luz Álvarez",
  "Sergio Puerto",
  "Carlos Pérez",
  "Diana López",
];

// ===============================
// 3) RENDER DE ESTADO (PILLS)
// pillEstado convierte un "código de estado" en HTML visual.
// - EN_SALA  -> verde
// - EN_PAUSA -> amarillo
// - NO_LLEGO -> rojo
// - vacío/otro -> neutro
//
// Esto hace que la vista sea fácil de leer (UX).
// ===============================
function pillEstado(st){
  if (st === "EN_SALA") return `<span class="pill ok">En sala</span>`;
  if (st === "EN_PAUSA") return `<span class="pill warn">En pausa</span>`;
  if (st === "NO_LLEGO") return `<span class="pill danger">No llegó</span>`;
  return `<span class="pill">—</span>`;
}

// -------------------- Estado + persistencia --------------------
// ===============================
// 4) ESTADO GLOBAL DE LA APP (STATE)
// state tiene dos grandes partes:
//
// A) state.ui
//    - controla la selección actual: fecha, bloque, edificio, sala
//    - es como "los filtros" que usa el usuario
//
// B) state.data
//    - es la "base de datos local" (en memoria)
//    - estructura:
//      data[fecha][bloque][edificio][sala] = { docente, estado, nota, actualizado }
//
// Cuando la app inicia:
// - intenta load() desde localStorage
// - si no existe nada, usa el objeto por defecto.
// ===============================
const state = load() ?? {
  ui: {
    fecha: todayISO(),
    bloque: bloques[0].id,
    edificio: "GB",
    sala: "1E",
  },
  // data[fecha][bloque][edificio][sala] = { docente, estado, nota, actualizado }
  data: {}
};

// ===============================
// 5) PERSISTENCIA (localStorage)
// load(): lee desde localStorage (si hay algo) y lo parsea JSON
// save(): guarda el state completo como JSON
//
// try/catch: evita que la app se rompa si el JSON está dañado.
// ===============================
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ===============================
// 6) NORMALIZACIÓN DE ESTRUCTURA (ensureSlot)
// Objetivo: garantizar que la ruta
// data[fecha][bloque][edificio][sala] exista.
// Si no existe, crea los objetos intermedios.
//
// ¿Por qué es clave?
// Porque al renderizar o guardar, no queremos errores tipo:
// "Cannot read properties of undefined".
// ===============================
function ensureSlot(fecha, bloqueId, edificioId, sala){
  if (!state.data[fecha]) state.data[fecha] = {};
  if (!state.data[fecha][bloqueId]) state.data[fecha][bloqueId] = {};
  if (!state.data[fecha][bloqueId][edificioId]) state.data[fecha][bloqueId][edificioId] = {};
  if (!state.data[fecha][bloqueId][edificioId][sala]) {
    state.data[fecha][bloqueId][edificioId][sala] = {
      docente: "",
      estado: "",
      nota: "",
      actualizado: ""
    };
  }
}

// ===============================
// 7) LECTURA DE REGISTRO SELECCIONADO (getSlot)
// Usa lo que está seleccionado en UI (fecha/bloque/edificio/sala),
// asegura que exista el slot y retorna el objeto.
// ===============================
function getSlot(){
  const { fecha, bloque, edificio, sala } = state.ui;
  ensureSlot(fecha, bloque, edificio, sala);
  return state.data[fecha][bloque][edificio][sala];
}

// -------------------- UI helpers --------------------
// ===============================
// 8) ACTIVAR MENÚ (SPA)
// Con base en el hash (#/tablero o #/gestion), marca el link activo.
// Esto es solo visual, el router es el que decide la vista.
// ===============================
function setActiveNav(){
  const hash = location.hash || "#/tablero";
  document.querySelectorAll(".nav a").forEach(a=>{
    a.classList.toggle("active", hash.startsWith(a.getAttribute("href")));
  });
}

// ===============================
// 9) escapeHtml (SEGURIDAD / UI)
// Evita que un texto (nota/docente) rompa el HTML o inyecte etiquetas.
// Es buena práctica cuando insertas strings dentro de innerHTML.
// ===============================
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===============================
// 10) UI DE CONTROLES SUPERIORES
// Devuelve un HTML (string) con:
// - selector de fecha
// - selector de bloque horario
// - selector de edificio
// - selector de sala
// - botones: exportar CSV / limpiar sala
//
// NOTA:
// - Esto se "inyecta" en tablero y en gestión.
// - Luego hay que "conectar" los eventos: wireHeaderControls().
// ===============================
function headerControlsHTML(){
  const ed = edificios.find(e => e.id === state.ui.edificio) ?? edificios[0];

  return `
    <div class="grid" style="margin:12px 0">
      <div>
        <div class="h2">Fecha</div>
        <input id="fechaSel" class="input" type="date" value="${state.ui.fecha}" />

        <div style="margin-top:10px">
          <div class="h2">Bloque horario</div>
          <select id="bloqueSel">
            ${bloques.map(b => `<option value="${b.id}" ${b.id===state.ui.bloque?"selected":""}>${b.label}</option>`).join("")}
          </select>
        </div>

        <p class="small">Todo se guarda por fecha + bloque + sala.</p>
      </div>

      <div>
        <div class="h2">Edificio</div>
        <select id="edSel">
          ${edificios.map(e => `
            <option value="${e.id}" ${e.id===state.ui.edificio?"selected":""}>
              ${e.nombre}
            </option>
          `).join("")}
        </select>

        <div style="margin-top:10px">
          <div class="h2">Sala</div>
          <select id="salaSel">
            ${ed.salas.map(s => `<option value="${s}" ${s===state.ui.sala?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>

        <div class="row" style="margin-top:10px">
          <button class="btn" id="exportBtn">Exportar CSV (bloque)</button>
          <button class="btn danger" id="clearSalaBtn">Limpiar sala</button>
        </div>
      </div>
    </div>
  `;
}

// ===============================
// 11) CONEXIÓN DE EVENTOS DE CONTROLES (WIRING)
// IMPORTANTE:
// - Como usamos innerHTML, cada render destruye y crea DOM nuevo.
// - Por eso: después de renderizar, hay que re-asignar eventos.
// - Por eso se llama wireHeaderControls() dentro de viewTablero/viewGestion.
//
// Flujo típico en cada evento:
// 1) actualizar state.ui o state.data
// 2) save()
// 3) router() para re-renderizar vista actual
// ===============================
function wireHeaderControls(){
  $("#fechaSel").onchange = (e) => { state.ui.fecha = e.target.value || todayISO(); save(); router(); };
  $("#bloqueSel").onchange = (e) => { state.ui.bloque = e.target.value; save(); router(); };

  $("#edSel").onchange = (e) => {
    state.ui.edificio = e.target.value;
    // Cuando cambia edificio, se fuerza la primera sala disponible (para evitar sala inválida)
    const ed = edificios.find(x => x.id === state.ui.edificio) ?? edificios[0];
    state.ui.sala = ed.salas[0];
    save(); router();
  };

  $("#salaSel").onchange = (e) => { state.ui.sala = e.target.value; save(); router(); };

  $("#exportBtn").onclick = exportCSVBlock;

  $("#clearSalaBtn").onclick = () => {
    const { fecha, bloque, edificio, sala } = state.ui;
    ensureSlot(fecha, bloque, edificio, sala);
    // "reset" del registro de esa sala en ese bloque/fecha
    state.data[fecha][bloque][edificio][sala] = { docente:"", estado:"", nota:"", actualizado:"" };
    save(); router();
  };
}

// ===============================
// 12) EXPORTAR CSV (DEL BLOQUE)
// Recorre:
// - edificios -> salas
// y genera un CSV con todos los registros del bloque actual.
//
// Reglas:
// - Siempre se asegura el slot (ensureSlot) para que exista.
// - Crea un Blob + link temporal para descargar.
// ===============================
function exportCSVBlock(){
  const fecha = state.ui.fecha;
  const bloqueId = state.ui.bloque;
  const bloqueLabel = (bloques.find(b=>b.id===bloqueId)?.label) ?? bloqueId;

  const rows = [["fecha","bloque","edificio","sala","docente","estado","nota","actualizado"]];
  for (const ed of edificios){
    for (const sala of ed.salas){
      ensureSlot(fecha, bloqueId, ed.id, sala);
      const slot = state.data[fecha][bloqueId][ed.id][sala];
      rows.push([
        fecha,
        bloqueLabel,
        ed.nombre,
        sala,
        slot.docente ?? "",
        slot.estado ?? "",
        slot.nota ?? "",
        slot.actualizado ?? ""
      ]);
    }
  }

  const csv = rows
    .map(r => r.map(cell => `"${String(cell ?? "").replaceAll('"','""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `control_docentes_${fecha}_${bloqueId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------- Resumen por edificio --------------------
// ===============================
// 13) RESUMEN POR EDIFICIO
// Cuenta cuántas salas están:
// - EN_SALA, EN_PAUSA, NO_LLEGO, SIN_ASIGNAR
//
// "Sin asignar" se considera cuando:
// - no hay docente y no hay estado
// o cuando no se reconoce el estado.
// ===============================
function buildingSummaryHTML(ed, fecha, bloqueId){
  let enSala = 0, enPausa = 0, noLlego = 0, sinAsignar = 0;

  for (const sala of ed.salas){
    ensureSlot(fecha, bloqueId, ed.id, sala);
    const slot = state.data[fecha][bloqueId][ed.id][sala];

    const hasDoc = !!(slot.docente && slot.docente.trim());
    const st = slot.estado;

    if (!hasDoc && !st) {
      sinAsignar++;
      continue;
    }

    if (st === "EN_SALA") enSala++;
    else if (st === "EN_PAUSA") enPausa++;
    else if (st === "NO_LLEGO") noLlego++;
    else sinAsignar++; // si hay docente pero sin estado o estado vacío
  }

  return `
    <div class="row" style="margin:6px 0 10px">
      <span class="pill ok">En sala: ${enSala}</span>
      <span class="pill warn">En pausa: ${enPausa}</span>
      <span class="pill danger">No llegó: ${noLlego}</span>
      <span class="pill">Sin asignar: ${sinAsignar}</span>
    </div>
  `;
}

// -------------------- Vistas --------------------
// ===============================
// 14) VISTA: TABLERO
// - Renderiza todas las salas de ambos edificios
// - Muestra resumen por edificio
// - Cada fila tiene data-pick="ED|SALA" para poder "abrir" esa sala en Gestión
//
// Flujo:
// viewTablero() -> pinta HTML -> wireHeaderControls() -> asigna click a filas
// ===============================
function viewTablero(){
  const { fecha, bloque } = state.ui;

  $("#app").innerHTML = `
    <h1 class="h1">Tablero</h1>
    <p class="small">
      Vista rápida por salas para el bloque seleccionado.
      Incluye resumen por edificio (útil para coordinación).
      Clic en una sala para editar en Gestión.
    </p>

    ${headerControlsHTML()}

    <div class="grid">
      ${edificios.map(ed => `
        <div>
          <div class="h2">${ed.nombre}</div>
          ${buildingSummaryHTML(ed, fecha, bloque)}
          <table class="table">
            <thead>
              <tr><th>Sala</th><th>Docente</th><th>Estado</th></tr>
            </thead>
            <tbody>
              ${ed.salas.map(sala => {
                ensureSlot(fecha, bloque, ed.id, sala);
                const slot = state.data[fecha][bloque][ed.id][sala];
                return `
                  <tr style="cursor:pointer" data-pick="${ed.id}|${sala}">
                    <td><strong>${sala}</strong></td>
                    <td>${escapeHtml(slot.docente || "—")}</td>
                    <td>${pillEstado(slot.estado)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `).join("")}
    </div>
  `;

  wireHeaderControls();

  // Click en fila -> set de UI -> ir a gestión
  document.querySelectorAll("[data-pick]").forEach(tr=>{
    tr.onclick = () => {
      const [edId, sala] = tr.getAttribute("data-pick").split("|");
      state.ui.edificio = edId;
      state.ui.sala = sala;
      save();
      location.hash = "#/gestion";
    };
  });
}

// ===============================
// 15) VISTA: GESTIÓN
// - Edita SOLO una sala (la seleccionada en UI)
// - Permite escoger docente, estado, nota
// - Guarda en state.data y en localStorage
//
// Flujo al guardar:
// click Guardar -> getSlot() -> set valores -> actualizado -> save() -> re-render
// ===============================
function viewGestion(){
  const slot = getSlot();
  const { fecha, bloque, edificio, sala } = state.ui;

  const ed = edificios.find(e => e.id === edificio);
  const bloqueLabel = (bloques.find(b=>b.id===bloque)?.label) ?? bloque;

  $("#app").innerHTML = `
    <h1 class="h1">Gestión</h1>
    <p class="small">
      Editar: <strong>${ed?.nombre ?? edificio}</strong> — <strong>${sala}</strong><br/>
      Fecha: <strong>${fecha}</strong> · Bloque: <strong>${bloqueLabel}</strong>
    </p>

    ${headerControlsHTML()}

    <div class="grid">
      <div>
        <div class="h2">Docente</div>
        <select id="docenteSel">
          <option value="">— Seleccionar —</option>
          ${docentes.map(d => `<option value="${escapeHtml(d)}" ${d===slot.docente?"selected":""}>${escapeHtml(d)}</option>`).join("")}
        </select>

        <div style="margin-top:10px">
          <div class="h2">Estado</div>
          <select id="estadoSel">
            <option value="">— Seleccionar —</option>
            <option value="EN_SALA" ${slot.estado==="EN_SALA"?"selected":""}>En sala</option>
            <option value="EN_PAUSA" ${slot.estado==="EN_PAUSA"?"selected":""}>En pausa</option>
            <option value="NO_LLEGO" ${slot.estado==="NO_LLEGO"?"selected":""}>No llegó</option>
          </select>
        </div>

        <div style="margin-top:10px">
          <div class="h2">Nota (opcional)</div>
          <input id="notaInp" class="input" placeholder="Ej: Cambio de salón / Llegó tarde..." value="${escapeHtml(slot.nota)}" />
        </div>

        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="guardarBtn">Guardar</button>
          <button class="btn" id="verTablero">Volver al tablero</button>
        </div>

        <p id="msg" class="small"></p>
      </div>

      <div>
        <div class="h2">Vista previa</div>
        <div class="small">
          <p><strong>Docente:</strong> ${escapeHtml(slot.docente || "—")}</p>
          <p><strong>Estado:</strong> ${pillEstado(slot.estado)}</p>
          <p><strong>Nota:</strong> ${escapeHtml(slot.nota || "—")}</p>
          <p><strong>Actualizado:</strong> ${escapeHtml(slot.actualizado || "—")}</p>
        </div>

        <div style="margin-top:10px">
          <div class="h2">Acciones</div>
          <div class="row">
            <button class="btn danger" id="vaciarBtn">Vaciar registro</button>
          </div>
        </div>
      </div>
    </div>
  `;

  wireHeaderControls();

  $("#verTablero").onclick = () => (location.hash = "#/tablero");

  $("#guardarBtn").onclick = () => {
    const slot = getSlot();
    slot.docente = $("#docenteSel").value;
    slot.estado = $("#estadoSel").value;
    slot.nota = $("#notaInp").value.trim();
    slot.actualizado = new Date().toLocaleString();
    save();
    $("#msg").textContent = "Guardado ✅";
    viewGestion(); // re-render para actualizar vista previa
  };

  $("#vaciarBtn").onclick = () => {
    const slot = getSlot();
    slot.docente = ""; slot.estado = ""; slot.nota = ""; slot.actualizado = "";
    save();
    viewGestion();
  };
}

// -------------------- Router --------------------
// ===============================
// 16) ROUTER SPA (HASH ROUTING)
// router() decide qué vista mostrar dependiendo del hash:
//
// #/tablero -> viewTablero()
// #/gestion -> viewGestion()
//
// Además:
// - setActiveNav() marca el link activo
// - Si la ruta no existe, muestra "Ruta no encontrada"
// ===============================
function router(){
  setActiveNav();
  const hash = location.hash || "#/tablero";

  if (hash === "#/tablero") return viewTablero();
  if (hash === "#/gestion") return viewGestion();

  $("#app").innerHTML = `<h1 class="h1">Ruta no encontrada</h1><p class="small">${escapeHtml(hash)}</p>`;
}

// ===============================
// 17) EVENTOS GLOBALES DEL NAVEGADOR
// - hashchange: cuando cambias #/tablero a #/gestion (sin recargar)
// - load: al cargar la página, define ruta por defecto y renderiza
//
// Este es el "motor SPA":
// cambia el hash -> llama router -> renderiza una vista en #app.
// ===============================
window.addEventListener("hashchange", router);
window.addEventListener("load", () => {
  if (!location.hash) location.hash = "#/tablero";
  router();
});
