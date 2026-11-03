import type { PetData } from '@petcare/shared';
import { buildPetUpdate, parseMember, parsePet, photoVersion, sortMembersByAddedAt, splitAge } from './pets.mapper';

const REMOVE = Symbol('remove');
const base: PetData = { name: 'Mel', species: 'cat', sex: 'female', neutered: 'yes' };

describe('buildPetUpdate', () => {
  it('marca para remover todo opcional que o formulário não preencheu', () => {
    const update = buildPetUpdate({ ...base, breed: 'SRD', weightKg: 4.2 }, REMOVE);
    expect(update.breed).toBe('SRD');
    expect(update.weightKg).toBe(4.2);
    expect(update.microchip).toBe(REMOVE);
    expect(update.rga).toBe(REMOVE);
    expect(update.address).toBe(REMOVE);
    expect(update.approxAge).toBe(REMOVE);
  });

  it('nunca inclui campos controlados pelo sistema', () => {
    const keys = Object.keys(buildPetUpdate(base, REMOVE));
    for (const forbidden of ['ownerId', 'origin', 'photoPath', 'sinpatinhas', 'tutor', 'createdAt', 'rescueStatus']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe('parsePet', () => {
  it('lê um documento válido', () => {
    const pet = parsePet('p1', { ...base, ownerId: 'u1', origin: 'manual' });
    expect(pet?.id).toBe('p1');
    expect(pet?.name).toBe('Mel');
  });
  it('ignora documentos corrompidos', () => {
    expect(parsePet('p1', { name: 'sem dono' })).toBeNull();
    expect(parsePet('p1', null)).toBeNull();
  });
});

describe('parseMember', () => {
  it('valida o vínculo', () => {
    expect(parseMember({ petId: 'p1', uid: 'u1', role: 'owner' })?.role).toBe('owner');
    expect(parseMember({ petId: 'p1', uid: 'u1', role: 'chefe' })).toBeNull();
  });
});

describe('photoVersion / splitAge', () => {
  it('lê timestamps e tolera ausência', () => {
    expect(photoVersion({ toMillis: () => 123 })).toBe(123);
    expect(photoVersion(undefined)).toBe(0);
    expect(photoVersion({})).toBe(0);
  });
  it('separa anos e meses', () => {
    expect(splitAge(30)).toEqual({ years: 2, months: 6 });
    expect(splitAge(5)).toEqual({ years: 0, months: 5 });
  });
});

describe('sortMembersByAddedAt', () => {
  const at = (ms: number) => ({ toMillis: () => ms });
  it('ordena do mais antigo ao mais novo e deixa os pendentes por último', () => {
    const sorted = sortMembersByAddedAt([
      { id: 'novo', addedAt: at(300) },
      { id: 'pendente', addedAt: null },
      { id: 'antigo', addedAt: at(100) },
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['antigo', 'novo', 'pendente']);
  });
});
