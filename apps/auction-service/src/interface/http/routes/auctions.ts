import { Router } from "express";
import { z } from "zod";
import { PublishAuction } from "../../../application/use-cases/PublishAuction.js";
import { PlaceBid } from "../../../application/use-cases/PlaceBid.js";
import { AcceptDutchPrice } from "../../../application/use-cases/AcceptDutchPrice.js";
import { CloseAuction } from "../../../application/use-cases/CloseAuction.js";
import { calculateAEA } from "../../../application/algorithms/AgroMatchAlgorithm.js";
import { calculateDutchPrice } from "../../../application/algorithms/DutchAuctionAlgorithm.js";
import { calculateVisibility } from "../../../application/algorithms/VisibilityAlgorithm.js";
import type { Auction } from "../../../domain/entities/Auction.js";
import type { Bid } from "../../../domain/entities/Bid.js";
import type { AuctionRepository } from "../../../domain/ports/AuctionRepository.js";
import type { BidRepository } from "../../../domain/ports/BidRepository.js";
import { AUCTION_TYPES } from "../../../domain/value-objects/AuctionType.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

// ── Zod Schemas ──────────────────────────────────────────────────────────

const publishAuctionSchema = z.object({
  tenantId: z.string().min(1),
  producerId: z.string().uuid(),
  productName: z.string().min(2),
  category: z.string().min(2),
  unit: z.string().min(1),
  quantityKg: z.coerce.number().positive(),
  photoUrl: z.string().url().optional().nullable(),
  harvestDate: z.coerce.date(),
  auctionType: z.enum(AUCTION_TYPES),
  basePrice: z.coerce.number().positive(),
  reservePrice: z.coerce.number().nonnegative(),
  currency: z.string().length(3).default("COP").transform((v) => v.toUpperCase()),
  durationMinutes: z.coerce.number().int().min(120).max(1440),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  municipalityName: z.string().min(3),
  dutchStepPercent: z.coerce.number().min(1).max(50).optional().nullable(),
  dutchStepMinutes: z.coerce.number().int().min(1).max(60).optional().nullable()
});

const placeBidSchema = z.object({
  bidderId: z.string().uuid(),
  bidderType: z.string().min(2),
  amount: z.coerce.number().positive(),
  maxProxyAmount: z.coerce.number().positive().optional().nullable(),
  socialScore: z.coerce.number().min(0).max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

const acceptDutchSchema = z.object({
  bidderId: z.string().uuid(),
  bidderType: z.string().min(2),
  acceptedPrice: z.coerce.number().positive(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

const rankingQuerySchema = z.object({
  buyerLatitude: z.coerce.number().min(-90).max(90),
  buyerLongitude: z.coerce.number().min(-180).max(180),
  buyerScore: z.coerce.number().min(0).max(100).default(50),
  logisticsAvailability: z.coerce.number().min(0).max(100).default(50)
});

// ── Response mappers ─────────────────────────────────────────────────────

function toAuctionResponse(a: Auction) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    producerId: a.producerId,
    productName: a.productName,
    category: a.category,
    unit: a.unit,
    quantityKg: a.quantityKg,
    photoUrl: a.photoUrl,
    harvestDate: a.harvestDate.toISOString(),
    shelfLifeHours: a.shelfLifeHours,
    auctionType: a.auctionType,
    basePrice: a.basePrice,
    reservePrice: a.reservePrice,
    currency: a.currency,
    durationMinutes: a.durationMinutes,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    currentPrice: a.currentPrice,
    visibilityPhase: a.visibilityPhase,
    visibilityRadiusKm: a.visibilityRadiusKm,
    latitude: a.latitude,
    longitude: a.longitude,
    municipalityName: a.municipalityName,
    extensionCount: a.extensionCount,
    maxExtensions: a.maxExtensions,
    dutchStepPercent: a.dutchStepPercent,
    dutchStepMinutes: a.dutchStepMinutes,
    winnerId: a.winnerId,
    winnerPrice: a.winnerPrice,
    remainingMinutes: a.remainingMinutes,
    isUrgent: a.isUrgent,
    status: a.status,
    createdAt: a.createdAt.toISOString()
  };
}

function toBidResponse(b: Bid) {
  return {
    id: b.id,
    auctionId: b.auctionId,
    bidderId: b.bidderId,
    bidderType: b.bidderType,
    amount: b.amount,
    isProxy: b.isProxy,
    socialScore: b.socialScore,
    status: b.status,
    createdAt: b.createdAt.toISOString()
  };
}

// ── Router factory ───────────────────────────────────────────────────────

export function createAuctionsRouter(
  auctionRepo: AuctionRepository,
  bidRepo: BidRepository
): Router {
  const router = Router();
  const publishAuction = new PublishAuction(auctionRepo);
  const placeBid = new PlaceBid(auctionRepo, bidRepo);
  const acceptDutchPrice = new AcceptDutchPrice(auctionRepo, bidRepo);
  const closeAuction = new CloseAuction(auctionRepo, bidRepo);

  // ── POST /api/v1/auctions/publish ───────────────────────────────────
  router.post("/api/v1/auctions/publish", asyncHandler(async (req, res) => {
    const parsed = publishAuctionSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_AUCTION_PAYLOAD", "Payload invalido para publicacion de subasta.");
    }

    try {
      const auction = await publishAuction.execute(parsed.data);
      return sendSuccess(res, toAuctionResponse(auction), 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "TENANT_NOT_FOUND") return sendError(res, 404, msg, "Municipio o tenant no encontrado.");
      if (msg === "INVALID_HARVEST_DATE") return sendError(res, 400, msg, "Fecha de cosecha invalida.");
      if (msg === "INVALID_DURATION") return sendError(res, 400, msg, "Duracion debe estar entre 2 y 24 horas.");
      if (msg === "INVALID_BASE_PRICE") return sendError(res, 400, msg, "Precio base debe ser positivo.");
      if (msg === "INVALID_RESERVE_PRICE") return sendError(res, 400, msg, "Precio de reserva invalido.");
      return sendError(res, 500, "AUCTION_PUBLISH_FAILED", "No fue posible publicar la subasta.");
    }
  }));

  // ── GET /api/v1/auctions ────────────────────────────────────────────
  router.get("/api/v1/auctions", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const filters: Record<string, string | undefined> = {
      status: req.query.status as string | undefined,
      auctionType: req.query.auctionType as string | undefined,
      producerId: req.query.producerId as string | undefined,
      municipalityName: req.query.municipalityName as string | undefined,
      tenantId
    };
    const result = await auctionRepo.list({ page, limit }, filters as any);
    return sendPaginatedSuccess(res, result.data.map(toAuctionResponse), {
      total: result.total, page: result.page, limit: result.limit
    });
  }));

  // ── GET /api/v1/auctions/ranking ───────────────────────────────────
  router.get("/api/v1/auctions/ranking", asyncHandler(async (req, res) => {
    const parsed = rankingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_RANKING_QUERY", "Parametros de ranking invalidos.");
    }

    const activeAuctions = await auctionRepo.list({ page: 1, limit: 100 }, { status: "active" });

    const ranked = activeAuctions.data
      .map((auction) => {
        const result = calculateAEA({
          auction,
          buyerLatitude: parsed.data.buyerLatitude,
          buyerLongitude: parsed.data.buyerLongitude,
          buyerScore: parsed.data.buyerScore,
          logisticsAvailability: parsed.data.logisticsAvailability
        });
        return { ...toAuctionResponse(auction), aeaScore: result };
      })
      .sort((a, b) => b.aeaScore.score - a.aeaScore.score);

    return sendSuccess(res, ranked);
  }));

  // ── GET /api/v1/auctions/:id ────────────────────────────────────────
  router.get("/api/v1/auctions/:id", asyncHandler(async (req, res) => {
    const auction = await auctionRepo.findById(String(req.params.id));
    if (!auction) return sendError(res, 404, "AUCTION_NOT_FOUND", "Subasta no encontrada.");

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && auction.tenantId !== tenantId) {
      return sendError(res, 404, "AUCTION_NOT_FOUND", "Subasta no encontrada.");
    }

    const response = toAuctionResponse(auction);

    if (auction.auctionType === "dutch" && (auction.status === "active" || auction.status === "extended")) {
      const dutchPrice = calculateDutchPrice(auction);
      Object.assign(response, {
        dutchCurrentPrice: dutchPrice.currentPrice,
        dutchStepNumber: dutchPrice.stepNumber,
        dutchReachedReserve: dutchPrice.reachedReserve
      });
    }

    const visibility = calculateVisibility(auction);
    Object.assign(response, {
      currentVisibilityPhase: visibility.phase,
      currentVisibilityRadiusKm: visibility.radiusKm
    });

    return sendSuccess(res, response);
  }));

  // ── POST /api/v1/auctions/:id/bid ──────────────────────────────────
  router.post("/api/v1/auctions/:id/bid", asyncHandler(async (req, res) => {
    const parsed = placeBidSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_BID_PAYLOAD", "Payload invalido para la puja.");
    }

    try {
      const result = await placeBid.execute({
        auctionId: String(req.params.id),
        ...parsed.data
      });

      return sendSuccess(res, {
        bid: toBidResponse(result.bid),
        antiSnipingTriggered: result.antiSnipingTriggered,
        newEndsAt: result.newEndsAt?.toISOString() ?? null,
        proxyBidsTriggered: result.proxyBidsTriggered
      }, 201);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "AUCTION_NOT_FOUND") return sendError(res, 404, msg, "Subasta no encontrada.");
      if (msg === "AUCTION_NOT_ACTIVE") return sendError(res, 409, msg, "La subasta no esta activa.");
      if (msg === "AUCTION_EXPIRED") return sendError(res, 410, msg, "La subasta ha expirado.");
      if (msg === "PRODUCER_CANNOT_BID") return sendError(res, 403, msg, "El productor no puede pujar en su propia subasta.");
      if (msg === "BID_TOO_LOW") return sendError(res, 400, msg, "La puja debe ser mayor que la puja actual mas alta.");
      return sendError(res, 500, "BID_FAILED", "No fue posible registrar la puja.");
    }
  }));

  // ── POST /api/v1/auctions/:id/accept-dutch ─────────────────────────
  router.post("/api/v1/auctions/:id/accept-dutch", asyncHandler(async (req, res) => {
    const parsed = acceptDutchSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_ACCEPT_PAYLOAD", "Payload invalido para aceptar precio holandesa.");
    }

    try {
      await acceptDutchPrice.execute({
        auctionId: String(req.params.id),
        ...parsed.data
      });
      return sendSuccess(res, { message: "Precio aceptado. Subasta cerrada con ganador." });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "AUCTION_NOT_FOUND") return sendError(res, 404, msg, "Subasta no encontrada.");
      if (msg === "NOT_DUTCH_AUCTION") return sendError(res, 400, msg, "Esta subasta no es de tipo holandesa.");
      if (msg === "AUCTION_NOT_ACTIVE") return sendError(res, 409, msg, "La subasta no esta activa.");
      if (msg === "AUCTION_EXPIRED") return sendError(res, 410, msg, "La subasta ha expirado.");
      if (msg === "PRODUCER_CANNOT_BID") return sendError(res, 403, msg, "El productor no puede aceptar su propia subasta.");
      if (msg === "PRICE_BELOW_RESERVE") return sendError(res, 400, msg, "El precio esta por debajo del minimo de reserva.");
      return sendError(res, 500, "ACCEPT_FAILED", "No fue posible aceptar el precio.");
    }
  }));

  // ── GET /api/v1/auctions/:id/bids ──────────────────────────────────
  router.get("/api/v1/auctions/:id/bids", asyncHandler(async (req, res) => {
    const bids = await bidRepo.findByAuction(String(req.params.id));
    return sendSuccess(res, bids.map(toBidResponse));
  }));

  // ── POST /api/v1/auctions/:id/close ────────────────────────────────
  router.post("/api/v1/auctions/:id/close", asyncHandler(async (req, res) => {
    try {
      const result = await closeAuction.execute(String(req.params.id));
      return sendSuccess(res, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "AUCTION_NOT_FOUND") return sendError(res, 404, msg, "Subasta no encontrada.");
      if (msg === "AUCTION_ALREADY_CLOSED") return sendError(res, 409, msg, "La subasta ya esta cerrada.");
      return sendError(res, 500, "CLOSE_FAILED", "No fue posible cerrar la subasta.");
    }
  }));

  return router;
}
