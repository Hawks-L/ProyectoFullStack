import { useEffect, useMemo, useState } from "react";

/* =========================================================
   1) DESCRIPCIÓN GENERAL DEL MÓDULO (para el desarrollador)
   =========================================================
   SPA: Reserva de Salas de Tutorías (5 vistas)
   - Dashboard: resumen y próximas reservas
   - Reservar: formulario para crear una reserva
   - Mis reservas: listar, buscar y cancelar
   - Salas: CRUD simple (crear y activar/desactivar) + sede/edificio
   - Configuración: reset + exportar/importar backup JSON
   Persistencia: localStorage
*/

/* =========================================================
   2) CLAVES DE LOCALSTORAGE (dónde guardamos datos)
   ========================================================= */
const LS_KEYS = {
  rooms: "tutorias_rooms_v1",       /* rooms: [ { id, name, sede, edificio, capacity, active } ] */
  bookings: "tutorias_bookings_v1", /* bookings: [ { id, roomId, date, start, end, tutor, topic, status, createdAt } ] */
};

/* =========================================================
   3) REGLA DE NEGOCIO: Sede -> Edificios permitidos (para validar creación de salas)
   - Cada sala debe tener una sede y un edificio válido según esta regla
   - Si se quiere agregar una nueva sede, se debe actualizar este objeto con su lista de edificios
     (no hay CRUD para sedes/edificios, solo para salas)
     - Ejemplo: SEDES["NUEVA_SEDE"] = { label: "Nueva Sede", edificios: ["Edificio A", "Edificio B"] }
   ========================================================= */
const SEDES = {
  CENTRO: { label: "Centro", edificios: ["Centro Histórico"] },
  CAMPUS: { label: "Campus", edificios: ["Santo Domingo", "Giordano Bruno"] },
};

/* =========================================================
   4) UTILIDADES: IDs, LocalStorage, Fechas y Formato 
   ========================================================= */

/** Genera un id único (suficiente para el demo/localStorage) */
function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Lee JSON desde localStorage, o devuelve fallback si falla */
/* el fallback se usa para cargar data inicial la primera vez o si el JSON está corrupto */
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Guarda JSON en localStorage */
function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Retorna la fecha actual en formato ISO YYYY-MM-DD */
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Determina si una fecha ISO es pasada (comparación por string) */
function isPastDate(dateISO) {
  return dateISO < todayISO();
}

/** Formatea YYYY-MM-DD a DD/MM/YYYY para mostrar al usuario */
function prettyDate(dateISO) {
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

/* =========================================================
   5) DATA INICIAL: Salas por defecto (incluye sede/edificio)
   ========================================================= */
const DEFAULT_ROOMS = [
  {
    id: "TUT-CH-01",
    name: "SALA TUT-CH-01",
    sede: "CENTRO",
    edificio: "Centro Histórico",
    capacity: 10,
    active: true,
  },
  {
    id: "TUT-SD-01",
    name: "SALA TUT-SD-01",
    sede: "CAMPUS",
    edificio: "Santo Domingo",
    capacity: 22,
    active: true,
  },
  {
    id: "TUT-SD-02",
    name: "SALA TUT-SD-02",
    sede: "CAMPUS",
    edificio: "Santo Domingo",
    capacity: 20,
    active: true,
  },
  {
    id: "TUT-GB-01",
    name: "SALA TUT-GB-01",
    sede: "CAMPUS",
    edificio: "Giordano Bruno",
    capacity: 30,
    active: true,
  },
];

/* =========================================================
   6) COMPONENTE PRINCIPAL: APP (SPA)
   ========================================================= */
export default function App() {
  /* ---------------------------
     6.1) NAVEGACIÓN SPA (vista actual, es decir qué sección se muestra)
     --------------------------- */
  const [view, setView] = useState("dashboard");

  /* ---------------------------
     6.2) ESTADO PERSISTENTE (salas y reservas)
     - Se carga desde localStorage al iniciar
     --------------------------- */
  const [rooms, setRooms] = useState(() => loadLS(LS_KEYS.rooms, DEFAULT_ROOMS));
  const [bookings, setBookings] = useState(() => loadLS(LS_KEYS.bookings, []));

  /* ---------------------------
     6.3) ESTADO DE UI (toast / alertas), UI es todo lo que no es data ni navegación
     --------------------------- */
  const [toast, setToast] = useState({ type: "info", msg: "" });

  /* ---------------------------
     6.4) EFECTOS: persistencia automática
     - Cada vez que cambian rooms/bookings, se guardan en localStorage
     --------------------------- */
  useEffect(() => saveLS(LS_KEYS.rooms, rooms), [rooms]);
  useEffect(() => saveLS(LS_KEYS.bookings, bookings), [bookings]);

  /* ---------------------------
     6.5) DERIVADOS (useMemo) para rendimiento/claridad
      - Evitan cálculos repetidos en cada render
      useMemo representa "variables" que se actualizan automáticamente cuando cambian sus dependencias (rooms/bookings)
     --------------------------- */

  /** Salas activas para reservar */
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  /** Próximas reservas: ordenadas y filtradas desde hoy 
   * los ...bookings crean una copia para no mutar el estado original al ordenar, 
   * ya que sort() ordena in-place (mutando el array) y 
   * eso puede causar bugs si se hace directamente sobre bookings
  */
  const upcomingBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => {
      const A = `${a.date} ${a.start}`;
      const B = `${b.date} ${b.start}`;
      return A.localeCompare(B);
    });
    return sorted.filter((b) => b.date >= todayISO()).slice(0, 6);
  }, [bookings]);

  /** Indicadores de dashboard */
  const stats = useMemo(() => {
    const total = bookings.length;
    const today = bookings.filter((b) => b.date === todayISO()).length;
    const active = activeRooms.length;
    return { total, today, active };
  }, [bookings, activeRooms]);

  /* ---------------------------
     6.6) FUNCIÓN DE NOTIFICACIÓN (toast con auto-cierre)
     --------------------------- */
  function notify(type, msg) {
    setToast({ type, msg });
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setToast({ type: "info", msg: "" }), 2600);
  }

  /* ---------------------------
     6.7) REGLA: detectar solapamiento de horas
     solapamiento es cuando el inicio de un rango es menor al fin del otro, y viceversa
     ejemplo: [10:00, 11:00] y [10:30, 11:30] se solapan porque 10:00 < 11:30 y 10:30 < 11:00
     - Retorna true si los rangos [aStart,aEnd] y [bStart,bEnd] se cruzan
     --------------------------- */
  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  /* ---------------------------
     6.8) CASO DE USO: crear reserva
     - Valida campos, fecha, horario, sala activa y colisiones
     --------------------------- */
  function createBooking(payload) {
    const { roomId, date, start, end, tutor, topic } = payload;

    if (!roomId || !date || !start || !end || !tutor.trim() || !topic.trim()) {
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

    const room = rooms.find((r) => r.id === roomId);
    if (!room || !room.active) {
      notify("error", "La sala seleccionada no está disponible.");
      return;
    }

    const sameRoomSameDay = bookings.filter((b) => b.roomId === roomId && b.date === date);
    const collision = sameRoomSameDay.some((b) => overlaps(start, end, b.start, b.end));
    if (collision) {
      notify("error", "Conflicto: ya existe una reserva en ese horario para esa sala.");
      return;
    }

    const newB = {
      id: uid(),
      roomId,
      date,
      start,
      end,
      tutor: tutor.trim(),
      topic: topic.trim(),
      status: "CONFIRMADA",
      createdAt: new Date().toISOString(),
    };

    setBookings((prev) => [newB, ...prev]);
    notify("success", "Reserva creada y confirmada.");
    setView("mis-reservas");
  }

  /* ---------------------------
     6.9) CASO DE USO: cancelar reserva
     - No borra, cambia estado a CANCELADA (historial)
     --------------------------- */
  function cancelBooking(id) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "CANCELADA" } : b)));
    notify("info", "Reserva cancelada.");
  }

  /* ---------------------------
     6.10) CASO DE USO: crear sala
     - Valida sede/edificio según reglas del objeto SEDES
     --------------------------- */
  function addRoom({ id, name, sede, edificio, capacity }) {
    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim();
    const cap = Number(capacity);

    if (!cleanId || !cleanName || !sede || !edificio || !cap || cap <= 0) {
      notify("error", "Completa todos los campos.");
      return;
    }

    if (!SEDES[sede] || !SEDES[sede].edificios.includes(edificio)) {
      notify("error", "El edificio no corresponde a la sede seleccionada.");
      return;
    }

    if (rooms.some((r) => r.id === cleanId)) {
      notify("error", "Ya existe una sala con ese ID.");
      return;
    }

    setRooms((prev) => [
      ...prev,
      { id: cleanId, name: cleanName, sede, edificio, capacity: cap, active: true },
    ]);
    notify("success", "Sala creada.");
  }

  /* ---------------------------
     6.11) CASO DE USO: activar/desactivar sala
     - Cambia disponibilidad (pero no borra)
     --------------------------- */
  function toggleRoom(id) {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    notify("info", "Estado de sala actualizado.");
  }

  /* ---------------------------
     6.12) MANTENIMIENTO: reset total
     --------------------------- */
  function resetAll() {
    if (!confirm("¿Seguro? Esto borrará salas/reservas y restablecerá valores por defecto.")) return;
    setRooms(DEFAULT_ROOMS);
    setBookings([]);
    notify("success", "Datos reiniciados.");
    setView("dashboard");
  }

  /* ---------------------------
     6.13) MANTENIMIENTO: exportar backup JSON
     --------------------------- */
  function exportJSON() {
    const data = { rooms, bookings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tutorias_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("success", "Backup exportado (JSON).");
  }

  /* ---------------------------
     6.14) MANTENIMIENTO: importar backup JSON
     - Normaliza sede/edificio por compatibilidad con versiones antiguas
     --------------------------- */
  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);

        if (!parsed.rooms || !parsed.bookings) throw new Error("Estructura inválida");

        const normalizedRooms = parsed.rooms.map((r) => {
          const sede = r.sede && SEDES[r.sede] ? r.sede : "CAMPUS";
          const edificioOk = SEDES[sede].edificios.includes(r.edificio);
          const edificio = edificioOk ? r.edificio : SEDES[sede].edificios[0];
          return { ...r, sede, edificio };
        });

        setRooms(normalizedRooms);
        setBookings(parsed.bookings);

        notify("success", "Backup importado correctamente.");
        setView("dashboard");
      } catch {
        notify("error", "No se pudo importar. Verifica el archivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------------------------
     6.15) UTILIDAD DE UI: etiqueta de sala completa
     es decir, nombre + sede/edificio para mostrar en tablas y detalles
     --------------------------- */
  function roomLabelById(roomId) {
    const r = rooms.find((x) => x.id === roomId);
    if (!r) return roomId;
    const sedeLbl = SEDES[r.sede]?.label ?? r.sede;
    return `${r.name} • ${sedeLbl} - ${r.edificio}`;
  }

  /* ---------------------------
     6.16) RENDER: estructura general (layout + header + vistas)
     lo que hace es renderizar UNA vista (Dashboard / Reservar / Mis reservas / Salas / Config) según el estado `view`
     --------------------------- */
  return (
    <div className="layout">
      {/* Header superior con marca y navegación entre vistas */}
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          <div>
            <h1>Reserva de Salas de Tutorías</h1>
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
          <button className={view === "salas" ? "active" : ""} onClick={() => setView("salas")}>
            Salas
          </button>
          <button className={view === "config" ? "active" : ""} onClick={() => setView("config")}>
            Config
          </button>
        </nav>
      </header>

      {/* Toast: mensajes de éxito/error/info */}
      {toast.msg && (
        <div className={`toast ${toast.type}`}>
          <strong>{toast.type.toUpperCase()}:</strong> {toast.msg}
        </div>
      )}

      {/* Main: renderiza UNA vista según el estado `view` */}
      <main className="main">
        {view === "dashboard" && (
          <section className="card">
            <h2>Dashboard</h2>
            <p className="muted">Resumen rápido del estado de tutorías.</p>

            <div className="grid3">
              <div className="kpi">
                <div className="kpi-num">{stats.active}</div>
                <div className="kpi-lbl">Salas activas</div>
              </div>
              <div className="kpi">
                <div className="kpi-num">{stats.total}</div>
                <div className="kpi-lbl">Reservas totales</div>
              </div>
              <div className="kpi">
                <div className="kpi-num">{stats.today}</div>
                <div className="kpi-lbl">Reservas hoy</div>
              </div>
            </div>

            <hr className="hr" />

            <h3>Próximas reservas</h3>
            {upcomingBookings.length === 0 ? (
              <p className="muted">No hay reservas próximas.</p>
            ) : (
              <div className="table">
                <div className="thead">
                  <div>Fecha</div>
                  <div>Hora</div>
                  <div>Sala (Sede/Edificio)</div>
                  <div>Tutor</div>
                  <div>Estado</div>
                </div>
                {upcomingBookings.map((b) => (
                  <div className="trow" key={b.id}>
                    <div>{prettyDate(b.date)}</div>
                    <div>{b.start} - {b.end}</div>
                    <div>{roomLabelById(b.roomId)}</div>
                    <div>{b.tutor}</div>
                    <div>
                      <span className={`pill ${b.status}`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "reservar" && <ReserveView rooms={activeRooms} onCreate={createBooking} />}
        {view === "mis-reservas" && <MyBookingsView bookings={bookings} onCancel={cancelBooking} rooms={rooms} />}
        {view === "salas" && <RoomsView rooms={rooms} onAdd={addRoom} onToggle={toggleRoom} />}
        {view === "config" && <ConfigView onReset={resetAll} onExport={exportJSON} onImport={importJSON} />}
      </main>

      {/* Footer institucional */}
      <footer className="footer">
        <span>© 2026 • Tutorías • Demo SPA</span>
      </footer>
    </div>
  );
}

/* =========================================================
   7) VISTAS: componentes hijos (Reservar / Mis reservas / Salas / Config)
   ========================================================= */

function ReserveView({ rooms, onCreate }) {
  /* Estado del formulario de reserva */
  const [roomId, setRoomId] = useState(() => rooms[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [tutor, setTutor] = useState("");
  const [topic, setTopic] = useState("");

  /* Evita que el select quede vacío si cambian salas activas */
  const effectiveRoomId = roomId || rooms[0]?.id || "";

  /* Envía el formulario al caso de uso createBooking (padre) */
  function submit(e) {
    e.preventDefault();
    onCreate({ roomId: effectiveRoomId, date, start, end, tutor, topic });
  }

  return (
    <section className="card">
      <h2>Reservar sala</h2>
      <p className="muted">Selecciona sala, fecha y horario.</p>

      {rooms.length === 0 ? (
        <p className="muted">No hay salas activas. Ve a la vista “Salas” y activa/crea una.</p>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label>
            Sala
            <select value={effectiveRoomId} onChange={(e) => setRoomId(e.target.value)} required>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} • {SEDES[r.sede]?.label} - {r.edificio} • Cap. {r.capacity}
                </option>
              ))}
            </select>
          </label>

          <div className="row2">
            <label>
              Fecha
              <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              Tutor
              <input value={tutor} onChange={(e) => setTutor(e.target.value)} placeholder="Ej: Ing. Karen" required />
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
            Tema / motivo
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="Ej: Dudas de React Router" required />
          </label>

          <button type="submit">Confirmar reserva</button>
        </form>
      )}
    </section>
  );
}

function MyBookingsView({ bookings, onCancel, rooms }) {
  /* Estado de filtros de búsqueda */
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  /* Devuelve etiqueta completa de la sala (para tabla y búsquedas) */
  function roomName(id) {
    const r = rooms.find((x) => x.id === id);
    if (!r) return id;
    return `${r.name} • ${SEDES[r.sede]?.label} - ${r.edificio}`;
  }

  /* Lista filtrada: búsqueda + checkbox “Solo confirmadas” */
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return bookings
      // ✅ Si onlyActive está activo, muestra SOLO reservas confirmadas
      .filter((b) => (onlyActive ? b.status === "CONFIRMADA" : true))
      // ✅ Filtro de texto por sala/sede/edificio/tutor/tema/fecha
      .filter((b) => {
        if (!query) return true;

        const r = rooms.find((x) => x.id === b.roomId);
        const roomLabel = r
          ? `${r.name} • ${SEDES[r.sede]?.label} - ${r.edificio}`.toLowerCase()
          : b.roomId.toLowerCase();

        return (
          b.roomId.toLowerCase().includes(query) ||
          b.tutor.toLowerCase().includes(query) ||
          b.topic.toLowerCase().includes(query) ||
          b.date.includes(query) ||
          roomLabel.includes(query)
        );
      })
      // ✅ Orden por fecha+hora (más recientes primero)
      .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`));
  }, [bookings, q, onlyActive, rooms]);

  return (
    <section className="card">
      <h2>Mis reservas</h2>
      <p className="muted">Filtra y cancela reservas.</p>

      <div className="row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por sala/sede/edificio, tutor, tema o fecha"
          aria-label="Buscar reservas"
        />

        {/* Checkbox para mostrar SOLO reservas confirmadas */}
        <label className="check">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Solo confirmadas
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No hay reservas para mostrar.</p>
      ) : (
        <div className="table">
          <div className="thead">
            <div>Fecha</div>
            <div>Hora</div>
            <div>Sala (Sede/Edificio)</div>
            <div>Tutor</div>
            <div>Motivo</div>
            <div>Acción</div>
          </div>

          {filtered.map((b) => (
            <div className="trow" key={b.id}>
              <div>{prettyDate(b.date)}</div>
              <div>{b.start}-{b.end}</div>
              <div>{roomName(b.roomId)}</div>
              <div>{b.tutor}</div>
              <div className="clip" title={b.topic}>{b.topic}</div>

              {/* Botón cancelar solo si está CONFIRMADA */}
              <div>
                {b.status === "CONFIRMADA" ? (
                  <button className="danger" onClick={() => onCancel(b.id)}>Cancelar</button>
                ) : (
                  <span className={`pill ${b.status}`}>{b.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RoomsView({ rooms, onAdd, onToggle }) {
  /* Estado del formulario de creación de sala */
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [sede, setSede] = useState("CENTRO");
  const [edificio, setEdificio] = useState(SEDES.CENTRO.edificios[0]);
  const [capacity, setCapacity] = useState(20);

  /* Al cambiar sede, se resetea el edificio al primer edificio válido */
  function handleSedeChange(value) {
    setSede(value);
    setEdificio(SEDES[value].edificios[0]);
  }

  /* Envía datos al caso de uso addRoom (padre) y limpia inputs */
  function submit(e) {
    e.preventDefault();
    onAdd({ id, name, sede, edificio, capacity });
    setId("");
    setName("");
    setCapacity(20);
  }

  return (
    <section className="card">
      <h2>Salas</h2>
      <p className="muted">Crear salas y asociarlas a sede y edificio.</p>

      <form className="row3" onSubmit={submit}>
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID (ej: SALA-4E)" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej: Sala 4E)" />

        <select value={sede} onChange={(e) => handleSedeChange(e.target.value)}>
          {Object.keys(SEDES).map((key) => (
            <option key={key} value={key}>{SEDES[key].label}</option>
          ))}
        </select>

        <select value={edificio} onChange={(e) => setEdificio(e.target.value)}>
          {SEDES[sede].edificios.map((ed) => (
            <option key={ed} value={ed}>{ed}</option>
          ))}
        </select>

        <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacidad" />

        <button type="submit">Crear sala</button>
      </form>

      <div className="table">
        <div className="thead">
          <div>ID</div>
          <div>Nombre</div>
          <div>Sede</div>
          <div>Edificio</div>
          <div>Cap.</div>
          <div>Estado</div>
          <div>Acción</div>
        </div>

        {rooms.map((r) => (
          <div className="trow" key={r.id}>
            <div>{r.id}</div>
            <div>{r.name}</div>
            <div>{SEDES[r.sede]?.label ?? r.sede}</div>
            <div>{r.edificio}</div>
            <div>{r.capacity}</div>
            <div>
              <span className={`pill ${r.active ? "CONFIRMADA" : "CANCELADA"}`}>
                {r.active ? "ACTIVA" : "INACTIVA"}
              </span>
            </div>
            <div>
              <button onClick={() => onToggle(r.id)}>{r.active ? "Desactivar" : "Activar"}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Vista de configuración: exportar/importar backup JSON y reset total */
function ConfigView({ onReset, onExport, onImport }) {
  /* Vista de mantenimiento: backup y reset */
  return (
    <section className="card">
      <h2>Configuración</h2>
      <p className="muted">Exporta/importa JSON y reinicia datos.</p>

      <div className="grid2">
        <div className="panel">
          <h3>Backup</h3>
          <p className="muted">Exporta o importa salas y reservas.</p>
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
          <button className="danger" onClick={onReset}>Reset total</button>
        </div>
      </div>
    </section>
  );
}