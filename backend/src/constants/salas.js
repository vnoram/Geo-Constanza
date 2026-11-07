// Salas de Socket.IO. TODAS llevan la empresa: una empresa nunca comparte sala con otra.
//   instalacion:{id}              eventos de una instalación (los ids son únicos y se validan contra la empresa)
//   empresa:{id}                  todos los sockets de la empresa (sirve para desconectarla al suspenderla)
//   empresa:{id}:central|admin    el panel de Central y el de Administración de ESA empresa
const salaInstalacion = (id) => `instalacion:${id}`;
const salaEmpresa = (empresaId) => `empresa:${empresaId}`;
const salaCentral = (empresaId) => `empresa:${empresaId}:central`;
const salaAdmin = (empresaId) => `empresa:${empresaId}:admin`;

module.exports = { salaInstalacion, salaEmpresa, salaCentral, salaAdmin };
