const equipos = require('../services/dispositivos.service');
const { ROLES } = require('../constants/roles');

const permisoPersonal = (req) => {
  const ruta = (req.baseUrl + req.path).toLowerCase().replace(/^\/api\/v1(?=\/)/, '').replace(/\/$/, '');
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (['/usuarios/me', '/solicitudes', '/turnos'].includes(ruta)) return true;
    return /^\/turnos\/(?!disponibles$|conflictos$)[^/]+$/.test(ruta);
  }
  return req.method === 'POST' && ['/solicitudes', '/auth/logout'].includes(ruta);
};

const aplicarDispositivo = async (req, res, sesion) => {
  if (!equipos.habilitada()) {
    if (sesion.dispositivo) res.set('X-Device-Class', 'off');
    return true;
  }
  if (sesion.rol === ROLES.SUPER_ADMIN) return true;
  const equipo = sesion.dispositivoId && await equipos.identificar(
    sesion.empresaId, req.get('X-Device-Token'), sesion.dispositivoId,
  );
  sesion.dispositivo = equipo ? equipos.TIPOS.CORPORATIVO : equipos.TIPOS.PERSONAL;
  res.set('X-Device-Class', sesion.dispositivo);
  if (equipo || (equipos.GUARDIAS.includes(sesion.rol) && permisoPersonal(req))) return true;
  res.status(403).json({ error: equipos.GUARDIAS.includes(sesion.rol)
    ? 'Esta operación requiere un dispositivo corporativo enrolado.'
    : 'Este rol requiere un dispositivo corporativo enrolado.' });
  return false;
};

module.exports = { aplicarDispositivo };
