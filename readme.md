# ---------------------- proyecto asistencia-spa-vite
npm create vite@latest asistencia-spa-vite -- --template vanilla
cd asistencia-spa-vite
npm install
npm run dev
# ----------------------



# 1) Creación del proyecto con Vite
npm create vite@latest asistencia-spa-vite -- --template vanilla

# 2) Instalación del generador create-vite
Need to install the following packages:
create-vite@8.3.0
Ok to proceed? (y)

# Acción realizada:

- Se autorizó la instalación temporal del paquete create-vite.
- npm ejecutó internamente:
npx create-vite asistencia-spa-vite vanilla

# 3) Selección de opciones del proyecto (asistidas por CLI)
Select a framework:        Vanilla
Select a variant:          JavaScript
Use Vite 8 beta:           No
Install with npm and start now: Yes

# Creación de la estructura del proyecto
Scaffolding project in D:\DEV_FS_FE_BE\asistencia-spa-vite...
Resultado:

- Se creó la carpeta del proyecto.
- Se generó la estructura base:

index.html
src/main.js
src/style.css
package.json

# 4) lo que se modificó y reemplazó:

- index.html (raíz del proyecto)
- src/style.css
- src/main.js (aquí está la SPA)

# 12 de febrero--------------------------------------------------

1)npm create vite@latest control-salas-bloques-spa-vite -- --template vanilla
- Select a framework: Vanilla
- Select a variant: JavaScript
- Use Vite beta (Experimental)?: No
- Install with npm and start now?: Yes (o puedes hacerlo manual)

2)cd control-salas-bloques-spa-vite
npm install
3)npm run dev

4)Lo que vamos a reemplazar

index.html (raíz del proyecto)
src/style.css
src/main.js (aquí está la SPA)

# Actividad No.2 
Ahora vamos a llevar el control de los auditorios:
- su ocupación por edificio 
- franja horaria y 
- docente

# 17 de febrero ----------------------------------------------------------------------------------
1.) npm create vite@latest reservas-salas-spa-vite -- --template vanilla
Select a framework:        Vanilla
Select a variant:          JavaScript
Use Vite 8 beta:           No
Install with npm and start now: Yes

2.) cd reservas-salas-spa-vite

# Actividad No.3
Ahora vamos a ajustar el proyecto para que los docentes puedan reservar las salas de tutorías 
- (por lo menos 5 por edificio - sede [centro: edificio centro histórico - campus: edificios giordano y santo domingo])
- las tutorías deben llevar nombre del espacio académico y un espacio de observación para el tema a abordar
- las franjas horarias de atención son diferentes (lunes a jueves)


