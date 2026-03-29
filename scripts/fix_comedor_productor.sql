CREATE TABLE IF NOT EXISTS comedor_productor (
    id SERIAL PRIMARY KEY,
    comedor_id INT NOT NULL REFERENCES comedor(id),
    producer_id UUID NOT NULL REFERENCES producers(id),
    producto TEXT NOT NULL,
    frecuencia TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON comedor_productor TO "777";
GRANT USAGE, SELECT ON SEQUENCE comedor_productor_id_seq TO "777";
