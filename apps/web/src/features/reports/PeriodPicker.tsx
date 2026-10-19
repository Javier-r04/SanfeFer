import {
  addDays,
  businessDateSchema,
  daysInRange,
  defaultGroupBy,
  getBusinessDate,
  matchPreset,
  MAX_REPORT_DAYS,
  presetRange,
  REPORT_GROUPS,
  REPORT_PRESET_LABELS,
  REPORT_PRESETS,
  type ReportGroupBy,
  type ReportPreset,
} from '@sanfefer/shared';
import { useSearchParams } from 'react-router';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import type { ReportRange } from './api';

const isDate = (v: string | null): v is string => !!v && businessDateSchema.safeParse(v).success;

/**
 * Periodo del reporte guardado en la URL (?from=…&to=…&groupBy=…): se puede enlazar
 * y sobrevive a recargas. Por defecto, el mes en curso.
 */
export function useReportRange() {
  const [params, setParams] = useSearchParams();
  const from = params.get('from');
  const to = params.get('to');
  const range: ReportRange =
    isDate(from) && isDate(to) && from <= to && daysInRange(from, to) <= MAX_REPORT_DAYS
      ? { from, to }
      : presetRange('month');
  const rawGroup = params.get('groupBy') as ReportGroupBy | null;
  const groupBy =
    rawGroup && REPORT_GROUPS.includes(rawGroup) ? rawGroup : defaultGroupBy(range.from, range.to);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (p) => {
        const copy = new URLSearchParams(p);
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) copy.delete(k);
          else copy.set(k, v);
        }
        return copy;
      },
      { replace: true },
    );

  return {
    range,
    groupBy,
    // Al cambiar el rango, la agrupación vuelve a la sugerida para el nuevo largo.
    setRange: (r: ReportRange) => update({ from: r.from, to: r.to, groupBy: null }),
    setGroupBy: (g: ReportGroupBy) => update({ groupBy: g }),
  };
}

export function PeriodPicker({
  range,
  onChange,
}: {
  range: ReportRange;
  onChange: (r: ReportRange) => void;
}) {
  const today = getBusinessDate();
  const preset = matchPreset(range.from, range.to, today);
  // Un rango de más de dos años se recorta desde el extremo que no se tocó.
  const commitFrom = (from: string) =>
    onChange({
      from,
      to:
        daysInRange(from, range.to) > MAX_REPORT_DAYS
          ? addDays(from, MAX_REPORT_DAYS - 1)
          : range.to,
    });
  const commitTo = (to: string) =>
    onChange({
      from:
        daysInRange(range.from, to) > MAX_REPORT_DAYS
          ? addDays(to, 1 - MAX_REPORT_DAYS)
          : range.from,
      to,
    });
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <Field label="Periodo" className="col-span-2 sm:w-56">
        {(a) => (
          <Select
            {...a}
            value={preset ?? 'custom'}
            onChange={(e) => {
              if (e.target.value !== 'custom')
                onChange(presetRange(e.target.value as ReportPreset, today));
            }}
          >
            {REPORT_PRESETS.map((p) => (
              <option key={p} value={p}>
                {REPORT_PRESET_LABELS[p]}
              </option>
            ))}
            <option value="custom" disabled={preset !== null}>
              Personalizado
            </option>
          </Select>
        )}
      </Field>
      <Field label="Desde" className="sm:w-44">
        {(a) => (
          <Input
            {...a}
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => {
              const from = e.target.value;
              if (isDate(from) && from <= range.to) commitFrom(from);
            }}
          />
        )}
      </Field>
      <Field label="Hasta" className="sm:w-44">
        {(a) => (
          <Input
            {...a}
            type="date"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(e) => {
              const to = e.target.value;
              if (isDate(to) && to >= range.from) commitTo(to);
            }}
          />
        )}
      </Field>
    </div>
  );
}
