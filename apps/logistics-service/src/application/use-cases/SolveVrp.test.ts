import { SolveVrp } from "./SolveVrp.js";

describe("SolveVrp – Clarke-Wright multi-vehicle", () => {
  const solver = new SolveVrp(null); // no OSRM, haversine fallback

  const baseParams = {
    tenantId: "t1",
    scenarioName: "Test VRP",
    depotLat: 4.711,
    depotLng: -74.072,
  };

  const vehicles = [
    { id: "v1", label: "Camión A", capacityKg: 500 },
    { id: "v2", label: "Camión B", capacityKg: 500 },
    { id: "v3", label: "Moto C", capacityKg: 100 },
  ];

  const stops = [
    { id: "s1", latitude: 4.72, longitude: -74.08, loadKg: 200, locationName: "Punto 1" },
    { id: "s2", latitude: 4.73, longitude: -74.06, loadKg: 150, locationName: "Punto 2" },
    { id: "s3", latitude: 4.75, longitude: -74.09, loadKg: 80, locationName: "Punto 3" },
    { id: "s4", latitude: 4.69, longitude: -74.05, loadKg: 50, locationName: "Punto 4" },
    { id: "s5", latitude: 4.70, longitude: -74.10, loadKg: 300, locationName: "Punto 5" },
  ];

  it("solves VRP and distributes stops across vehicles", async () => {
    const result = await solver.execute({ ...baseParams, vehicles, stops });

    expect(result.status).toBe("solved");
    expect(result.strategy).toBe("clarke_wright");
    expect(result.routingEngine).toBe("haversine");
    expect(result.totalVehiclesUsed).toBeGreaterThanOrEqual(1);
    expect(result.totalVehiclesUsed).toBeLessThanOrEqual(vehicles.length);
    expect(result.totalDistanceKm).toBeGreaterThan(0);
    expect(result.totalDurationMin).toBeGreaterThan(0);
    expect(result.vehicleRoutes.length).toBeGreaterThanOrEqual(1);
    expect(result.unservedStops).toBe(0);

    // All stops should be assigned
    const allAssigned = result.vehicleRoutes.flatMap(r => r.stops.map(s => s.id));
    expect(allAssigned.sort()).toEqual(["s1", "s2", "s3", "s4", "s5"]);

    // No vehicle should exceed capacity
    for (const route of result.vehicleRoutes) {
      expect(route.assignedLoadKg).toBeLessThanOrEqual(route.capacityKg);
    }
  });

  it("reports unserved stops when vehicles cannot handle load", async () => {
    const tinyVehicles = [
      { id: "v1", label: "Mini", capacityKg: 50 },
    ];
    const bigStops = [
      { id: "s1", latitude: 4.72, longitude: -74.08, loadKg: 200, locationName: "Heavy" },
    ];

    const result = await solver.execute({
      ...baseParams,
      vehicles: tinyVehicles,
      stops: bigStops,
    });

    expect(result.unservedStops).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("throws NO_VEHICLES when empty", async () => {
    await expect(
      solver.execute({ ...baseParams, vehicles: [], stops })
    ).rejects.toThrow("NO_VEHICLES");
  });

  it("throws NO_STOPS when empty", async () => {
    await expect(
      solver.execute({ ...baseParams, vehicles, stops: [] })
    ).rejects.toThrow("NO_STOPS");
  });

  it("handles single stop correctly", async () => {
    const singleStop = [
      { id: "s1", latitude: 4.72, longitude: -74.08, loadKg: 100, locationName: "Solo" },
    ];

    const result = await solver.execute({ ...baseParams, vehicles, stops: singleStop });

    expect(result.status).toBe("solved");
    expect(result.totalVehiclesUsed).toBe(1);
    expect(result.vehicleRoutes[0].stops.length).toBe(1);
    expect(result.unservedStops).toBe(0);
  });

  it("produces a valid UUID id", async () => {
    const result = await solver.execute({ ...baseParams, vehicles, stops });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
