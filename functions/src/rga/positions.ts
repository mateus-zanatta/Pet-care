/**
 * Posições (em pontos PDF, origem no canto inferior esquerdo) onde o governo imprime cada valor
 * na carteira do RG Animal (SinPatinhas), medidas em um arquivo real.
 *
 * ATENÇÃO: os RÓTULOS ("Nome do Animal", "Sexo"...) fazem parte da IMAGEM de fundo; a camada de
 * texto só tem os VALORES, fora de ordem de leitura. Por isso cada campo é identificado pela
 * POSIÇÃO, nunca por rótulo nem pela ordem.
 */
export type RawFieldKey =
  | 'name'
  | 'rga'
  | 'microchip'
  | 'neutered'
  | 'species'
  | 'birthDate'
  | 'cor'
  | 'sex'
  | 'naturalidade'
  | 'tutorName'
  | 'document' // CPF/CNPJ do responsável: lido só para ser DESCARTADO
  | 'phone'
  | 'local'
  | 'issuedOn';

export const RGA_POSITIONS: Readonly<Record<RawFieldKey, { x: number; y: number }>> = {
  name: { x: 123, y: 774.6 },
  rga: { x: 123, y: 757.6 },
  microchip: { x: 123, y: 741.6 },
  neutered: { x: 123, y: 724.6 },
  species: { x: 123, y: 707.6 },
  birthDate: { x: 123, y: 691.6 },
  cor: { x: 208, y: 724.6 },
  sex: { x: 208, y: 707.6 },
  naturalidade: { x: 208, y: 691.6 },
  tutorName: { x: 323, y: 785.6 },
  document: { x: 323, y: 771.6 },
  phone: { x: 323, y: 757.6 },
  local: { x: 323, y: 742.6 },
  issuedOn: { x: 395, y: 742.6 },
};

/** Tolerância (± pt) em x e em y. As linhas ficam a pelo menos 14 pt umas das outras. */
export const POSITION_TOLERANCE = 4;

/** Campos cujo texto pode quebrar em mais de uma linha (nomes longos). */
export const CONTINUATION_FIELDS: readonly RawFieldKey[] = ['name', 'tutorName'];
/** Distância vertical máxima (pt) abaixo do campo para considerar "linha seguinte do mesmo valor". */
export const CONTINUATION_MAX_GAP = 11;

/** A4 em pontos: o layout fixo só vale para esta página. */
export const EXPECTED_PAGE = { width: 595, height: 842, tolerance: 3 } as const;

/** O metadado "Creator" do arquivo real começa com este texto (gerado com JasperReports). */
export const EXPECTED_CREATOR_PREFIX = 'JasperReports';

/** Hosts/caminho oficiais do QR (o texto do QR não traz "https://"). */
export const SINPATINHAS_HOST = 'sinpatinhas.mma.gov.br';
export const SINPATINHAS_QR_PATH = '/validacao-qr-code';
