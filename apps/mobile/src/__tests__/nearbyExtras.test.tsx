import { medicationFormDefaults, type PlaceWithDistance } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { MedicationForm } from '@/features/medications/MedicationForm';
import { NearestVetCard } from '@/features/nearby/NearestVetCard';
import { SuggestPlaceForm } from '@/features/nearby/SuggestPlaceForm';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/core/time/useNow', () => ({ useNow: () => new Date(2026, 10, 2, 15, 0) }));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));

const mockPermission = jest.fn();
const mockPosition = jest.fn();
jest.mock('@/features/nearby/location', () => ({
  LocationError: class extends Error {},
  getLocationPermission: () => mockPermission(),
  getCurrentPosition: () => mockPosition(),
}));
const mockSearch = jest.fn();
jest.mock('@/features/nearby/places.service', () => ({ PlacesError: class extends Error {}, searchNearby: (...a: unknown[]) => mockSearch(...a) }));
const mockCall = jest.fn();
jest.mock('@/core/firebase/callable', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));

const vet = (id: string, name: string, distanceKm: number): PlaceWithDistance => ({
  id: `osm:node/${id}`, source: 'osm', name, category: 'vet', lat: -23.55, lng: -46.63, emergency: false, distanceKm,
});

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockPosition.mockResolvedValue({ lat: -23.55, lng: -46.63 });
});

describe('card "Veterinária mais próxima" da Home', () => {
  it('não pede permissão por conta própria: sem permissão, convida para a aba Perto de mim', async () => {
    mockPermission.mockResolvedValue('undetermined');
    await renderWithProviders(<NearestVetCard />);
    expect(await screen.findByText(/Use a aba Perto de mim/)).toBeTruthy();
    expect(mockPosition).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver veterinárias perto de mim' }));
    expect(mockPush).toHaveBeenCalledWith('/nearby');
  });

  it('com permissão: mostra a CLÍNICA mais próxima (ignora pet shops), com Ligar/Como chegar', async () => {
    mockPermission.mockResolvedValue('granted');
    mockSearch.mockResolvedValue([
      { ...vet('3', 'Pet shop do lado', 0.1), category: 'petshop' },
      vet('2', 'Clínica Longe', 4),
      vet('1', 'Clínica Perto', 0.8),
    ]);
    await renderWithProviders(<NearestVetCard />);
    expect(await screen.findByText('Clínica Perto')).toBeTruthy();
    expect(screen.queryByText('Pet shop do lado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Como chegar' })).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith({ lat: -23.55, lng: -46.63 }, 10);
  });

  it('nenhuma clínica por perto: avisa e oferece a aba', async () => {
    mockPermission.mockResolvedValue('granted');
    mockSearch.mockResolvedValueOnce([]);
    await renderWithProviders(<NearestVetCard />);
    expect(await screen.findByText('Nenhuma veterinária encontrada em até 10 km.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver veterinárias perto de mim' })).toBeTruthy();
  });

  it('erro na busca: não quebra a Home, só convida para a aba', async () => {
    mockPermission.mockResolvedValue('granted');
    mockSearch.mockRejectedValueOnce(new Error('x'));
    await renderWithProviders(<NearestVetCard />);
    expect(await screen.findByRole('button', { name: 'Ver veterinárias perto de mim' })).toBeTruthy();
  });
});

describe('Sugerir um local / Corrigir dados', () => {
  const base = { kind: 'new' as const, placeId: '', name: '', category: 'vet' as const, address: '', phone: '', is24h: false, note: '' };

  it('exige nome e endereço; envia para a função e agradece', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onDone = jest.fn();
    mockCall.mockResolvedValue({ ok: true, id: 's1' });
    await renderWithProviders(<SuggestPlaceForm initial={base} canSend onDone={onDone} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar sugestão' }));
    expect((await screen.findAllByText('Preencha este campo.')).length).toBe(2);
    expect(mockCall).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Nome do local'), 'Clínica Nova');
    await fireEvent.changeText(screen.getByLabelText('Endereço'), 'Rua B, 20');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Atende 24 horas / emergência' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar sugestão' }));
    await waitFor(() =>
      expect(mockCall).toHaveBeenCalledWith('suggestPlace', { kind: 'new', name: 'Clínica Nova', category: 'vet', address: 'Rua B, 20', is24h: true }),
    );
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Obrigado!'));
    expect(onDone).toHaveBeenCalled();
  });

  it('corrigir: vem preenchido com o local e envia o ID dele', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockCall.mockResolvedValue({ ok: true, id: 's2' });
    await renderWithProviders(
      <SuggestPlaceForm initial={{ ...base, kind: 'fix', placeId: 'osm:node/1', name: 'Clínica Perto', address: 'Rua A, 10' }} canSend onDone={jest.fn()} />,
    );
    expect(screen.getByText('Corrigir dados')).toBeTruthy();
    expect(screen.getByLabelText('Nome do local').props.value).toBe('Clínica Perto');
    await fireEvent.changeText(screen.getByLabelText('Telefone (opcional)'), '(11) 3333-4444');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar sugestão' }));
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('suggestPlace', expect.objectContaining({ kind: 'fix', placeId: 'osm:node/1', phone: '(11) 3333-4444' })));
  });

  it('limite diário e telefone inválido têm mensagens próprias', async () => {
    mockCall.mockRejectedValue(Object.assign(new Error('daily-limit'), { code: 'functions/resource-exhausted' }));
    await renderWithProviders(<SuggestPlaceForm initial={{ ...base, name: 'X', address: 'Y' }} canSend onDone={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Telefone (opcional)'), 'abc');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar sugestão' }));
    expect(await screen.findByText('Telefone inválido. Exemplo: (11) 3333-4444')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Telefone (opcional)'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar sugestão' }));
    expect(await screen.findByText(/limite de sugestões de hoje/)).toBeTruthy();
  });

  it('sem conta: avisa e não deixa enviar', async () => {
    await renderWithProviders(<SuggestPlaceForm initial={base} canSend={false} onDone={jest.fn()} />);
    expect(screen.getByText('Crie uma conta para sugerir locais.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar sugestão' }).props.accessibilityState?.disabled).toBe(true);
  });
});

describe('favoritos no campo "local" do medicamento', () => {
  it('aparecem como opção e preenchem clínica + endereço', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(
      <MedicationForm
        initialValues={{ ...medicationFormDefaults('2026-11-04'), name: 'X', doseAmount: '1', doseUnit: 'ml', everyHours: '8', continuous: true }}
        submitting={false}
        favoritePlaces={[{ id: 'f1', name: 'Clínica Perto', address: 'Rua A, 10' }]}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('Seus locais favoritos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Clínica Perto' }));
    expect(screen.getByLabelText('Nome da clínica').props.value).toBe('Clínica Perto - Rua A, 10');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ placeKind: 'clinic', placeText: 'Clínica Perto - Rua A, 10' });
  });

  it('sem favoritos, nada aparece', async () => {
    await renderWithProviders(<MedicationForm initialValues={medicationFormDefaults('2026-11-04')} submitting={false} onSubmit={jest.fn()} />);
    expect(screen.queryByText('Seus locais favoritos')).toBeNull();
  });
});
