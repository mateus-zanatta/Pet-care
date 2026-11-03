import { PET_FORM_DEFAULTS } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import { PetForm } from './PetForm';

jest.mock('./usePhotoPicker', () => ({
  PermissionDeniedError: class extends Error {},
  pickFromGallery: jest.fn(),
  takePhoto: jest.fn(),
}));

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});

const setup = async (onSubmit = jest.fn()) => {
  await renderWithProviders(
    <PetForm initialValues={PET_FORM_DEFAULTS} currentPhotoUrl={null} submitting={false} onSubmit={onSubmit} />,
  );
  return onSubmit;
};

describe('PetForm', () => {
  it('não envia sem o nome e mostra o erro traduzido', async () => {
    const onSubmit = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));
    expect(await screen.findByText('Preencha este campo.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia os valores quando o formulário está válido', async () => {
    const onSubmit = await setup();
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Mel');
    await fireEvent.press(screen.getByRole('radio', { name: 'Gato' }));
    await fireEvent.changeText(screen.getByLabelText('Peso (kg)'), '4,2');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [values, photo] = onSubmit.mock.calls[0];
    expect(values).toMatchObject({ name: 'Mel', species: 'cat', weight: '4,2' });
    expect(photo).toEqual({ kind: 'none' });
  });

  it('mostra os campos de idade só no modo "Idade aproximada"', async () => {
    await setup();
    expect(screen.queryByLabelText('Anos')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Idade aproximada' }));
    expect(screen.getByLabelText('Anos')).toBeTruthy();
    expect(screen.getByLabelText('Meses')).toBeTruthy();
  });

  it('mostra a data com máscara do idioma e valida datas impossíveis', async () => {
    const onSubmit = await setup();
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Rex');
    await fireEvent.press(screen.getByRole('radio', { name: 'Sei a data' }));
    const date = screen.getByLabelText('Data de nascimento');
    await fireEvent.changeText(date, '31022020');
    expect(date.props.value).toBe('31/02/2020');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));
    expect(await screen.findByText('Data inválida. Confira dia, mês e ano.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('avisa (sem bloquear) quando o RGA foge do formato conhecido', async () => {
    const onSubmit = await setup();
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Mel');
    await fireEvent.changeText(screen.getByLabelText('Nº do RG Animal (SinPatinhas)'), 'formato-estranho');
    expect(await screen.findByText(/foge do formato visto no SinPatinhas/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
