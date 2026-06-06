import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "agrored",
  user: process.env.POSTGRES_USER || "777",
  password: process.env.POSTGRES_PASSWORD || "777",
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("🚛 Insertando 12 vehículos de prueba...");
  try {
    const tenantRes = await pool.query(`SELECT id FROM public.tenants LIMIT 1`);
    const tenantId = tenantRes.rows[0]?.id;

    if (!tenantId) {
      console.log("⚠️ No se encontró ningún Tenant en la BD.");
      return;
    }

    const recursos = [
      { id: "11111111-1111-1111-1111-111111111111", nombre: "Camión Furgón 1", tipo: "vehiculo", placa: "ABC-123", telefono: "3001234567", estado: "en_ruta" },
      { id: "22222222-2222-2222-2222-222222222222", nombre: "Dron Logístico D1", tipo: "otro", placa: "DRON-01", telefono: null, estado: "en_ruta" },
      { id: "33333333-3333-3333-3333-333333333333", nombre: "Moto Reparto Centro", tipo: "moto", placa: "XYZ-987", telefono: "3109876543", estado: "en_ruta" },
      { id: "44444444-4444-4444-4444-444444444444", nombre: "Bicicleta Ecológica", tipo: "bicicleta", placa: "BICI-01", telefono: "3154445555", estado: "en_ruta" },
      { id: "55555555-5555-5555-5555-555555555555", nombre: "Camioneta 4x4", tipo: "vehiculo", placa: "LMN-456", telefono: "3201112222", estado: "en_ruta" },
      { id: "66666666-6666-6666-6666-666666666666", nombre: "Camión Refrigerado Norte", tipo: "vehiculo", placa: "OPQ-789", telefono: "3112223333", estado: "en_ruta" },
      { id: "77777777-7777-7777-7777-777777777777", single: false, nombre: "Domiciliario a Pie", tipo: "domiciliario", placa: "DOMI-01", telefono: "3145556666", estado: "en_ruta" },
      { id: "88888888-8888-8888-8888-888888888888", nombre: "Dron Logístico D2", tipo: "otro", placa: "DRON-02", telefono: null, estado: "en_ruta" },
      { id: "99999999-9999-9999-9999-999999999999", nombre: "Moto Express Sur", tipo: "moto", placa: "RST-321", telefono: "3123334444", estado: "en_ruta" },
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", nombre: "Van de Carga Ligera", tipo: "vehiculo", placa: "UVW-654", telefono: "3198887777", estado: "en_ruta" },
      { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", nombre: "Bicicleta Eléctrica", tipo: "bicicleta", placa: "BICI-02", telefono: "3187776666", estado: "en_ruta" },
      { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", nombre: "Tractomula Pesada", tipo: "vehiculo", placa: "ZAB-987", telefono: "3051112222", estado: "en_ruta" },
    ];

    for (const r of recursos) {
      await pool.query(
        `INSERT INTO public.recursos (id, tenant_id, nombre, tipo, placa, telefono, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, placa = EXCLUDED.placa, telefono = EXCLUDED.telefono, estado = EXCLUDED.estado, deleted_at = NULL`,
        [r.id, tenantId, r.nombre, r.tipo, r.placa, r.telefono, r.estado]
      );
    }

    console.log("📡 Insertando posiciones de prueba...");
    const tracking = [
      { recurso_id: recursos[0].id, latitude: 4.6097, longitude: -74.0817, velocidad: 45, orden_id: null },
      { recurso_id: recursos[1].id, latitude: 4.6500, longitude: -74.0500, velocidad: 60, orden_id: null },
      { recurso_id: recursos[2].id, latitude: 4.6200, longitude: -74.0700, velocidad: 35, orden_id: null },
      { recurso_id: recursos[3].id, latitude: 4.6400, longitude: -74.0600, velocidad: 15, orden_id: null },
      { recurso_id: recursos[4].id, latitude: 4.6700, longitude: -74.0400, velocidad: 50, orden_id: null },
      { recurso_id: recursos[5].id, latitude: 4.7000, longitude: -74.0300, velocidad: 40, orden_id: null },
      { recurso_id: recursos[6].id, latitude: 4.6150, longitude: -74.0750, velocidad: 5, orden_id: null },
      { recurso_id: recursos[7].id, latitude: 4.7100, longitude: -74.0200, velocidad: 65, orden_id: null },
      { recurso_id: recursos[8].id, latitude: 4.5800, longitude: -74.1000, velocidad: 38, orden_id: null },
      { recurso_id: recursos[9].id, latitude: 4.6800, longitude: -74.0550, velocidad: 42, orden_id: null },
      { recurso_id: recursos[10].id, latitude: 4.6300, longitude: -74.0800, velocidad: 20, orden_id: null },
      { recurso_id: recursos[11].id, latitude: 4.5500, longitude: -74.1500, velocidad: 55, orden_id: null },
    ];

    for (const t of tracking) {
      await pool.query(
        `INSERT INTO public.tracking_actual (recurso_id, latitude, longitude, velocidad, orden_id, actualizado_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (recurso_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, velocidad = EXCLUDED.velocidad, actualizado_at = NOW()`,
        [t.recurso_id, t.latitude, t.longitude, t.velocidad, t.orden_id]
      );
      // Also update resources with current latitude/longitude to match production logic
      await pool.query(
        `UPDATE public.recursos SET latitude = $2, longitude = $3 WHERE id = $1`,
        [t.recurso_id, t.latitude, t.longitude]
      );
    }

    console.log("✅ Datos de flota insertados exitosamente.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await pool.end();
  }
}

run();
