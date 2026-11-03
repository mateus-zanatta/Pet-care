import { describe, expect, it } from 'vitest';
import { mapRgaFields } from './mapRgaFields';
import { RGA_POSITIONS } from './positions';
import type { TextItem } from './textItems';

/** Itens com valores FICTÍCIOS exatamente nas posições da tabela. */
const at = (key: keyof typeof RGA_POSITIONS, text: string, dx = 0, dy = 0): TextItem => ({
  text,
  x: RGA_POSITIONS[key].x + dx,
  y: RGA_POSITIONS[key].y + dy,
});

describe('mapRgaFields', () => {
  it('identifica cada campo pela posição, em qualquer ordem', () => {
    const items = [
      at('issuedOn', '01/10/2026'),
      at('species', 'Canina'),
      at('name', 'REX'),
      at('phone', '19987654321'),
      at('rga', 'ABC.1D23.C-SP'),
    ];
    const { raw, ignored, duplicates } = mapRgaFields(items);
    expect(raw).toEqual({ issuedOn: '01/10/2026', species: 'Canina', name: 'REX', phone: '19987654321', rga: 'ABC.1D23.C-SP' });
    expect(ignored).toBe(0);
    expect(duplicates).toBe(0);
  });

  it('tolera até ±4 pt de diferença e recusa além disso', () => {
    expect(mapRgaFields([at('name', 'REX', 3.9, -3.9)]).raw.name).toBe('REX');
    const out = mapRgaFields([at('name', 'REX', 4.5, 0)]);
    expect(out.raw.name).toBeUndefined();
    expect(out.ignored).toBe(1);
  });

  it('não confunde campos vizinhos (linhas a 14 pt de distância)', () => {
    const { raw } = mapRgaFields([at('tutorName', 'FULANO', 0, -3), at('document', 'DOC', 0, 3), at('phone', 'TEL')]);
    expect(raw.tutorName).toBe('FULANO');
    expect(raw.document).toBe('DOC');
    expect(raw.phone).toBe('TEL');
  });

  it('separa "Local" e "Data de emissão", que ficam na mesma linha (x diferente)', () => {
    const { raw } = mapRgaFields([at('local', 'Campinas - SP'), at('issuedOn', '01/10/2026')]);
    expect(raw.local).toBe('Campinas - SP');
    expect(raw.issuedOn).toBe('01/10/2026');
  });

  it('une a continuação de um nome longo que quebrou linha (animal e responsável)', () => {
    const items = [
      at('name', 'MARIA DA SILVA SANTOS'),
      at('name', 'DE OLIVEIRA', 0, -7),
      at('rga', 'ABC.1D23.C-SP'),
      at('tutorName', 'JOSE ANTONIO'),
      at('tutorName', 'PEREIRA', 0, -8),
      at('tutorName', 'JUNIOR', 0, -9.5),
    ];
    const { raw, ignored } = mapRgaFields(items);
    expect(raw.name).toBe('MARIA DA SILVA SANTOS DE OLIVEIRA');
    expect(raw.tutorName).toBe('JOSE ANTONIO PEREIRA JUNIOR');
    expect(ignored).toBe(0);
  });

  it('ignora e conta itens fora das posições conhecidas, e continuação sem o campo principal', () => {
    const { raw, ignored } = mapRgaFields([
      { text: 'LIXO', x: 40, y: 300 },
      { text: 'ÓRFÃO', x: RGA_POSITIONS.name.x, y: RGA_POSITIONS.name.y - 7 }, // sem nome acima
      at('rga', 'ABC.1D23.C-SP'),
    ]);
    expect(raw).toEqual({ rga: 'ABC.1D23.C-SP' });
    expect(ignored).toBe(2);
  });

  it('o primeiro valor vale quando dois itens caem no mesmo campo', () => {
    const { raw, duplicates } = mapRgaFields([at('name', 'PRIMEIRO'), at('name', 'SEGUNDO', 1, 1)]);
    expect(raw.name).toBe('PRIMEIRO');
    expect(duplicates).toBe(1);
  });

  it('normaliza espaços e ignora itens vazios', () => {
    const { raw } = mapRgaFields([at('name', '  REX   DE   TESTE  '), at('cor', '   ')]);
    expect(raw.name).toBe('REX DE TESTE');
    expect(raw.cor).toBeUndefined();
  });
});
