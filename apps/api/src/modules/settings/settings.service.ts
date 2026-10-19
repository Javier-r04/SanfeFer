import type { Setting } from '@prisma/client';
import { settingsSchema, type SettingsDto, type SettingsInput } from '@sanfefer/shared';
import { prisma } from '../../lib/prisma';

/** Fila única de configuración; se crea con los valores por defecto si aún no existe. */
export async function getSettingsRow(): Promise<Setting> {
  return prisma.setting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export function toSettingsDto(s: Setting): SettingsDto {
  const printer = (s.printerConfig ?? {}) as { paperWidth?: number };
  return {
    businessName: s.businessName,
    address: s.address,
    phone: s.phone,
    taxId: s.taxId,
    ticketFooter: s.ticketFooter,
    serviceChargeRate: Number(s.serviceChargeRate),
    serviceChargeByDefault: s.serviceChargeByDefault,
    allowNegativeStock: s.allowNegativeStock,
    paperWidth: printer.paperWidth === 58 ? 58 : 80,
  };
}

export async function getSettings() {
  return toSettingsDto(await getSettingsRow());
}

export async function updateSettings(raw: SettingsInput) {
  const { paperWidth, ...input } = settingsSchema.parse(raw);
  const current = await getSettingsRow();
  const printer = {
    ...((current.printerConfig ?? {}) as object),
    ...(paperWidth ? { paperWidth } : {}),
  };
  const updated = await prisma.setting.update({
    where: { id: 1 },
    data: { ...input, printerConfig: printer },
  });
  return toSettingsDto(updated);
}
