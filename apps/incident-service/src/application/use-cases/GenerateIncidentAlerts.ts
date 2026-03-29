import { randomUUID } from "node:crypto";
import type { IncidentRepository, IncidentAlert } from "../../domain/ports/IncidentRepository.js";

/** Default threshold values (used when no tenant-specific config exists). */
const DEFAULTS: Record<string, number> = {
  "incident.zone_min_count": 3,
  "incident.zone_high_count": 5,
  "incident.zone_window_hours": 48,
  "incident.unattended_hours": 24,
  "incident.unattended_high_count": 5,
};

/**
 * Scans recent incidents and generates alerts using per-tenant thresholds.
 * Falls back to defaults when a tenant has not configured custom values.
 */
export class GenerateIncidentAlerts {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(tenantId: string): Promise<IncidentAlert[]> {
    const generated: IncidentAlert[] = [];

    // Load per-tenant thresholds
    const thresholds = await this.repository.getAlertThresholds(tenantId);
    const t = (key: string): number => {
      const found = thresholds.find(th => th.ruleKey === key);
      return found ? found.value : (DEFAULTS[key] ?? 0);
    };

    const zoneMinCount = t("incident.zone_min_count");
    const zoneHighCount = t("incident.zone_high_count");
    const zoneWindowHours = t("incident.zone_window_hours");
    const unattendedHours = t("incident.unattended_hours");
    const unattendedHighCount = t("incident.unattended_high_count");

    // Rule 1: Multiple incidents in same zone
    const zoneCounts = await this.repository.countRecentByZone(tenantId, zoneWindowHours);
    for (const zone of zoneCounts) {
      if (zone.count >= zoneMinCount) {
        const alert = this.buildAlert(tenantId, {
          alertType: "multiple_incidents_zone",
          severity: zone.count >= zoneHighCount ? "high" : "medium",
          title: `Multiples incidencias en ${zone.zone}`,
          description: `Se han registrado ${zone.count} incidencias en las ultimas ${zoneWindowHours}h en la zona ${zone.zone}.`,
          zoneName: zone.zone,
          incidentCount: zone.count,
        });
        await this.repository.saveAlert(alert);
        generated.push(alert);
      }
    }

    // Rule 2: Critical risk — zones with critical-severity incidents
    for (const zone of zoneCounts) {
      if (zone.criticalCount > 0) {
        const alert = this.buildAlert(tenantId, {
          alertType: "critical_risk",
          severity: "high",
          title: `Riesgo critico en ${zone.zone}`,
          description: `Existen ${zone.criticalCount} incidencias de severidad critica en ${zone.zone}.`,
          zoneName: zone.zone,
          incidentCount: zone.criticalCount,
        });
        await this.repository.saveAlert(alert);
        generated.push(alert);
      }
    }

    // Rule 3: Unattended timeout
    const unattendedCount = await this.repository.countUnattended(tenantId, unattendedHours);
    if (unattendedCount > 0) {
      const alert = this.buildAlert(tenantId, {
        alertType: "unattended_timeout",
        severity: unattendedCount >= unattendedHighCount ? "high" : "medium",
        title: "Incidencias sin atender",
        description: `${unattendedCount} incidencias llevan mas de ${unattendedHours} horas sin ser atendidas.`,
        zoneName: null,
        incidentCount: unattendedCount,
      });
      await this.repository.saveAlert(alert);
      generated.push(alert);
    }

    return generated;
  }

  private buildAlert(
    tenantId: string,
    params: {
      alertType: string;
      severity: string;
      title: string;
      description: string;
      zoneName: string | null;
      incidentCount: number;
    }
  ): IncidentAlert {
    return {
      id: randomUUID(),
      tenantId,
      alertType: params.alertType,
      severity: params.severity,
      title: params.title,
      description: params.description,
      zoneName: params.zoneName,
      incidentCount: params.incidentCount,
      isAcknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      metadata: {},
      createdAt: new Date(),
    };
  }
}
