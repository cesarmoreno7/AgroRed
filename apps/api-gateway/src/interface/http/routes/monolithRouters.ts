import type { Express } from "express";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import type { AppEnv } from "../../../config/env.js";
import { logError, logInfo, logWarn } from "../../../shared/logger.js";

// ── Shared infrastructure ──
import { EventBus } from "../../../../../shared/redis/EventBus.js";
import { RedisCache } from "../../../../../shared/redis/RedisCache.js";
import { createRedisConnection } from "../../../../../shared/redis/RedisClient.js";

// ── User service ──
import { PostgresUserRepository } from "../../../../../user-service/src/infrastructure/repositories/PostgresUserRepository.js";
import { createUsersRouter } from "../../../../../user-service/src/interface/http/routes/users.js";

// ── Producer service ──
import { PostgresProducerRepository } from "../../../../../producer-service/src/infrastructure/repositories/PostgresProducerRepository.js";
import { createProducersRouter } from "../../../../../producer-service/src/interface/http/routes/producers.js";

// ── Offer service ──
import { PostgresOfferRepository } from "../../../../../offer-service/src/infrastructure/repositories/PostgresOfferRepository.js";
import { PostgresDemandQueryAdapter } from "../../../../../offer-service/src/infrastructure/adapters/PostgresDemandQueryAdapter.js";
import { createOffersRouter } from "../../../../../offer-service/src/interface/http/routes/offers.js";
import { createProductsRouter } from "../../../../../offer-service/src/interface/http/routes/products.js";
import { createAuditLogger as createOfferAuditLogger } from "../../../../../offer-service/src/shared/audit.js";
import type { NotificationPort, OfferMatchNotificationParams } from "../../../../../offer-service/src/domain/ports/NotificationPort.js";

// ── Rescue service ──
import { PostgresRescueRepository } from "../../../../../rescue-service/src/infrastructure/repositories/PostgresRescueRepository.js";
import { createRescuesRouter } from "../../../../../rescue-service/src/interface/http/routes/rescues.js";
import { createAuditLogger as createRescueAuditLogger } from "../../../../../rescue-service/src/shared/audit.js";

// ── Demand service ──
import { PostgresDemandRepository } from "../../../../../demand-service/src/infrastructure/repositories/PostgresDemandRepository.js";
import { createDemandsRouter } from "../../../../../demand-service/src/interface/http/routes/demands.js";
import { createAuditLogger as createDemandAuditLogger } from "../../../../../demand-service/src/shared/audit.js";

// ── Inventory service ──
import { PostgresInventoryItemRepository } from "../../../../../inventory-service/src/infrastructure/repositories/PostgresInventoryItemRepository.js";
import { createInventoryRouter } from "../../../../../inventory-service/src/interface/http/routes/inventory.js";

// ── Logistics service ──
import { PostgresLogisticsOrderRepository } from "../../../../../logistics-service/src/infrastructure/repositories/PostgresLogisticsOrderRepository.js";
import { PostgresTrackingRepository } from "../../../../../logistics-service/src/infrastructure/repositories/PostgresTrackingRepository.js";
import { PostgresRoutePlanRepository } from "../../../../../logistics-service/src/infrastructure/repositories/PostgresRoutePlanRepository.js";
import { OsrmRoutingService } from "../../../../../logistics-service/src/infrastructure/services/OsrmRoutingService.js";
import { createLogisticsRouter } from "../../../../../logistics-service/src/interface/http/routes/logistics.js";
import { createTrackingRouter } from "../../../../../logistics-service/src/interface/http/routes/tracking.js";
import { createRoutePlanningRouter } from "../../../../../logistics-service/src/interface/http/routes/routePlanning.js";
import { createAuditLogger as createLogisticsAuditLogger } from "../../../../../logistics-service/src/shared/audit.js";

// ── Incident service ──
import { PostgresIncidentRepository } from "../../../../../incident-service/src/infrastructure/repositories/PostgresIncidentRepository.js";
import { createIncidentsRouter } from "../../../../../incident-service/src/interface/http/routes/incidents.js";
import { createAuditLogger as createIncidentAuditLogger } from "../../../../../incident-service/src/shared/audit.js";

// ── Notification service ──
import { PostgresNotificationRepository } from "../../../../../notification-service/src/infrastructure/repositories/PostgresNotificationRepository.js";
import { SmtpEmailSender } from "../../../../../notification-service/src/infrastructure/email/SmtpEmailSender.js";
import { createNotificationsRouter } from "../../../../../notification-service/src/interface/http/routes/notifications.js";
import { createNotificationQueue, createNotificationWorker } from "../../../../../notification-service/src/infrastructure/queue/NotificationQueue.js";

// ── Analytics service ──
import { PostgresAnalyticsRepository } from "../../../../../analytics-service/src/infrastructure/repositories/PostgresAnalyticsRepository.js";
import { PostgresMapRepository } from "../../../../../analytics-service/src/infrastructure/repositories/PostgresMapRepository.js";
import { PostgresInstitutionalRepository } from "../../../../../analytics-service/src/infrastructure/repositories/PostgresInstitutionalRepository.js";
import { createAnalyticsRouter } from "../../../../../analytics-service/src/interface/http/routes/analytics.js";
import { createMapRouter } from "../../../../../analytics-service/src/interface/http/routes/map.js";
import { createInstitutionalRouter } from "../../../../../analytics-service/src/interface/http/routes/institutional.js";
import { createOriginsRouter } from "../../../../../analytics-service/src/interface/http/routes/origins.js";
import { createIratRouter } from "../../../../../analytics-service/src/interface/http/routes/irat.js";

// ── ML service ──
import { PostgresDecisionSupportRepository } from "../../../../../ml-service/src/infrastructure/repositories/PostgresDecisionSupportRepository.js";
import { createMlRouter } from "../../../../../ml-service/src/interface/http/routes/ml.js";

// ── Automation service ──
import { PostgresAutomationRepository } from "../../../../../automation-service/src/infrastructure/repositories/PostgresAutomationRepository.js";
import { createAutomationRouter } from "../../../../../automation-service/src/interface/http/routes/automation.js";
import { createAutomationQueue, createAutomationWorker } from "../../../../../automation-service/src/infrastructure/queue/AutomationQueue.js";
import { scheduleAutomationFlows } from "../../../../../automation-service/src/infrastructure/queue/ScheduledFlows.js";

// ── Auction service ──
import { PostgresAuctionRepository } from "../../../../../auction-service/src/infrastructure/repositories/PostgresAuctionRepository.js";
import { PostgresBidRepository } from "../../../../../auction-service/src/infrastructure/repositories/PostgresBidRepository.js";
import { createAuctionsRouter } from "../../../../../auction-service/src/interface/http/routes/auctions.js";
import { startAuctionScheduler } from "../../../../../auction-service/src/application/scheduler/AuctionScheduler.js";

// ── Institution service ──
import { PostgresInstitutionRepository } from "../../../../../institution-service/src/infrastructure/repositories/PostgresInstitutionRepository.js";
import { createInstitutionsRouter } from "../../../../../institution-service/src/interface/http/routes/institutions.js";

// ── Location service ──
import {
  PostgresDepartamentoRepository,
  PostgresMunicipioRepository,
  PostgresCorregimientoRepository,
  PostgresVeredaRepository
} from "../../../../../location-service/src/infrastructure/repositories/PostgresLocationRepositories.js";
import { createLocationsRouter } from "../../../../../location-service/src/interface/http/routes/locations.js";

// ── Delivery service ──
import { createDeliveriesRouter } from "../../../../../delivery-service/src/interface/http/routes/deliveries.js";

// In-process notification adapter: offer match notifications are available
// directly via the notification routes; no HTTP hop needed.
class NullNotificationAdapter implements NotificationPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async registerOfferMatchNotification(_params: OfferMatchNotificationParams): Promise<void> {}
}

async function supportsBullMq(redisUrl: string): Promise<boolean> {
  const probe = createRedisConnection({ url: redisUrl, maxRetriesPerRequest: null });
  try {
    const info = await probe.info("server");
    const versionLine = info.split("\n").find((l) => l.startsWith("redis_version:"));
    const major = versionLine ? parseInt(versionLine.split(":")[1]?.split(".")[0] ?? "0", 10) : 0;
    return major >= 5;
  } finally {
    await probe.quit();
  }
}

let _cleanup: (() => Promise<void>) | null = null;

export async function cleanupMonolith(): Promise<void> {
  if (_cleanup) await _cleanup();
}

export async function registerMonolithRouters(
  app: Express,
  pool: Pool,
  redis: Redis | undefined,
  env: AppEnv
): Promise<void> {
  const cleanupTasks: Array<() => Promise<void>> = [];

  // ── Redis caches ──
  let analyticsCache: RedisCache | undefined;
  let mlCache: RedisCache | undefined;

  if (redis) {
    try {
      analyticsCache = new RedisCache(redis, "analytics");
      mlCache = new RedisCache(redis, "ml");
      logInfo("monolith.redis_caches.enabled", {});
    } catch (error) {
      logWarn("monolith.redis_caches.disabled", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ── Event buses ──
  let offerEventBus: EventBus | null = null;
  let rescueEventBus: EventBus | null = null;
  let auctionEventBus: EventBus | null = null;

  if (redis) {
    try {
      offerEventBus = new EventBus(env.REDIS_URL);
      rescueEventBus = new EventBus(env.REDIS_URL);
      auctionEventBus = new EventBus(env.REDIS_URL);

      // Analytics event bus subscribes to domain events to invalidate cache
      if (analyticsCache) {
        const analyticsEventBus = new EventBus(env.REDIS_URL);
        const invalidate = async (): Promise<void> => {
          await analyticsCache!.invalidatePattern("summary:*");
          await analyticsCache!.invalidatePattern("overview:*");
        };
        await analyticsEventBus.subscribe("offer.published", () => void invalidate());
        await analyticsEventBus.subscribe("rescue.created", () => void invalidate());
        await analyticsEventBus.subscribe("auction.closed", () => void invalidate());
        cleanupTasks.push(async () => { await analyticsEventBus.close(); });
      }

      cleanupTasks.push(async () => {
        await offerEventBus?.close();
        await rescueEventBus?.close();
        await auctionEventBus?.close();
      });

      logInfo("monolith.event_buses.enabled", {});
    } catch (error) {
      offerEventBus = null;
      rescueEventBus = null;
      auctionEventBus = null;
      logWarn("monolith.event_buses.disabled", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ── BullMQ workers (notification + automation) ──
  if (redis && await supportsBullMq(env.REDIS_URL)) {
    const smtpSenderForQueue = new SmtpEmailSender({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM
    });

    // Notification worker
    try {
      const qRedis = createRedisConnection({ url: env.REDIS_URL, maxRetriesPerRequest: null });
      const wRedis = createRedisConnection({ url: env.REDIS_URL, maxRetriesPerRequest: null });
      const notifQueue = createNotificationQueue(qRedis);
      const notifWorker = createNotificationWorker({
        redis: wRedis,
        repository: new PostgresNotificationRepository(pool),
        sender: smtpSenderForQueue
      });
      await notifQueue.waitUntilReady();
      await notifWorker.waitUntilReady();
      logInfo("monolith.notification_worker.started", {});
      cleanupTasks.push(async () => {
        await notifWorker.close();
        await notifQueue.close();
        await qRedis.quit();
        await wRedis.quit();
      });
    } catch (error) {
      logError("monolith.notification_worker.failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }

    // Automation worker
    try {
      const qRedis = createRedisConnection({ url: env.REDIS_URL, maxRetriesPerRequest: null });
      const wRedis = createRedisConnection({ url: env.REDIS_URL, maxRetriesPerRequest: null });
      const automQueue = createAutomationQueue(qRedis);
      const automWorker = createAutomationWorker({
        redis: wRedis,
        repository: new PostgresAutomationRepository(pool)
      });
      await automQueue.waitUntilReady();
      await automWorker.waitUntilReady();
      await scheduleAutomationFlows(automQueue);
      logInfo("monolith.automation_worker.started", {});
      cleanupTasks.push(async () => {
        await automWorker.close();
        await automQueue.close();
        await qRedis.quit();
        await wRedis.quit();
      });
    } catch (error) {
      logError("monolith.automation_worker.failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ── Auction scheduler ──
  const auctionRepo = new PostgresAuctionRepository(pool);
  const bidRepo = new PostgresBidRepository(pool);
  const schedulerInterval = startAuctionScheduler(auctionRepo, bidRepo);
  cleanupTasks.push(async () => { clearInterval(schedulerInterval); });

  // ── Mount service routers ──

  // User (auth, profiles)
  app.use(createUsersRouter({
    repository: new PostgresUserRepository(pool),
    redis,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    emailUser: env.EMAIL_USER,
    emailPass: env.EMAIL_PASS,
    frontendUrl: env.FRONTEND_URL
  }));

  // Producer
  app.use(createProducersRouter(new PostgresProducerRepository(pool)));

  // Offer + Products catalog
  const offerAuditLogger = createOfferAuditLogger(pool);
  app.use(createOffersRouter(
    new PostgresOfferRepository(pool),
    new PostgresDemandQueryAdapter(pool),
    new NullNotificationAdapter(),
    offerEventBus,
    offerAuditLogger
  ));
  app.use(createProductsRouter(pool));

  // Rescue
  app.use(createRescuesRouter(
    new PostgresRescueRepository(pool),
    rescueEventBus,
    createRescueAuditLogger(pool)
  ));

  // Demand
  app.use(createDemandsRouter(new PostgresDemandRepository(pool), createDemandAuditLogger(pool)));

  // Inventory
  app.use(createInventoryRouter(new PostgresInventoryItemRepository(pool)));

  // Logistics (tracking + route-planning must precede generic orders to avoid path shadowing)
  const logisticsAuditLogger = createLogisticsAuditLogger(pool);
  const osrmRouting = new OsrmRoutingService(env.OSRM_URL);
  app.use(createTrackingRouter(new PostgresTrackingRepository(pool), logisticsAuditLogger));
  app.use(createRoutePlanningRouter(new PostgresRoutePlanRepository(pool), osrmRouting));
  app.use(createLogisticsRouter(new PostgresLogisticsOrderRepository(pool), logisticsAuditLogger));

  // Incident
  app.use(createIncidentsRouter(new PostgresIncidentRepository(pool), createIncidentAuditLogger(pool)));

  // Notification
  const smtpSender = new SmtpEmailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM
  });
  app.use(createNotificationsRouter(new PostgresNotificationRepository(pool), smtpSender));

  // Analytics (map, institutional, origins, IRAT)
  app.use(createAnalyticsRouter(new PostgresAnalyticsRepository(pool), analyticsCache));
  app.use(createMapRouter(new PostgresMapRepository(pool)));
  app.use(createInstitutionalRouter(new PostgresInstitutionalRepository(pool)));
  app.use(createOriginsRouter(pool));
  app.use(createIratRouter(pool));

  // ML / Decision support
  app.use(createMlRouter(new PostgresDecisionSupportRepository(pool), mlCache));

  // Automation
  app.use(createAutomationRouter(new PostgresAutomationRepository(pool)));

  // Auction
  app.use(createAuctionsRouter(auctionRepo, bidRepo, auctionEventBus));

  // Institution
  app.use(createInstitutionsRouter(new PostgresInstitutionRepository(pool)));

  // Location (departamentos, municipios, corregimientos, veredas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(createLocationsRouter(
    new PostgresDepartamentoRepository(pool),
    new PostgresMunicipioRepository(pool),
    new PostgresCorregimientoRepository(pool),
    new PostgresVeredaRepository(pool)
  ) as any);

  // Delivery (entregas de productos)
  app.use(createDeliveriesRouter(pool));

  logInfo("monolith.routers.registered", { services: 17 });

  _cleanup = async () => {
    await Promise.allSettled(cleanupTasks.map((fn) => fn()));
  };
}
