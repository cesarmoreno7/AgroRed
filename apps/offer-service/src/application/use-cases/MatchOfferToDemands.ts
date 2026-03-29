import type { Offer } from "../../domain/entities/Offer.js";
import type { DemandQueryPort } from "../../domain/ports/DemandQueryPort.js";
import type { NotificationPort } from "../../domain/ports/NotificationPort.js";
import { OfferDemandMatcher, type OfferDemandMatch } from "../../domain/services/OfferDemandMatcher.js";
import { logInfo, logError } from "../../shared/logger.js";

export interface MatchResult {
  offerId: string;
  matchesFound: number;
  notificationsSent: number;
  searchScope: "local" | "regional";
  matches: Array<{
    demandId: string;
    organizationName: string;
    demandChannel: string;
    municipalityName: string;
    score: number;
    reasons: string[];
  }>;
}

export class MatchOfferToDemands {
  private readonly matcher = new OfferDemandMatcher();

  constructor(
    private readonly demandQuery: DemandQueryPort,
    private readonly notificationPort: NotificationPort
  ) {}

  async execute(offer: Offer): Promise<MatchResult> {
    // Fase 1: buscar demandas en el mismo municipio de la oferta
    let demands = await this.demandQuery.findOpenDemandsByCategory(
      offer.tenantId,
      offer.category,
      offer.municipalityName
    );
    let matches = this.matcher.match(offer, demands);
    let searchScope: "local" | "regional" = "local";

    // Fase 2: si no hay coincidencias locales, expandir a otros municipios
    if (matches.length === 0) {
      demands = await this.demandQuery.findOpenDemandsByCategory(
        offer.tenantId,
        offer.category
      );
      matches = this.matcher.match(offer, demands);
      searchScope = "regional";

      logInfo("offer.matching.expanded_to_regional", {
        offerId: offer.id,
        originMunicipality: offer.municipalityName,
        demandsFound: demands.length,
        matchesFound: matches.length
      });
    }

    logInfo("offer.matching.completed", {
      offerId: offer.id,
      category: offer.category,
      searchScope,
      demandsEvaluated: demands.length,
      matchesFound: matches.length
    });

    let notificationsSent = 0;

    for (const match of matches) {
      try {
        await this.sendMatchNotification(offer, match);
        notificationsSent++;
      } catch (error) {
        logError("offer.matching.notification_failed", {
          offerId: offer.id,
          demandId: match.demand.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      offerId: offer.id,
      matchesFound: matches.length,
      notificationsSent,
      searchScope,
      matches: matches.map((m) => ({
        demandId: m.demand.id,
        organizationName: m.demand.organizationName,
        demandChannel: m.demand.demandChannel,
        municipalityName: m.demand.municipalityName,
        score: m.score,
        reasons: m.reasons
      }))
    };
  }

  private async sendMatchNotification(offer: Offer, match: OfferDemandMatch): Promise<void> {
    const channelLabel = this.translateChannel(match.demand.demandChannel);
    const title = `Oferta disponible: ${offer.productName} — ${offer.quantityAvailable} ${offer.unit}`;
    const message = [
      `Se ha publicado una oferta que coincide con la demanda de "${match.demand.organizationName}" (${channelLabel}).`,
      match.demand.municipalityName !== offer.municipalityName
        ? `Nota: La oferta proviene de ${offer.municipalityName} — no se encontraron necesidades locales, se expandió la búsqueda a otros municipios.`
        : "",
      ``,
      `Producto ofertado: ${offer.productName} (${offer.category})`,
      `Cantidad disponible: ${offer.quantityAvailable} ${offer.unit}`,
      `Precio: $${offer.priceAmount.toLocaleString("es-CO")} ${offer.currency}`,
      `Municipio de origen: ${offer.municipalityName}`,
      `Disponible desde: ${offer.availableFrom.toISOString().split("T")[0]}`,
      offer.availableUntil ? `Disponible hasta: ${offer.availableUntil.toISOString().split("T")[0]}` : "",
      ``,
      `Demanda registrada: ${match.demand.productName} — ${match.demand.quantityRequired} ${match.demand.unit}`,
      `Municipio de destino: ${match.demand.municipalityName}`,
      `Beneficiarios: ${match.demand.beneficiaryCount}`,
      `Fecha limite: ${match.demand.neededBy.toISOString().split("T")[0]}`,
      ``,
      `Puntuacion de coincidencia: ${match.score}/100`,
      `Razones: ${match.reasons.join("; ")}`
    ].filter(Boolean).join("\n");

    await this.notificationPort.registerOfferMatchNotification({
      tenantId: offer.tenantId,
      offerId: offer.id,
      recipientLabel: `${match.demand.organizationName} (${channelLabel})`,
      title,
      message
    });
  }

  private translateChannel(channel: string): string {
    const labels: Record<string, string> = {
      community_kitchen: "Comedor Comunitario",
      school_program: "Programa PAE",
      social_program: "Programa Social",
      emergency_response: "Respuesta de Emergencia"
    };
    return labels[channel] ?? channel;
  }
}
