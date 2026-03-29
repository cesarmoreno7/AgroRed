/**
 * Vida útil estimada por tipo de producto perecedero (en horas).
 */
export const PRODUCT_SHELF_LIFE: Record<string, number> = {
  tomate: 48,
  platano: 72,
  papa: 120,
  yuca: 96,
  cebolla: 168,
  zanahoria: 144,
  lechuga: 24,
  fresa: 36,
  mango: 60,
  aguacate: 72,
  limon: 168,
  naranja: 168,
  maiz: 96,
  arveja: 48,
  habichuela: 48,
  cilantro: 24,
  default: 48
};

export function getShelfLifeHours(productName: string): number {
  const key = productName.toLowerCase().trim();
  return PRODUCT_SHELF_LIFE[key] ?? PRODUCT_SHELF_LIFE.default;
}
