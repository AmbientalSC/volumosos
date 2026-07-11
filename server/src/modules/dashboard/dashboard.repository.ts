import { pool } from '../../db/pool.js';
import { RECORDS_TABLE } from '../../db/schema.js';

export interface DashboardMetrics {
  hoje: number;
  semana: number;
  mes: number;
  total: number;
}

export interface BairroCount {
  name: string;
  count: number;
}

export interface MonthlyCount {
  name: string;
  total: number;
}

// Replica o parse client-side original: 3º segmento de um endereço "rua, numero, bairro (referencia)".
const BAIRRO_EXPR = `NULLIF(trim(split_part(split_part(address, ',', 3), '(', 1)), '')`;

export async function getMetrics(): Promise<DashboardMetrics> {
  const { rows } = await pool.query<{ hoje: string; semana: string; mes: string; total: string }>(`
    SELECT
      count(*) FILTER (WHERE captured_at >= date_trunc('day', now())) AS hoje,
      count(*) FILTER (WHERE captured_at >= date_trunc('week', now())) AS semana,
      count(*) FILTER (WHERE captured_at >= date_trunc('month', now())) AS mes,
      count(*) AS total
    FROM ${RECORDS_TABLE}
  `);
  const row = rows[0];
  return {
    hoje: Number(row.hoje),
    semana: Number(row.semana),
    mes: Number(row.mes),
    total: Number(row.total),
  };
}

export async function getBairros(): Promise<BairroCount[]> {
  const { rows } = await pool.query<{ name: string; count: string }>(`
    SELECT ${BAIRRO_EXPR} AS name, count(*) AS count
    FROM ${RECORDS_TABLE}
    WHERE ${BAIRRO_EXPR} IS NOT NULL AND length(${BAIRRO_EXPR}) < 40
    GROUP BY 1
    ORDER BY count DESC
  `);
  return rows.map((row) => ({ name: row.name, count: Number(row.count) }));
}

export async function getMonthly(): Promise<MonthlyCount[]> {
  const { rows } = await pool.query<{ month: Date; total: string }>(`
    SELECT date_trunc('month', captured_at) AS month, count(*) AS total
    FROM ${RECORDS_TABLE}
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 6
  `);
  return rows
    .map((row) => ({ month: row.month, total: Number(row.total) }))
    .sort((a, b) => a.month.getTime() - b.month.getTime())
    .map((row) => {
      const monthName = row.month.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      return {
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        total: row.total,
      };
    });
}
