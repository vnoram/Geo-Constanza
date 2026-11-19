/** Etiquetas legibles de las acciones de auditoría (bitácora en PDF). La pantalla usa las mismas. */
const ACCIONES = {
  login: ['Inicio de sesión', 'acceso'], login_2fa: ['Verificación en dos pasos', 'acceso'], enviar_2fa_email: ['Código enviado por correo', 'acceso'],
  activar_2fa: ['2FA activado', 'seguridad'], reiniciar_2fa: ['2FA reiniciado', 'seguridad'], cambio_password: ['Cambio de contraseña', 'seguridad'],
  reset_password: ['Contraseña restablecida', 'seguridad'], solicitar_reset_password: ['Restablecimiento solicitado', 'seguridad'],
  canjear_codigo_dispositivo: ['Código de equipo canjeado', 'equipos'], confirmar_invitacion_dispositivo: ['Invitación de equipo abierta', 'equipos'],
  crear_codigo_dispositivo: ['Código de equipo creado', 'equipos'], enrolar_dispositivo: ['Equipo enrolado', 'equipos'],
  invitar_dispositivo: ['Equipo invitado', 'equipos'], reenviar_invitacion_dispositivo: ['Invitación reenviada', 'equipos'],
  revocar_dispositivo: ['Equipo revocado', 'equipos'], invitar_dispositivo_plataforma: ['Equipo principal invitado', 'equipos'],
  revocar_dispositivo_plataforma: ['Equipo revocado por plataforma', 'equipos'],
  crear_empresa: ['Empresa creada', 'gestion'], activar_empresa: ['Empresa reactivada', 'gestion'], suspender_empresa: ['Empresa suspendida', 'gestion'],
  crear: ['Registro creado', 'gestion'], editar: ['Registro editado', 'gestion'], desactivar: ['Registro desactivado', 'gestion'],
  escalar: ['Novedad escalada', 'gestion'], resolver: ['Novedad resuelta', 'gestion'], revisar_marcaje: ['Marcaje revisado', 'gestion'],
  crear_pauta_4x4: ['Pauta 4x4 creada', 'gestion'], subir_documento: ['Documento subido', 'gestion'],
};
const TABLAS = {
  usuarios: 'Usuario', dispositivos: 'Equipo', novedades: 'Novedad', turnos: 'Turno', instalaciones: 'Instalación',
  empresas: 'Empresa', documentos: 'Documento', asistencias: 'Marcaje',
};
const TIPOS = {
  relevantes: 'Relevantes (sin accesos)', gestion: 'Gestión', equipos: 'Equipos', seguridad: 'Seguridad', acceso: 'Accesos', todo: 'Todo',
};

const describir = (accion) => {
  const k = String(accion ?? '').toLowerCase();
  if (ACCIONES[k]) return { texto: ACCIONES[k][0], categoria: ACCIONES[k][1] };
  const palabras = k.replace(/_/g, ' ').trim();
  return { texto: palabras ? palabras[0].toUpperCase() + palabras.slice(1) : '—', categoria: 'gestion' };
};

module.exports = { ACCIONES, TABLAS, TIPOS, describir };
