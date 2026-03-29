import { Router } from "express";
import { z } from "zod";
import { LoginUser } from "../../../application/use-cases/LoginUser.js";
import { RegisterUser } from "../../../application/use-cases/RegisterUser.js";
import type { User } from "../../../domain/entities/User.js";
import type { UserRepository } from "../../../domain/ports/UserRepository.js";
import { USER_ROLES } from "../../../domain/value-objects/UserRole.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";
import { randomUUID } from "node:crypto";
import { bcrypt } from "bcrypt";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const registerUserSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(3),
  role: z.enum(USER_ROLES), // Updated to include all defined roles
  password: z.string().min(8)
});

const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const passwordRecoveryTokens = new Map<string, { userId: string; expiresAt: Date }>();

function toUserResponse(user: User) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt.toISOString()
  };
}

interface UsersRouterDeps {
  repository: UserRepository;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export function createUsersRouter(deps: UsersRouterDeps): Router {
  const router = Router();
  const registerUser = new RegisterUser(deps.repository);
  const loginUser = new LoginUser(deps.repository, deps.jwtSecret, deps.jwtExpiresIn);

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

      return sendError(res, 500, "LOGIN_FAILED", "No fue posible iniciar sesion.");
    }
  }));

  router.post("/api/v1/users/recover-password", asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await deps.repository.findByEmail(email);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "No se encontró un usuario con ese correo electrónico.");
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora de validez
    passwordRecoveryTokens.set(token, { userId: user.id, expiresAt });

    const recoveryLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Recuperación de contraseña",
      text: `Hola, ${user.fullName}. Utiliza el siguiente enlace para restablecer tu contraseña: ${recoveryLink}`
    });

    return sendSuccess(res, { message: "Se ha enviado un enlace de recuperación a su correo electrónico." });
  }));

  router.post("/api/v1/users/reset-password", asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    const recoveryData = passwordRecoveryTokens.get(token);
    if (!recoveryData || recoveryData.expiresAt < new Date()) {
      return sendError(res, 400, "INVALID_OR_EXPIRED_TOKEN", "El token de recuperación es inválido o ha expirado.");
    }

    const user = await deps.repository.findById(recoveryData.userId);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "No se encontró un usuario asociado al token.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await deps.repository.save(user);

    passwordRecoveryTokens.delete(token);

    return sendSuccess(res, { message: "La contraseña ha sido restablecida exitosamente." });
  }));

  router.get("/api/v1/users", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await deps.repository.list({ page, limit }, tenantId ?? null);
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

  return router;
}
