// Validación de entrada de autenticación (zod). Rechaza tipos inesperados (objetos, arreglos)
// antes de que lleguen a Prisma o a bcrypt.
const { z } = require('zod');

const texto = (max) => z.string().trim().min(1).max(max);

const loginSchema = z.object({
  rut: texto(20),
  password: z.string().min(1).max(128),
});

const verify2FASchema = z.object({
  tempToken: texto(2000),
  code: texto(20),
});

const enable2FASchema = z.object({ code: texto(20) });

const refreshSchema = z.object({ refreshToken: texto(2000) });

const resetRequestSchema = z.object({ email: texto(254) });

const resetConfirmSchema = z.object({
  token: texto(200),
  password: z.string().min(1).max(128),
});

// Middleware: valida req.body y lo reemplaza por la versión depurada (sin campos extra).
const validarBody = (schema) => (req, res, next) => {
  const resultado = schema.safeParse(req.body ?? {});
  if (!resultado.success) return next(resultado.error);
  req.body = resultado.data;
  next();
};

module.exports = {
  loginSchema, verify2FASchema, enable2FASchema, refreshSchema, resetRequestSchema, resetConfirmSchema, validarBody,
};
