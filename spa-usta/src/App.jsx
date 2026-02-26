import { useEffect, useMemo, useState } from "react";

/* =========================================================
   Actividad No.4
   Módulo de reserva de lockers por Sede - Edificio - Piso
   + Backup: exportar/importar lockers y reservas en JSON
   Persistencia: localStorage
========================================================= */

/* =========================================================
   1) CLAVES DE LOCALSTORAGE
   ========================================================= */
const LS_KEYS = {
  lockers: "lockers_v1",          /* lockers: [ { id, name, sede, edificio, piso, active } ] */
  reservations: "locker_res_v1",  /* reservations: [ { id, lockerId, date, start, end, usuario, motivo, status, createdAt } ] */
};

/* =========================================================
   2) REGLA DE NEGOCIO (insumo a medida):
      Sede -> Edificio -> Pisos válidos
   - Si deseas agregar sedes/edificios/pisos, edita este objeto.
   ========================================================= */
const SEDES = {
  CENTRO: {
    label: "Centro",
    edificios: {
      "Centro Histórico": ["1", "2", "3"],
    },
  },
  CAMPUS: {
    label: "Campus",
    edificios: {
      "Santo Domingo": ["1", "2", "3", "4"],
      "Giordano Bruno": ["1", "2"],
    },
  },
};

/* =========================================================
   3) UTILIDADES
   ========================================================= */
function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isPastDate(dateISO) {
  return dateISO < todayISO();
}

function prettyDate(dateISO) {
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

/* =========================================================
   4) DATA INICIAL: Lockers por defecto (sede/edificio/piso)
   ========================================================= */
const DEFAULT_LOCKERS = [
  { id: "LK-CH-101", name: "LOCKER CH-101", sede: "CENTRO", edificio: "Centro Histórico", piso: "1", active: true },
  { id: "LK-CH-102", name: "LOCKER CH-102", sede: "CENTRO", edificio: "Centro Histórico", piso: "1", active: true },
  { id: "LK-SD-201", name: "LOCKER SD-201", sede: "CAMPUS", edificio: "Santo Domingo", piso: "2", active: true },
  { id: "LK-SD-401", name: "LOCKER SD-401", sede: "CAMPUS", edificio: "Santo Domingo", piso: "4", active: true },
  { id: "LK-GB-101", name: "LOCKER GB-101", sede: "CAMPUS", edificio: "Giordano Bruno", piso: "1", active: true },
];

/* =========================================================
   5) APP (SPA)
   ========================================================= */
export default function App() {
  /* 5.1 Navegación SPA */
  const [view, setView] = useState("dashboard");

  /* 5.2 Estado persistente */
  const [lockers, setLockers] = useState(() => loadLS(LS_KEYS.lockers, DEFAULT_LOCKERS));
  const [reservations, setReservations] = useState(() => loadLS(LS_KEYS.reservations, []));

  /* 5.3 UI */
  const [toast, setToast] = useState({ type: "info", msg: "" });

  /* 5.4 Persistencia automática */
  useEffect(() => saveLS(LS_KEYS.lockers, lockers), [lockers]);
  useEffect(() => saveLS(LS_KEYS.reservations, reservations), [reservations]);

  /* 5.5 Derivados */
  const activeLockers = useMemo(() => lockers.filter((l) => l.active), [lockers]);

  const upcomingReservations = useMemo(() => {
    const sorted = [...reservations].sort((a, b) => {
      const A = `${a.date} ${a.start}`;
      const B = `${b.date} ${b.start}`;
      return A.localeCompare(B);
    });
    return sorted.filter((r) => r.date >= todayISO()).slice(0, 6);
  }, [reservations]);

  const stats = useMemo(() => {
    const total = reservations.length;
    const today = reservations.filter((r) => r.date === todayISO()).length;
    const active = activeLockers.length;
    return { total, today, active };
  }, [reservations, activeLockers]);

  function notify(type, msg) {
    setToast({ type, msg });
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setToast({ type: "info", msg: "" }), 2600);
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  /* =========================================================
     5.6 CASOS DE USO
     ========================================================= */

  function createReservation(payload) {
    const { lockerId, date, start, end, usuario, motivo } = payload;

    if (!lockerId || !date || !start || !end || !usuario.trim() || !motivo.trim()) {
      notify("error", "Todos los campos son obligatorios.");
      return;
    }
    if (isPastDate(date)) {
      notify("error", "No puedes reservar en una fecha pasada.");
      return;
    }
    if (start >= end) {
      notify("error", "La hora de inicio debe ser menor que la hora de fin.");
      return;
    }

    const locker = lockers.find((l) => l.id === lockerId);
    if (!locker || !locker.active) {
      notify("error", "El locker seleccionado no está disponible.");
      return;
    }

    const collision = reservations.some((r) => {
      if (r.status !== "CONFIRMADA") return false;
      if (r.lockerId !== lockerId) return false;
      if (r.date !== date) return false;
      return overlaps(start, end, r.start, r.end);
    });

    if (collision) {
      notify("error", "Ya existe una reserva para ese locker en ese horario.");
      return;
    }

    const newRes = {
      id: uid(),
      lockerId,
      date,
      start,
      end,
      usuario: usuario.trim(),
      motivo: motivo.trim(),
      status: "CONFIRMADA",
      createdAt: new Date().toISOString(),
    };

    setReservations((prev) => [newRes, ...prev]);
    notify("success", "Reserva confirmada.");
    setView("mis-reservas");
  }

  function cancelReservation(id) {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: "CANCELADA" } : r)));
    notify("info", "Reserva cancelada.");
  }

  function addLocker(payload) {
    const { id, name, sede, edificio, piso } = payload;

    if (!id.trim() || !name.trim()) {
      notify("error", "ID y nombre son obligatorios.");
      return;
    }
    if (lockers.some((l) => l.id === id.trim())) {
      notify("error", "Ya existe un locker con ese ID.");
      return;
    }

    const sedeOk = !!SEDES[sede];
    const sedeFinal = sedeOk ? sede : "CAMPUS";

    const edificiosObj = SEDES[sedeFinal].edificios;
    const edificios = Object.keys(edificiosObj);
    const edificioFinal = edificios.includes(edificio) ? edificio : edificios[0];

    const pisos = edificiosObj[edificioFinal] ?? ["1"];
    const pisoFinal = pisos.includes(String(piso)) ? String(piso) : pisos[0];

    const newLocker = {
      id: id.trim(),
      name: name.trim(),
      sede: sedeFinal,
      edificio: edificioFinal,
      piso: pisoFinal,
      active: true,
    };

    setLockers((prev) => [...prev, newLocker]);
    notify("success", "Locker creado.");
  }

  function toggleLocker(id) {
    setLockers((prev) => prev.map((l) => (l.id === id ? { ...l, active: !l.active } : l)));
  }

  function resetAll() {
    if (!confirm("¿Seguro? Se perderán lockers y reservas.")) return;
    setLockers(DEFAULT_LOCKERS);
    setReservations([]);
    notify("info", "Datos reiniciados.");
    setView("dashboard");
  }

  function exportJSON() {
    const data = { lockers, reservations, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lockers_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("success", "Backup exportado (JSON).");
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);

        if (!parsed.lockers || !parsed.reservations) throw new Error("Estructura inválida");

        const normalizedLockers = parsed.lockers.map((l) => {
          const sede = l.sede && SEDES[l.sede] ? l.sede : "CAMPUS";

          const edificiosObj = SEDES[sede].edificios;
          const edificios = Object.keys(edificiosObj);

          const edificio = edificios.includes(l.edificio) ? l.edificio : edificios[0];

          const pisos = edificiosObj[edificio] ?? ["1"];
          const piso = pisos.includes(String(l.piso)) ? String(l.piso) : pisos[0];

          return { ...l, sede, edificio, piso };
        });

        setLockers(normalizedLockers);
        setReservations(parsed.reservations);

        notify("success", "Backup importado correctamente.");
        setView("dashboard");
      } catch {
        notify("error", "No se pudo importar. Verifica el archivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  function lockerLabelById(lockerId) {
    const l = lockers.find((x) => x.id === lockerId);
    if (!l) return lockerId;
    const sedeLbl = SEDES[l.sede]?.label ?? l.sede;
    return `${l.name} • ${sedeLbl} - ${l.edificio} • Piso ${l.piso}`;
  }

  /* =========================================================
     5.7 RENDER
     ========================================================= */
  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          <div>
            <h1>Reserva de Lockers</h1>
            <p>SPA (Vite + React) • Persistencia con localStorage</p>
          </div>
        </div>

        <nav className="nav">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={view === "reservar" ? "active" : ""} onClick={() => setView("reservar")}>
            Reservar
          </button>
          <button className={view === "mis-reservas" ? "active" : ""} onClick={() => setView("mis-reservas")}>
            Mis reservas
          </button>
          <button className={view === "lockers" ? "active" : ""} onClick={() => setView("lockers")}>
            Lockers
          </button>
          <button className={view === "config" ? "active" : ""} onClick={() => setView("config")}>
            Config
          </button>
        </nav>
      </header>

      {toast.msg && (
        <div className={`toast ${toast.type}`}>
          <strong>{toast.type.toUpperCase()}:</strong> {toast.msg}
        </div>
      )}

      <main className="main">
        {view === "dashboard" && (
          <section className="card">
            <h2>Dashboard</h2>
            <p className="muted">Resumen rápido del estado de lockers.</p>

            <div className="grid3">
              <div className="kpi">
                <div className="kpi-num">{stats.active}</div>
                <div className="kpi-lbl">Lockers activos</div>
              </div>
              <div className="kpi">
                <div className="kpi-num">{stats.today}</div>
                <div className="kpi-lbl">Reservas hoy</div>
              </div>
              <div className="kpi">
                <div className="kpi-num">{stats.total}</div>
                <div className="kpi-lbl">Reservas totales</div>
              </div>
            </div>

            <hr />

            <h3>Próximas reservas</h3>
            {upcomingReservations.length === 0 ? (
              <p className="muted">Aún no hay reservas próximas.</p>
            ) : (
              <div className="list">
                {upcomingReservations.map((r) => (
                  <div className="item" key={r.id}>
                    <div className="item-main">
                      <div className="item-title">{lockerLabelById(r.lockerId)}</div>
                      <div className="item-sub">
                        {prettyDate(r.date)} • {r.start}-{r.end} • {r.usuario}
                      </div>
                    </div>
                    <span className={`pill ${r.status}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "reservar" && <ReserveView lockers={activeLockers} onCreate={createReservation} />}

        {view === "mis-reservas" && (
          <MyReservationsView reservations={reservations} onCancel={cancelReservation} lockers={lockers} />
        )}

        {view === "lockers" && <LockersView lockers={lockers} onAdd={addLocker} onToggle={toggleLocker} />}

        {view === "config" && <ConfigView onReset={resetAll} onExport={exportJSON} onImport={importJSON} />}
      </main>

      <footer className="footer muted">Actividad No.4 • Reserva de lockers por sede-edificio-piso</footer>
    </div>
  );
}

/* =========================================================
   VISTAS
   ========================================================= */

function ReserveView({ lockers, onCreate }) {
  // filtros jerárquicos: sede -> edificio -> piso -> locker
  const sedeKeys = Object.keys(SEDES);
  const [sede, setSede] = useState(sedeKeys[0] ?? "CAMPUS");

  const edificioKeys = Object.keys(SEDES[sede]?.edificios ?? {});
  const [edificio, setEdificio] = useState(edificioKeys[0] ?? "");

  const pisosList = (SEDES[sede]?.edificios?.[edificio] ?? ["1"]).map(String);
  const [piso, setPiso] = useState(pisosList[0] ?? "1");

  const filteredLockers = useMemo(() => {
    return lockers.filter((l) => l.sede === sede && l.edificio === edificio && String(l.piso) === String(piso));
  }, [lockers, sede, edificio, piso]);

  const [lockerId, setLockerId] = useState(() => filteredLockers[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [usuario, setUsuario] = useState("");
  const [motivo, setMotivo] = useState("");

  // si cambia sede, resetea edificio y piso
  function handleSedeChange(value) {
    setSede(value);
    const eds = Object.keys(SEDES[value]?.edificios ?? {});
    const ed0 = eds[0] ?? "";
    setEdificio(ed0);
    const pisos0 = (SEDES[value]?.edificios?.[ed0] ?? ["1"]).map(String);
    setPiso(pisos0[0] ?? "1");
  }

  function handleEdificioChange(value) {
    setEdificio(value);
    const pisos0 = (SEDES[sede]?.edificios?.[value] ?? ["1"]).map(String);
    setPiso(pisos0[0] ?? "1");
  }

  // mantener locker seleccionado válido
  useEffect(() => {
    const next = filteredLockers[0]?.id ?? "";
    setLockerId((prev) => (prev && filteredLockers.some((l) => l.id === prev) ? prev : next));
  }, [filteredLockers]);

  function submit(e) {
    e.preventDefault();
    onCreate({ lockerId, date, start, end, usuario, motivo });
  }

  return (
    <section className="card">
      <h2>Reservar locker</h2>
      <p className="muted">Selecciona sede, edificio y piso para filtrar lockers disponibles.</p>

      <form className="stack" onSubmit={submit}>
        <div className="row3">
          <label>
            Sede
            <select value={sede} onChange={(e) => handleSedeChange(e.target.value)}>
              {Object.keys(SEDES).map((k) => (
                <option key={k} value={k}>
                  {SEDES[k].label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Edificio
            <select value={edificio} onChange={(e) => handleEdificioChange(e.target.value)}>
              {Object.keys(SEDES[sede]?.edificios ?? {}).map((ed) => (
                <option key={ed} value={ed}>
                  {ed}
                </option>
              ))}
            </select>
          </label>

          <label>
            Piso
            <select value={piso} onChange={(e) => setPiso(e.target.value)}>
              {(SEDES[sede]?.edificios?.[edificio] ?? ["1"]).map((p) => (
                <option key={p} value={String(p)}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Locker
          <select value={lockerId} onChange={(e) => setLockerId(e.target.value)} required>
            {filteredLockers.length === 0 ? (
              <option value="">(Sin lockers activos en este piso)</option>
            ) : (
              filteredLockers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} • {SEDES[l.sede]?.label} - {l.edificio} • Piso {l.piso}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="row2">
          <label>
            Fecha
            <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Usuario
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Ej: Juan Pérez" required />
          </label>
        </div>

        <div className="row2">
          <label>
            Hora inicio
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            Hora fin
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>

        <label>
          Motivo / descripción
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ej: Guardar materiales" required />
        </label>

        <button type="submit" disabled={!lockerId}>
          Confirmar reserva
        </button>
      </form>
    </section>
  );
}

function MyReservationsView({ reservations, onCancel, lockers }) {
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  function lockerName(id) {
    const l = lockers.find((x) => x.id === id);
    if (!l) return id;
    return `${l.name} • ${SEDES[l.sede]?.label} - ${l.edificio} • Piso ${l.piso}`;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return reservations
      .filter((r) => (onlyActive ? r.status === "CONFIRMADA" : true))
      .filter((r) => {
        if (!query) return true;

        const l = lockers.find((x) => x.id === r.lockerId);
        const lockerLabel = l
          ? `${l.name} • ${SEDES[l.sede]?.label} - ${l.edificio} • piso ${l.piso}`.toLowerCase()
          : r.lockerId.toLowerCase();

        return (
          r.lockerId.toLowerCase().includes(query) ||
          r.usuario.toLowerCase().includes(query) ||
          r.motivo.toLowerCase().includes(query) ||
          r.date.includes(query) ||
          lockerLabel.includes(query)
        );
      })
      .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`));
  }, [reservations, q, onlyActive, lockers]);

  return (
    <section className="card">
      <h2>Mis reservas</h2>
      <p className="muted">Filtra y cancela reservas.</p>

      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por locker/sede/edificio/piso, usuario o fecha" />
        <label className="check">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Solo confirmadas
        </label>
      </div>

      <div className="table">
        <div className="thead">
          <div>Locker</div>
          <div>Fecha</div>
          <div>Horario</div>
          <div>Usuario</div>
          <div>Estado</div>
          <div>Acción</div>
        </div>

        {filtered.map((r) => (
          <div className="trow" key={r.id}>
            <div>{lockerName(r.lockerId)}</div>
            <div>{prettyDate(r.date)}</div>
            <div>
              {r.start} - {r.end}
            </div>
            <div>{r.usuario}</div>
            <div>
              <span className={`pill ${r.status}`}>{r.status}</span>
            </div>
            <div>
              <button className="danger" disabled={r.status !== "CONFIRMADA"} onClick={() => onCancel(r.id)}>
                Cancelar
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && <p className="muted" style={{ padding: 12 }}>No hay resultados.</p>}
      </div>
    </section>
  );
}

function LockersView({ lockers, onAdd, onToggle }) {
  const sedeKeys = Object.keys(SEDES);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [sede, setSede] = useState(sedeKeys[0] ?? "CAMPUS");

  const edificioKeys = Object.keys(SEDES[sede]?.edificios ?? {});
  const [edificio, setEdificio] = useState(edificioKeys[0] ?? "");

  const pisosList = (SEDES[sede]?.edificios?.[edificio] ?? ["1"]).map(String);
  const [piso, setPiso] = useState(pisosList[0] ?? "1");

  function handleSedeChange(value) {
    setSede(value);
    const eds = Object.keys(SEDES[value]?.edificios ?? {});
    const ed0 = eds[0] ?? "";
    setEdificio(ed0);
    const pisos0 = (SEDES[value]?.edificios?.[ed0] ?? ["1"]).map(String);
    setPiso(pisos0[0] ?? "1");
  }

  function handleEdificioChange(value) {
    setEdificio(value);
    const pisos0 = (SEDES[sede]?.edificios?.[value] ?? ["1"]).map(String);
    setPiso(pisos0[0] ?? "1");
  }

  function submit(e) {
    e.preventDefault();
    onAdd({ id, name, sede, edificio, piso });
    setId("");
    setName("");
  }

  return (
    <section className="card">
      <h2>Lockers</h2>
      <p className="muted">CRUD simple: crear lockers y asociarlos a sede, edificio y piso.</p>

      <form className="row3" onSubmit={submit}>
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID (ej: LK-SD-305)" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej: Locker SD-305)" />

        <select value={sede} onChange={(e) => handleSedeChange(e.target.value)}>
          {Object.keys(SEDES).map((key) => (
            <option key={key} value={key}>
              {SEDES[key].label}
            </option>
          ))}
        </select>

        <select value={edificio} onChange={(e) => handleEdificioChange(e.target.value)}>
          {Object.keys(SEDES[sede]?.edificios ?? {}).map((ed) => (
            <option key={ed} value={ed}>
              {ed}
            </option>
          ))}
        </select>

        <select value={piso} onChange={(e) => setPiso(e.target.value)}>
          {(SEDES[sede]?.edificios?.[edificio] ?? ["1"]).map((p) => (
            <option key={p} value={String(p)}>
              Piso {p}
            </option>
          ))}
        </select>

        <button type="submit">Crear locker</button>
      </form>

      <div className="table">
        <div className="thead">
          <div>ID</div>
          <div>Nombre</div>
          <div>Sede</div>
          <div>Edificio</div>
          <div>Piso</div>
          <div>Estado</div>
          <div>Acción</div>
        </div>

        {lockers.map((l) => (
          <div className="trow" key={l.id}>
            <div>{l.id}</div>
            <div>{l.name}</div>
            <div>{SEDES[l.sede]?.label ?? l.sede}</div>
            <div>{l.edificio}</div>
            <div>{l.piso}</div>
            <div>
              <span className={`pill ${l.active ? "CONFIRMADA" : "CANCELADA"}`}>{l.active ? "ACTIVO" : "INACTIVO"}</span>
            </div>
            <div>
              <button onClick={() => onToggle(l.id)}>{l.active ? "Desactivar" : "Activar"}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfigView({ onReset, onExport, onImport }) {
  return (
    <section className="card">
      <h2>Configuración</h2>
      <p className="muted">Exporta/importa JSON y reinicia datos.</p>

      <div className="grid2">
        <div className="panel">
          <h3>Backup</h3>
          <p className="muted">Exporta o importa lockers y reservas.</p>
          <div className="row">
            <button onClick={onExport}>Exportar JSON</button>
            <label className="file">
              Importar JSON
              <input type="file" accept="application/json" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
          </div>
        </div>

        <div className="panel">
          <h3>Reiniciar</h3>
          <p className="muted">Restablece valores por defecto.</p>
          <button className="danger" onClick={onReset}>
            Reset total
          </button>
        </div>
      </div>
    </section>
  );
}
