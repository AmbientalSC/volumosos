/* eslint-disable camelcase */
exports.shorthands = undefined;

// Idempotente de propósito: o schema/tabela já foram criados manualmente uma vez
// no bootstrap da migração (via túnel SSH). Esta migration existe para que
// qualquer ambiente novo (dev, staging) chegue ao mesmo estado rodando `npm run migrate:up`.
exports.up = (pgm) => {
  pgm.sql('CREATE SCHEMA IF NOT EXISTS "operação"');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS "operação".records (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_firestore_id TEXT UNIQUE,
      image_key           TEXT NOT NULL,
      address             TEXT NOT NULL,
      latitude            DOUBLE PRECISION,
      longitude           DOUBLE PRECISION,
      captured_at         TIMESTAMPTZ NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by          TEXT
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_records_captured_at_desc ON "operação".records (captured_at DESC)');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_records_legacy_id ON "operação".records (legacy_firestore_id) WHERE legacy_firestore_id IS NOT NULL');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS "operação".records');
};
