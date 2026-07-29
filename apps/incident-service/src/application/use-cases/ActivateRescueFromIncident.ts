import type { Incident } from "../../domain/entities/Incident.js";
import type { ProducerRepository } from "../../../../producer-service/src/domain/ports/ProducerRepository.js";
import type { OfferRepository } from "../../../../offer-service/src/domain/ports/OfferRepository.js";
import { RegisterRescue } from "../../../../rescue-service/src/application/use-cases/RegisterRescue.js";
import type { RescueRepository } from "../../../../rescue-service/src/domain/ports/RescueRepository.js";
import { logError, logInfo } from "../../shared/logger.js";

export interface ActivateRescueFromIncidentDeps {
  producerRepository: ProducerRepository;
  offerRepository: OfferRepository;
  rescueRepository: RescueRepository;
}

export type AutoRescueActivationResult =
  | { triggered: true; rescueId: string; offerId: string }
  | { triggered: false; reason: "INCIDENT_TYPE_NOT_ELIGIBLE" | "REPORTER_NOT_A_PRODUCER" | "NO_ACTIVE_OFFER_FOUND" | "ACTIVATION_FAILED" };

/** Incident types where food is at imminent risk of being lost — the only ones that warrant auto-activating a rescue. */
const RESCUE_ELIGIBLE_INCIDENT_TYPES = new Set(["desperdicio_alimentario", "inseguridad_alimentaria"]);

const RESCUE_PICKUP_WINDOW_HOURS = 2;

/**
 * Bug #12 — "no existe activación automática de rescate desde una incidencia":
 * the only existing bridge (trigger-logistics) created a logistics order, not
 * a rescues row, and depended on an HTTP call to LOGISTICS_SERVICE_URL that
 * isn't running in the monolith. This activates a real rescue in-process,
 * sourced from the reporting producer's latest active offer so the product,
 * category, unit and quantity are real data — never invented.
 *
 * Deliberately conservative: it only acts when the incident was reported by
 * a real producer (reportedBy matches a producer's user id) who has an
 * active offer to link. Otherwise nothing is fabricated and no rescue fires.
 */
export async function activateRescueFromIncident(
  incident: Incident,
  deps: ActivateRescueFromIncidentDeps
): Promise<AutoRescueActivationResult> {
  if (!RESCUE_ELIGIBLE_INCIDENT_TYPES.has(incident.incidentType)) {
    return { triggered: false, reason: "INCIDENT_TYPE_NOT_ELIGIBLE" };
  }

  if (!incident.reportedBy) {
    return { triggered: false, reason: "REPORTER_NOT_A_PRODUCER" };
  }

  const producer = await deps.producerRepository.findByUserId(incident.reportedBy);
  if (!producer) {
    return { triggered: false, reason: "REPORTER_NOT_A_PRODUCER" };
  }

  const offer = await deps.offerRepository.findLatestActiveByProducerId(producer.id, incident.tenantId);
  if (!offer) {
    return { triggered: false, reason: "NO_ACTIVE_OFFER_FOUND" };
  }

  try {
    const registerRescue = new RegisterRescue(deps.rescueRepository);
    const scheduledAt = new Date(Date.now() + RESCUE_PICKUP_WINDOW_HOURS * 60 * 60 * 1000);

    const rescue = await registerRescue.execute({
      tenantId: incident.tenantId,
      producerId: producer.id,
      offerId: offer.id,
      rescueChannel: "food_bank",
      destinationOrganizationName: "Banco de Alimentos Municipal",
      productName: offer.productName,
      category: offer.category,
      unit: offer.unit,
      quantityRescued: offer.quantityAvailable,
      scheduledAt,
      beneficiaryCount: incident.affectedPopulation > 0 ? incident.affectedPopulation : 1,
      municipalityName: incident.municipalityName,
      latitude: incident.latitude,
      longitude: incident.longitude,
      notes: `Rescate activado automáticamente desde incidencia ${incident.id} (${incident.incidentType}).`
    });

    logInfo("incident.auto_rescue_activated", { incidentId: incident.id, rescueId: rescue.id, producerId: producer.id, offerId: offer.id });

    return { triggered: true, rescueId: rescue.id, offerId: offer.id };
  } catch (error) {
    logError("incident.auto_rescue_activation_failed", {
      incidentId: incident.id,
      message: error instanceof Error ? error.message : String(error)
    });
    return { triggered: false, reason: "ACTIVATION_FAILED" };
  }
}
