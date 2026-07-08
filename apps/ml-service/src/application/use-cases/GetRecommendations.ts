import type {
  MlDecisionSupportReport,
  MlRecommendation,
  MlRecommendationsReport,
  MlRecommendationPriority
} from "../../domain/models/DecisionSupport.js";
import type { DecisionSupportRepository } from "../../domain/ports/DecisionSupportRepository.js";

export class GetRecommendations {
  constructor(private readonly repository: DecisionSupportRepository) {}

  async execute(tenantKey?: string | null): Promise<MlRecommendationsReport> {
    const report = await this.repository.getDecisionSupport(tenantKey ?? null);

    return {
      tenantId: report.tenantId,
      tenantCode: report.tenantCode,
      tenantName: report.tenantName,
      modelVersion: report.modelVersion,
      classification: report.classification,
      recommendations: this.buildRecommendations(report),
      generatedAt: new Date().toISOString()
    };
  }

  private buildRecommendations(report: MlDecisionSupportReport): MlRecommendation[] {
    const recommendations: MlRecommendation[] = [];
    const { inputs, scores } = report;
    const loc = report.tenantName ? `en el área de ${report.tenantName}` : "en el territorio";

    if (scores.supplyCoverageScore < 50) {
      recommendations.push({
        priority: "high",
        actionCode: "activate_supply",
        title: "Activar oferta complementaria",
        rationale: `Se ha detectado escasez de inventario ${loc}. Solo se cuenta con ${inputs.availableInventoryUnits} unidades disponibles para una demanda abierta de ${inputs.openDemandUnits}. Contacta a productores de la zona de inmediato.`
      });
    }

    if (inputs.scheduledLogistics === 0 && inputs.openDemandUnits > 0) {
      recommendations.push({
        priority: "high",
        actionCode: "schedule_logistics",
        title: "Programar operacion logistica",
        rationale: `Existen ${inputs.openDemandUnits} pedidos pendientes sin transporte asignado ${loc}. Asigna vehículos a las rutas de entrega para evitar retrasos en los comedores/instituciones.`
      });
    }

    if (inputs.openIncidents > 0) {
      recommendations.push({
        priority: this.resolveIncidentPriority(report.classification),
        actionCode: "stabilize_operations",
        title: "Estabilizar operacion territorial",
        rationale: `Hay ${inputs.openIncidents} incidentes (como bloqueos de vías o clima adverso) reportados ${loc}. Desvía los vehículos o avisa a las instituciones destinatarias.`
      });
    }

    if (inputs.pendingNotifications > 0) {
      recommendations.push({
        priority: "medium",
        actionCode: "dispatch_notifications",
        title: "Despachar notificaciones pendientes",
        rationale: `Existen ${inputs.pendingNotifications} alertas pendientes de entrega a conductores o instituciones ${loc}. Revisa los canales de SMS/Email para mantener la coordinación.`
      });
    }

    if (scores.trendScore < 40) {
      recommendations.push({
        priority: scores.trendScore < 25 ? "high" : "medium",
        actionCode: "worsening_trend",
        title: "Revisar tendencia de oferta-demanda",
        rationale: `En los últimos 30 días la demanda ${loc} creció más rápido que la oferta ` +
          `(${inputs.demandsLast30} demandas nuevas vs. ${inputs.offersLast30} ofertas nuevas, ` +
          `frente a ${inputs.demandsPrior30} y ${inputs.offersPrior30} en el período previo). ` +
          `Conviene anticipar la captación de más productores antes de que la brecha se agrave.`
      });
    }

    if (inputs.reservedInventoryUnits > inputs.availableInventoryUnits) {
      recommendations.push({
        priority: "medium",
        actionCode: "rebalance_inventory",
        title: "Rebalancear inventario",
        rationale: `El inventario reservado (${inputs.reservedInventoryUnits}) supera el inventario físicamente disponible (${inputs.availableInventoryUnits}) ${loc}. Ajusta el inventario o cancela reservas no críticas.`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        actionCode: "maintain_monitoring",
        title: "Mantener monitoreo operativo",
        rationale: `Los indicadores actuales ${loc} no muestran tensión crítica. Se sugiere sostener un seguimiento preventivo de la flota y el inventario.`
      });
    }

    return recommendations;
  }

  private resolveIncidentPriority(classification: MlDecisionSupportReport["classification"]): MlRecommendationPriority {
    return classification === "critical" ? "high" : "medium";
  }
}