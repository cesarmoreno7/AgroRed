-- Migration: Add geographic coordinates to all operational entities
-- Enables full geospatial tracking across the AgroRed supply chain

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) NULL;

ALTER TABLE public.producers
  ADD CONSTRAINT chk_producer_coordinates_pair
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  ADD CONSTRAINT chk_producer_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT chk_producer_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) NULL;

ALTER TABLE public.offers
  ADD CONSTRAINT chk_offer_coordinates_pair
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  ADD CONSTRAINT chk_offer_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT chk_offer_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.rescues
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) NULL;

ALTER TABLE public.rescues
  ADD CONSTRAINT chk_rescue_coordinates_pair
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  ADD CONSTRAINT chk_rescue_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT chk_rescue_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) NULL;

ALTER TABLE public.demands
  ADD CONSTRAINT chk_demand_coordinates_pair
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  ADD CONSTRAINT chk_demand_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT chk_demand_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) NULL;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT chk_inventory_coordinates_pair
    CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
  ADD CONSTRAINT chk_inventory_latitude_range
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT chk_inventory_longitude_range
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.logistics_orders
  ADD COLUMN IF NOT EXISTS origin_latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS origin_longitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS destination_latitude NUMERIC(9,6) NULL,
  ADD COLUMN IF NOT EXISTS destination_longitude NUMERIC(9,6) NULL;

ALTER TABLE public.logistics_orders
  ADD CONSTRAINT chk_logistics_origin_coordinates_pair
    CHECK ((origin_latitude IS NULL AND origin_longitude IS NULL) OR (origin_latitude IS NOT NULL AND origin_longitude IS NOT NULL)),
  ADD CONSTRAINT chk_logistics_origin_latitude_range
    CHECK (origin_latitude IS NULL OR (origin_latitude >= -90 AND origin_latitude <= 90)),
  ADD CONSTRAINT chk_logistics_origin_longitude_range
    CHECK (origin_longitude IS NULL OR (origin_longitude >= -180 AND origin_longitude <= 180)),
  ADD CONSTRAINT chk_logistics_destination_coordinates_pair
    CHECK ((destination_latitude IS NULL AND destination_longitude IS NULL) OR (destination_latitude IS NOT NULL AND destination_longitude IS NOT NULL)),
  ADD CONSTRAINT chk_logistics_destination_latitude_range
    CHECK (destination_latitude IS NULL OR (destination_latitude >= -90 AND destination_latitude <= 90)),
  ADD CONSTRAINT chk_logistics_destination_longitude_range
    CHECK (destination_longitude IS NULL OR (destination_longitude >= -180 AND destination_longitude <= 180));
