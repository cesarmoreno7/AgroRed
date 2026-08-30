import { Router } from "express";
import { z } from "zod";
import { LoginUser } from "../../../application/use-cases/LoginUser.js";
import { RegisterUser } from "../../../application/use-cases/RegisterUser.js";
import type { User } from "../../../domain/entities/User.js";
import type { UserRepository } from "../../../domain/ports/UserRepository.js";
import { USER_ROLES } from "../../../domain/value-objects/UserRole.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";
import type { AuditLogger } from "../../../shared/audit.js";
import { auditGodViewAccess, resolveTenantFilter } from "../../../../../shared/middleware/tenantContext.js";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import type { Redis } from "ioredis";

const RECOVERY_TTL_SECONDS = 3600; // 1 hour
const RECOVERY_KEY_PREFIX = "pwd_recovery:";

const passwordStrengthSchema = z.string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial");

const registerUserSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(3),
  role: z.enum(USER_ROLES),
  password: passwordStrengthSchema,
  contactPhone: z.string().min(7).nullable().optional()
});

const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function toUserResponse(user: User) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    contactPhone: user.contactPhone,
    createdAt: user.createdAt.toISOString()
  };
}

interface UsersRouterDeps {
  repository: UserRepository;
  redis?: Redis;
  jwtSecret: string;
  jwtExpiresIn: string;
  emailUser: string;
  emailPass: string;
  frontendUrl: string;
  auditLogger?: AuditLogger;
}

function isPasswordRecoveryAvailable(deps: UsersRouterDeps): deps is UsersRouterDeps & { redis: Redis } {
  return Boolean(deps.redis);
}

export function createUsersRouter(deps: UsersRouterDeps): Router {
  const router = Router();
  const registerUser = new RegisterUser(deps.repository);
  const loginUser = new LoginUser(deps.repository, deps.jwtSecret, deps.jwtExpiresIn);

  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: { user: deps.emailUser, pass: deps.emailPass }
  });

  router.post("/api/v1/users/register", asyncHandler(async (req, res) => {
    const parsed = registerUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_USER_PAYLOAD", "Payload invalido para registro de usuario.");
    }

    try {
      const user = await registerUser.execute(parsed.data);
      return sendSuccess(res, toUserResponse(user), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "USER_EMAIL_ALREADY_EXISTS") {
        return sendError(res, 409, "USER_EMAIL_ALREADY_EXISTS", "El correo ya existe en el sistema.");
      }

      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      return sendError(res, 500, "USER_REGISTRATION_FAILED", "No fue posible registrar el usuario.");
    }
  }));

  router.post("/api/v1/users/login", asyncHandler(async (req, res) => {
    const parsed = loginUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_LOGIN_PAYLOAD", "Payload invalido para inicio de sesion.");
    }

    try {
      const result = await loginUser.execute(parsed.data);
      return sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
        return sendError(res, 401, "INVALID_CREDENTIALS", "Credenciales invalidas.");
      }

      if (error instanceof Error && error.message === "ACCESS_EXPIRED") {
        return sendError(res, 403, "ACCESS_EXPIRED", "El acceso vencio. Solicite una renovacion.");
      }

      return sendError(res, 500, "LOGIN_FAILED", "No fue posible iniciar sesion.");
    }
  }));

  router.post("/api/v1/users/recover-password", asyncHandler(async (req, res) => {
    if (!isPasswordRecoveryAvailable(deps)) {
      return sendError(
        res,
        503,
        "PASSWORD_RECOVERY_TEMPORARILY_UNAVAILABLE",
        "La recuperacion de contraseña no esta disponible temporalmente. Intente de nuevo mas tarde."
      );
    }

    const { email } = req.body;

    const user = await deps.repository.findByEmail(email);
    if (!user) {
      // Return 200 to avoid email enumeration
      return sendSuccess(res, { message: "Si el correo existe, recibirá el enlace de recuperación." });
    }

    const token = randomUUID();
    const redisKey = `${RECOVERY_KEY_PREFIX}${token}`;
    await deps.redis.set(redisKey, user.id, "EX", RECOVERY_TTL_SECONDS);

    const recoveryLink = `${deps.frontendUrl}/reset-password?token=${token}`;

    if (deps.emailUser) {
      await transporter.sendMail({
        from: deps.emailUser,
        to: email,
        subject: "Recuperación de contraseña — AgroRed",
        text: `Hola, ${user.fullName}. Usa este enlace para restablecer tu contraseña (válido 1 hora): ${recoveryLink}`
      });
    }

    return sendSuccess(res, { message: "Si el correo existe, recibirá el enlace de recuperación." });
  }));

  router.post("/api/v1/users/reset-password", asyncHandler(async (req, res) => {
    if (!isPasswordRecoveryAvailable(deps)) {
      return sendError(
        res,
        503,
        "PASSWORD_RECOVERY_TEMPORARILY_UNAVAILABLE",
        "La recuperacion de contraseña no esta disponible temporalmente. Intente de nuevo mas tarde."
      );
    }

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Token y nueva contraseña requeridos.");
    }

    const strengthCheck = passwordStrengthSchema.safeParse(newPassword);
    if (!strengthCheck.success) {
      return sendError(res, 400, "WEAK_PASSWORD", strengthCheck.error.issues[0]?.message ?? "Contraseña débil.");
    }

    const redisKey = `${RECOVERY_KEY_PREFIX}${token}`;
    const userId = await deps.redis.get(redisKey);

    if (!userId) {
      return sendError(res, 400, "INVALID_OR_EXPIRED_TOKEN", "El token de recuperación es inválido o ha expirado.");
    }

    const user = await deps.repository.findById(userId);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "No se encontró un usuario asociado al token.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = new (await import("../../../domain/entities/User.js")).User({
      ...user,
      passwordHash
    });
    await deps.repository.save(updatedUser);

    // Invalidate the recovery token immediately
    await deps.redis.del(redisKey);

    // Flag all existing sessions as invalidated (blacklist by userId+timestamp)
    await deps.redis.set(`pwd_changed:${userId}`, Date.now().toString(), "EX", 60 * 60 * 24 * 7);

    return sendSuccess(res, { message: "La contraseña ha sido restablecida exitosamente." });
  }));

  router.get("/api/v1/users", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
    await auditGodViewAccess(req, deps.auditLogger, { serviceName: "user-service", entityName: "users" });
    const result = await deps.repository.list({ page, limit }, resolveTenantFilter(req));
    return sendPaginatedSuccess(res, result.data.map(toUserResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/users/:id", asyncHandler(async (req, res) => {
    const user = await deps.repository.findById(String(req.params.id));

    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && user.tenantId !== tenantId) {
      return sendError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado.");
    }

    return sendSuccess(res, toUserResponse(user));
  }));

  router.patch("/api/v1/users/:id", asyncHandler(async (req, res) => {
    const existing = await deps.repository.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado.");
    const updated = await deps.repository.patch(String(req.params.id), req.body as Record<string, unknown>);
    if (!updated) return sendError(res, 404, "USER_NOT_FOUND", "Usuario no encontrado.");
    return sendSuccess(res, toUserResponse(updated));
  }));

  return router;
}
