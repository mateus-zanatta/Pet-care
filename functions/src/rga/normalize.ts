import {
  BR_UF,
  type BrUf,
  type RgaFieldKey,
  type RgaImportFields,
  type RgaWarningCode,
  isRgaFormatValid,
  isValidIsoDate,
  normalizeRga,
} from '@petcare/shared';
import type { RawFields } from './mapRgaFields';

/** Minúsculas e sem acentos, para comparar rótulos ("Fêmea" == "femea"). */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const MICROCHIP_REGEX = /^[A-Z0-9]{9,15}$/;

export type Normalized = {
  fields: RgaImportFields;
  confirm: RgaFieldKey[];
  warnings: RgaWarningCode[];
};

/** "dd/mm/aaaa" -> ISO, ou null se não for uma data real. */
export function parseBrDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** "Campinas - SP" -> { cidade, uf }. A UF é a última parte depois de " - ". */
export function parsePlace(text: string): { cidade?: string; uf?: BrUf } | null {
  const cleaned = text.trim();
  if (cleaned === '') return null;
  const index = cleaned.lastIndexOf(' - ');
  if (index < 0) return null;
  const cidade = cleaned.slice(0, index).trim();
  const uf = cleaned.slice(index + 3).trim().toUpperCase();
  if (!(BR_UF as readonly string[]).includes(uf)) return null;
  return { ...(cidade ? { cidade } : {}), uf: uf as BrUf };
}

/**
 * Valida e converte os valores lidos para o contrato do app (enums internos, datas ISO...).
 * Nada em português é guardado ("Felina" vira "cat").
 * CPF/CNPJ (`raw.document`) é IGNORADO de propósito: nunca sai desta função.
 */
export function normalizeRgaFields(raw: RawFields, today: string): Normalized {
  const fields: RgaImportFields = {};
  const confirm = new Set<RgaFieldKey>();
  const warnings = new Set<RgaWarningCode>();
  const flag = (key: RgaFieldKey, warning: RgaWarningCode) => {
    confirm.add(key);
    warnings.add(warning);
  };

  if (raw.name) fields.name = raw.name;

  if (raw.rga) {
    fields.rga = normalizeRga(raw.rga);
    // Só um arquivo real foi analisado: formato diferente avisa, mas NÃO bloqueia.
    if (!isRgaFormatValid(fields.rga)) flag('rga', 'rga_format');
  }

  if (raw.microchip) {
    if (fold(raw.microchip) === 'nao') {
      fields.hasMicrochip = false;
    } else {
      // Qualquer outro valor é provavelmente o número: guarda e pede confirmação.
      const number = raw.microchip.replace(/[\s.-]/g, '').toUpperCase();
      fields.hasMicrochip = true;
      fields.microchip = number;
      flag('microchip', 'microchip_confirm');
      if (!MICROCHIP_REGEX.test(number)) confirm.add('microchip');
    }
  }

  if (raw.neutered) {
    const value = fold(raw.neutered);
    if (value === 'sim') fields.neutered = 'yes';
    else if (value === 'nao') fields.neutered = 'no';
    else flag('neutered', 'value_unrecognized');
  }

  if (raw.species) {
    const value = fold(raw.species);
    if (value === 'canina') fields.species = 'dog';
    else if (value === 'felina') fields.species = 'cat';
    else flag('species', 'value_unrecognized');
  }

  if (raw.sex) {
    const value = fold(raw.sex);
    if (value === 'macho') fields.sex = 'male';
    else if (value === 'femea') fields.sex = 'female';
    else flag('sex', 'value_unrecognized');
  }

  if (raw.cor) fields.cor = raw.cor;

  // Datas: nascimento <= emissão <= hoje.
  let issuedOn: string | null = null;
  if (raw.issuedOn) {
    issuedOn = parseBrDate(raw.issuedOn);
    if (issuedOn === null || issuedOn > today) {
      flag('issuedOn', 'date_invalid');
      issuedOn = null;
    } else {
      fields.issuedOn = issuedOn;
    }
  }
  if (raw.birthDate) {
    const birth = parseBrDate(raw.birthDate);
    const upperLimit = issuedOn ?? today;
    if (birth === null || birth > upperLimit) flag('birthDate', 'date_invalid');
    else fields.birthDate = birth;
  }

  if (raw.naturalidade) {
    const place = parsePlace(raw.naturalidade);
    if (place) fields.naturalidade = place;
    else flag('naturalidade', 'place_invalid');
  }
  if (raw.local) {
    const place = parsePlace(raw.local);
    if (place) fields.issuedPlace = place;
    else flag('issuedPlace', 'place_invalid');
  }

  if (raw.tutorName) fields.tutor = { ...fields.tutor, nome: raw.tutorName };
  if (raw.phone) {
    const digits = raw.phone.replace(/\D/g, '');
    if (/^\d{10,11}$/.test(digits)) fields.tutor = { ...fields.tutor, telefone: digits };
    else flag('tutorPhone', 'phone_invalid');
  }

  return { fields, confirm: [...confirm], warnings: [...warnings] };
}
