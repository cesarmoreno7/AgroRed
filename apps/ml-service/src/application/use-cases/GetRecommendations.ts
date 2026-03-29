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

    if (scores.supplyCoverageScore < 50) {
      recommendations.push({
        priority: "high",
        actionCode: "activate_supply",
        title: "Activar oferta complementaria",
        rationale: "La cobertura actual de inventario no alcanza la demanda abierta del territorio."
      });
    }

    if (inputs.scheduledLogistics === 0 && inputs.openDemandUnits > 0) {
      recommendations.push({
        priority: "high",
        actionCode: "schedule_logistics",
        title: "Programar operacion logistica",
        rationale: "Hay demanda abierta sin operaciones logisticas programadas para atenderla."
      });
    }

    if (inputs.openIncidents > 0) {
      recommendations.push({
        priority: this.resolveIncidentPriority(report.classification),
        actionCode: "stabilize_operations",
        title: "Estabilizar operacion territorial",
        rationale: "Existen incidencias abiertas que afectan la continuidad del abastecimiento y la entrega."
      });
    }

    if (inputs.pendingNotifications > 0) {
      recommendations.push({
        priority: "medium",
        actionCode: "dispatch_notifications",
        title: "Despachar notificaciones pendientes",
        rationale: "Hay alertas pendientes de entrega a actores clave del flujo operativo."
      });
    }

    if (inputs.reservedInventoryUnits > inputs.availableInventoryUnits) {
      recommendations.push({
        priority: "medium",
        actionCode: "rebalance_inventory",
        title: "Rebalancear inventario",
        rationale: "El inventario reservado supera el disponible y puede tensionar el cumplimiento de la demanda."
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        actionCode: "maintain_monitoring",
        title: "Mantener monitoreo operativo",
        rationale: "Los indicadores actuales no muestran tension critica; conviene sostener seguimiento preventivo."
      });
    }

    return recommendations;
  }

  private resolveIncidentPriority(classification: MlDecisionSupportReport["classification"]): MlRecommendationPriority {
    return classification === "critical" ? "high" : "medium";
  }
}