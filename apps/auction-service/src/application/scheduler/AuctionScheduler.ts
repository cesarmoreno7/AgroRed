import type { AuctionRepository } from "../../domain/ports/AuctionRepository.js";
import type { BidRepository } from "../../domain/ports/BidRepository.js";
import { CloseAuction } from "../use-cases/CloseAuction.js";
import { calculateDutchPrice } from "../algorithms/DutchAuctionAlgorithm.js";
import { calculateVisibility } from "../algorithms/VisibilityAlgorithm.js";
import { logInfo, logError } from "../../shared/logger.js";

const TICK_INTERVAL_MS = 30_000;

/**
 * Scheduler que ejecuta periódicamente:
 * 1. Cierre automático de subastas expiradas.
 * 2. Actualización de precios en subastas holandesas.
 * 3. Actualización de fases de visibilidad.
 */
export function startAuctionScheduler(
  auctionRepo: AuctionRepository,
  bidRepo: BidRepository
): NodeJS.Timeout {
  const closeAuction = new CloseAuction(auctionRepo, bidRepo);

  const tick = async () => {
    try {
      const expired = await auctionRepo.findActiveExpired();

      for (const auction of expired) {
        try {
          if (auction.auctionType === "dutch") {
            const dutch = calculateDutchPrice(auction);
            if (dutch.reachedReserve) {
              await auctionRepo.updateStatus(auction.id, "closed_no_winner");
              logInfo("scheduler.dutch_no_winner", { auctionId: auction.id });
              continue;
            }
          }

          await closeAuction.execute(auction.id);
        } catch (error) {
          logError("scheduler.close_failed", {
            auctionId: auction.id,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const activeResult = await auctionRepo.list({ page: 1, limit: 200 }, { status: "active" });

      for (const auction of activeResult.data) {
        if (auction.auctionType === "dutch") {
          const dutch = calculateDutchPrice(auction);
          if (dutch.priceChanged) {
            await auctionRepo.updateCurrentPrice(auction.id, dutch.currentPrice);
          }
          if (dutch.reachedReserve) {
            await auctionRepo.updateStatus(auction.id, "closed_no_winner");
            logInfo("scheduler.dutch_reached_reserve", { auctionId: auction.id });
          }
        }

        const visibility = calculateVisibility(auction);
        if (visibility.changed) {
          await auctionRepo.updateVisibility(auction.id, visibility.phase, visibility.radiusKm);
          logInfo("scheduler.visibility_updated", {
            auctionId: auction.id,
            phase: visibility.phase,
            radiusKm: visibility.radiusKm
          });
        }
      }
    } catch (error) {
      logError("scheduler.tick_error", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  logInfo("scheduler.started", { intervalMs: TICK_INTERVAL_MS });
  return setInterval(() => void tick(), TICK_INTERVAL_MS);
}
