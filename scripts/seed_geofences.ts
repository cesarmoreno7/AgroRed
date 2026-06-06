import { Pool } from "pg";
import { loadEnv } from "../apps/shared/env/loadEnv"; // Adjust if loadEnv is somewhere else, actually let's just use raw pg.

// Let's just use raw pg with dotenv to make it standalone.
import "dotenv/config";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "agrored",
  user: process.env.POSTGRES_USER || "agrored_user",
  password: process.env.POSTGRES_PASSWORD || "change_me_in_production!!",
});

async function run() {
  console.log("🌱 Insertando dos geocercas logísticas de prueba...");
  try {
    // We assume there's a tenant, let's just use a dummy one or null if not enforced, or get the first one
    const tenantRes = await pool.query(`SELECT id FROM "Tenants" LIMIT 1`);
    const tenantId = tenantRes.rows[0]?.id;

    if (!tenantId) {
      console.log("⚠️ No se encontró ningún Tenant en la base de datos. Asegúrate de correr 'npm run seed:roles' primero.");
    }

    const geofences = [
      {
        tenantId: tenantId,
        zoneName: "Punto de Acopio Central",
        zoneType: "warehouse",
        centerLat: 4.6097,
        centerLng: -74.0817,
        radiusM: 5000,
        metadata: JSON.stringify({ priority: "high", capacity: "1000kg" })
      },
      {
        tenantId: tenantId,
        zoneName: "Zona de Entrega Norte",
        zoneType: "delivery",
        centerLat: 4.6500,
        centerLng: -74.0500,
        radiusM: 2000,
        metadata: JSON.stringify({ priority: "medium" })
      }
    ];

    for (const g of geofences) {
      await pool.query(
        `INSERT INTO "Geofences" (id, "tenantId", "zoneName", "zoneType", "centerLat", "centerLng", "radiusM", metadata, "isActive", "createdAt", "updatedAt") 
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
        [g.tenantId, g.zoneName, g.zoneType, g.centerLat, g.centerLng, g.radiusM, g.metadata]
      );
    }
    console.log("✅ Dos geocercas insertadas exitosamente.");
  } catch (err) {
    console.error("❌ Error al insertar geocercas:", err);
  } finally {
    await pool.end();
  }
}

run();
