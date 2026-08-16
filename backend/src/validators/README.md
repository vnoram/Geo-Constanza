# validators/

Carpeta para esquemas de validación de entrada (por ejemplo con `zod`, ya
incluido en las dependencias) antes de que los controllers pasen los datos a
los services. Actualmente la validación vive de forma implícita dentro de
cada controller/service; a medida que se agreguen validadores explícitos
(ej. `novedades.validator.js`, `turnos.validator.js`), deben ubicarse aquí.
