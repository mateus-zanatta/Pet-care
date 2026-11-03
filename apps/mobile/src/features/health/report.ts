import {
  type HealthEvent,
  type Medication,
  type Pet,
  type TimelineItem,
  type Vaccine,
  buildTimeline,
} from '@petcare/shared';
import { formatIsoDate } from '@/core/dates';
import { optionalModule } from '@/core/native/optionalModule';
import { formatAge } from '@/features/pets/format';
import { frequencySummary } from '@/features/medications/format';

/**
 * PDF do histórico de saúde para levar ao veterinário.
 * PRIVACIDADE: leva só dados do ANIMAL e os registros de saúde. Não inclui dados do tutor (nome, telefone,
 * endereço), nem a foto, nem o conteúdo dos anexos (só a quantidade). Todo texto digitado é ESCAPADO.
 */

export type ReportInput = {
  pet: Pet;
  medications: readonly Medication[];
  vaccines: readonly Vaccine[];
  events: readonly HealthEvent[];
  /** Data de geração, ISO `YYYY-MM-DD`. */
  generatedOn: string;
  locale: 'pt-BR' | 'en';
};

/** `t('ns:chave', opções)`: o `t` do i18next com o prefixo do namespace na chave. */
export type ReportT = (key: string, options?: Record<string, unknown>) => string;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

const STYLE = `
  @page { margin: 18mm 14mm; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #0f6b5c; color: #0f6b5c; }
  .muted { color: #555; }
  .notice { margin-top: 10px; padding: 8px 10px; background: #f1f5f4; border-left: 3px solid #0f6b5c; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 5px 6px; border-bottom: 1px solid #ddd; }
  th { background: #f6f6f6; font-size: 11px; }
  dl { display: grid; grid-template-columns: 30% 70%; gap: 3px 10px; margin: 0; }
  dt { color: #555; }
  dd { margin: 0; }
  tr { page-break-inside: avoid; }
`;

function row(cells: (string | null | undefined)[]): string {
  return `<tr>${cells.map((c) => `<td>${c ? e(c) : '&nbsp;'}</td>`).join('')}</tr>`;
}

function section(title: string, body: string): string {
  return `<h2>${e(title)}</h2>${body}`;
}

function table(headers: string[], rows: string[]): string {
  return `<table><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function vetText(vet: { name?: string; crmvNumber?: string; crmvUf?: string } | undefined, t: ReportT): string {
  if (!vet) return '';
  const crmv = vet.crmvNumber ? t('health:detail.crmv', { number: vet.crmvNumber, uf: vet.crmvUf ?? '' }) : '';
  return [vet.name, crmv].filter(Boolean).join(' · ');
}

function petSection(input: ReportInput, t: ReportT): string {
  const { pet, locale } = input;
  const items: [string, string | null | undefined][] = [
    [t('health:report.name'), pet.name],
    [t('health:report.species'), t(`pets:species.${pet.species}`)],
    [t('health:report.breed'), pet.breed],
    [t('health:report.sex'), t(`pets:sex.${pet.sex}`)],
    [t('health:report.neutered'), t(`pets:tristate.${pet.neutered}`)],
    [t('health:report.birth'), pet.birthDate ? formatIsoDate(pet.birthDate, locale) : null],
    [t('health:report.age'), formatAge(pet, ((key: string, o?: Record<string, unknown>) => t(`pets:${key}`, o)) as never, input.generatedOn)],
    [t('health:report.weight'), pet.weightKg !== undefined ? `${String(pet.weightKg).replace('.', locale === 'en' ? '.' : ',')} kg` : null],
    [t('health:report.microchip'), pet.microchip],
    [t('health:report.rga'), pet.rga],
    [t('health:report.allergies'), pet.allergies],
    [t('health:report.notes'), pet.notes],
  ];
  const shown = items.filter(([, value]) => value);
  return section(t('health:report.pet'), `<dl>${shown.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(String(v))}</dd>`).join('')}</dl>`);
}

function medicationsSection(input: ReportInput, t: ReportT): string {
  const { medications, locale } = input;
  const title = t('health:report.medications');
  if (medications.length === 0) return section(title, `<p class="muted">${e(t('health:report.medicationsEmpty'))}</p>`);

  const rank = (s: string) => (s === 'active' ? 0 : s === 'suspended' ? 1 : 2);
  const sorted = [...medications].sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));
  const rows = sorted.map((m) => {
    const dose = `${m.dose.amount} ${m.dose.unit} · ${t(`meds:route.${m.dose.route}`)}`;
    const period = m.endDate
      ? t('meds:detail.periodEnds', { start: formatIsoDate(m.startDate, locale), end: formatIsoDate(m.endDate, locale) })
      : t('meds:detail.periodContinuous', { start: formatIsoDate(m.startDate, locale) });
    const frequency = frequencySummary(m.frequency, ((key: string, o?: Record<string, unknown>) => t(`meds:${key}`, o)) as never);
    return row([m.name, dose, frequency, period, t(`meds:status.${m.status}`), vetText(m.vet, t), m.notes]);
  });
  return section(
    title,
    table(
      [t('health:report.name'), t('health:report.dose'), t('health:report.frequency'), t('health:report.period'), t('health:report.status'), t('health:report.vet'), t('health:report.notes')],
      rows,
    ),
  );
}

function vaccinesSection(input: ReportInput, t: ReportT): string {
  const { vaccines, locale } = input;
  const title = t('health:report.vaccines');
  if (vaccines.length === 0) return section(title, `<p class="muted">${e(t('health:report.vaccinesEmpty'))}</p>`);
  const sorted = [...vaccines].sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || a.id.localeCompare(b.id));
  const rows = sorted.map((v) =>
    row([
      v.name,
      formatIsoDate(v.appliedOn, locale),
      v.nextDoseOn ? formatIsoDate(v.nextDoseOn, locale) : null,
      v.batch,
      vetText(v.vet, t),
      v.clinic,
    ]),
  );
  return section(
    title,
    table(
      [t('health:report.name'), t('health:report.appliedOn'), t('health:report.nextDose'), t('health:report.batch'), t('health:report.vet'), t('health:report.clinic')],
      rows,
    ),
  );
}

function timelineSection(input: ReportInput, t: ReportT): string {
  const { events, locale } = input;
  const title = t('health:report.timeline');
  if (events.length === 0) return section(title, `<p class="muted">${e(t('health:report.timelineEmpty'))}</p>`);
  const items = buildTimeline([], events).filter((i): i is Extract<TimelineItem, { kind: 'event' }> => i.kind === 'event');
  const byId = new Map(events.map((ev) => [ev.id, ev]));
  const rows = items.map((item) => {
    const ev = byId.get(item.id)!;
    const count = ev.attachments?.length ?? 0;
    return row([
      formatIsoDate(ev.date, locale),
      t(`health:eventType.${ev.type}`),
      ev.title,
      ev.description,
      ev.nextDate ? formatIsoDate(ev.nextDate, locale) : null,
      [vetText(ev.vet, t), ev.clinic].filter(Boolean).join(' · '),
      count > 0 ? t('health:report.withAttachments', { count }) : null,
    ]);
  });
  return section(
    title,
    table(
      [t('health:report.date'), t('health:report.type'), t('health:report.name'), t('health:report.description'), t('health:report.next'), t('health:report.vet'), ''],
      rows,
    ),
  );
}

/** Documento HTML completo (será convertido em PDF). */
export function buildHealthReportHtml(input: ReportInput, t: ReportT): string {
  const lang = input.locale === 'en' ? 'en' : 'pt-BR';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${e(t('health:report.title'))} - ${e(input.pet.name)}</title><style>${STYLE}</style></head><body>
<h1>${e(t('health:report.title'))}: ${e(input.pet.name)}</h1>
<div class="muted">${e(t('health:report.generatedOn', { date: formatIsoDate(input.generatedOn, input.locale) }))}</div>
<div class="notice">${e(t('health:report.notice'))}</div>
${petSection(input, t)}
${medicationsSection(input, t)}
${vaccinesSection(input, t)}
${timelineSection(input, t)}
</body></html>`;
}

/* ------------------------------ PDF e compartilhamento ------------------------------ */

type PrintModule = typeof import('expo-print');
type SharingModule = typeof import('expo-sharing');

// Módulos nativos carregados com tolerância: um build antigo do app continua abrindo.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tolerante, de propósito
const printModule = optionalModule<PrintModule>(() => require('expo-print'), 'expo-print');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tolerante, de propósito
const sharingModule = optionalModule<SharingModule>(() => require('expo-sharing'), 'expo-sharing');

export const isPdfExportAvailable = (): boolean => printModule !== null && sharingModule !== null;

/**
 * Gera o PDF e abre a folha de compartilhamento do sistema (WhatsApp, e-mail, salvar...).
 * Só compartilha quando a pessoa escolhe um destino. Devolve `unavailable` se este build não tiver os módulos.
 */
export async function exportHealthReport(input: ReportInput, t: ReportT): Promise<'shared' | 'unavailable'> {
  if (!printModule || !sharingModule) return 'unavailable';
  const html = buildHealthReportHtml(input, t);
  const { uri } = await printModule.printToFileAsync({ html });
  if (!(await sharingModule.isAvailableAsync())) return 'unavailable';
  await sharingModule.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('health:report.title') });
  return 'shared';
}
