import { Router } from "express";
import { z } from "zod";
import { PublishOffer } from "../../../application/use-cases/PublishOffer.js";
import { MatchOfferToDemands } from "../../../application/use-cases/MatchOfferToDemands.js";
import type { Offer } from "../../../domain/entities/Offer.js";
import type { OfferRepository } from "../../../domain/ports/OfferRepository.js";
import type { DemandQueryPort } from "../../../domain/ports/DemandQueryPort.js";
import type { NotificationPort } from "../../../domain/ports/NotificationPort.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const publishOfferSchema = z.object({
  tenantId: z.string().min(1),
  producerId: z.string().uuid(),
  title: z.string().min(3),
  productName: z.string().min(2),
  category: z.string().min(2),
  unit: z.string().min(1),
  quantityAvailable: z.coerce.number().positive(),
  priceAmount: z.coerce.number().nonnegative(),
  currency: z.string().length(3).default("COP").transform((value) => value.toUpperCase()),
  availableFrom: z.coerce.date(),
  availableUntil: z.coerce.date().optional().nullable(),
  municipalityName: z.string().min(3),
  notes: z.string().max(500).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

function toOfferResponse(offer: Offer) {
  return {
    id: offer.id,
    tenantId: offer.tenantId,
    producerId: offer.producerId,
    title: offer.title,
    productName: offer.productName,
    category: offer.category,
    unit: offer.unit,
    quantityAvailable: offer.quantityAvailable,
    priceAmount: offer.priceAmount,
    currency: offer.currency,
    availableFrom: offer.availableFrom.toISOString(),
    availableUntil: offer.availableUntil ? offer.availableUntil.toISOString() : null,
    municipalityName: offer.municipalityName,
    notes: offer.notes,
    status: offer.status,
    latitude: offer.latitude,
    longitude: offer.longitude,
    createdAt: offer.createdAt.toISOString()
  };
}

export function createOffersRouter(
  repository: OfferRepository,
  demandQuery: DemandQueryPort,
  notificationPort: NotificationPort
): Router {
  const router = Router();
  const publishOffer = new PublishOffer(repository);
  const matchOfferToDemands = new MatchOfferToDemands(demandQuery, notificationPort);

  router.post("/api/v1/offers/publish", asyncHandler(async (req, res) => {
    const parsed = publishOfferSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_OFFER_PAYLOAD", "Payload invalido para publicacion de oferta.");
    }

    try {
      const offer = await publishOffer.execute(parsed.data);

      // Matching asíncrono: buscar demandas compatibles y notificar
      const matchResult = await matchOfferToDemands.execute(offer).catch(() => null);

      return sendSuccess(res, {
        ...toOfferResponse(offer),
        matching: matchResult
          ? { searchScope: matchResult.searchScope, matchesFound: matchResult.matchesFound, notificationsSent: matchResult.notificationsSent, matches: matchResult.matches }
          : null
      }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      if (error instanceof Error && error.message === "PRODUCER_NOT_FOUND_FOR_TENANT") {
        return sendError(
          res,
          404,
          "PRODUCER_NOT_FOUND_FOR_TENANT",
          "El productor no existe para el municipio indicado."
        );
      }

      if (error instanceof Error && error.message === "INVALID_OFFER_AVAILABILITY_WINDOW") {
        return sendError(
          res,
          400,
          "INVALID_OFFER_AVAILABILITY_WINDOW",
          "La ventana de disponibilidad de la oferta no es valida."
        );
      }

      return sendError(
        res,
        500,
        "OFFER_PUBLICATION_FAILED",
        "No fue posible publicar la oferta alimentaria."
      );
    }
  }));

  router.get("/api/v1/offers", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toOfferResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/offers/:id", asyncHandler(async (req, res) => {
    const offer = await repository.findById(String(req.params.id));

    if (!offer) {
      return sendError(res, 404, "OFFER_NOT_FOUND", "Oferta no encontrada.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && offer.tenantId !== tenantId) {
      return sendError(res, 404, "OFFER_NOT_FOUND", "Oferta no encontrada.");
    }

    return sendSuccess(res, toOfferResponse(offer));
  }));

  return router;
}
