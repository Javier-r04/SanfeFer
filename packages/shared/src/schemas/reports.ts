import { z } from 'zod';
import { daysInRange, MAX_REPORT_DAYS, REPORT_GROUPS } from '../report-periods';
import { businessDateSchema } from './numbers';

const rangeShape = {
  from: businessDateSchema,
  to: businessDateSchema,
};

function checkRange(v: { from: string; to: string }, ctx: z.RefinementCtx) {
  if (v.from > v.to) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'La fecha final no puede ser anterior a la inicial',
    });
  } else if (daysInRange(v.from, v.to) > MAX_REPORT_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'El rango no puede ser mayor a dos años',
    });
  }
}

export const reportRangeSchema = z.object(rangeShape).superRefine(checkRange);
export type ReportRangeQuery = z.output<typeof reportRangeSchema>;

export const salesReportQuerySchema = z
  .object({
    ...rangeShape,
    groupBy: z.enum(REPORT_GROUPS, { error: 'Agrupa por día, semana o mes' }).default('day'),
  })
  .superRefine(checkRange);
export type SalesReportQuery = z.output<typeof salesReportQuerySchema>;
