import { medicationFormDefaults, medicationFormToData } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import { MedicationForm, maskTimeInput } from './MedicationForm';

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});

const setup = async (onSubmit = jest.fn(), showStatus = false) => {
  await renderWithProviders(
    <MedicationForm initialValues={medicationFormDefaults('2026-11-04')} submitting={false} showStatus={showStatus} onSubmit={onSubmit} />,
  );
  return onSubmit;
};

const fillBasics = async () => {
  await fireEvent.changeText(screen.getByLabelText('Nome do medicamento'), 'Amoxicilina');
  await fireEvent.changeText(screen.getByLabelText('Dose'), '1/2');
  await fireEvent.changeText(screen.getByLabelText('Unidade'), 'comprimido');
};

describe('maskTimeInput', () => {
  it('vira HH:MM enquanto digita e ignora o que não é número', () => {
    expect(maskTimeInput('0')).toBe('0');
    expect(maskTimeInput('083')).toBe('08:3');
    expect(maskTimeInput('0830')).toBe('08:30');
    expect(maskTimeInput('08:30xx99')).toBe('08:30');
  });
});

describe('MedicationForm', () => {
  it('deixa claro que o app NÃO sugere medicamento nem dose', async () => {
    await setup();
    expect(screen.getByText(/O app não sugere medicamentos, doses nem diagnósticos/)).toBeTruthy();
  });

  it('não vem com nenhum medicamento ou dose preenchidos (nada é sugerido)', async () => {
    await setup();
    expect(screen.getByLabelText('Nome do medicamento').props.value).toBe('');
    expect(screen.getByLabelText('Dose').props.value).toBe('');
    expect(screen.getByLabelText('Unidade').props.value).toBe('');
  });

  it('não envia vazio e mostra os erros traduzidos', async () => {
    const onSubmit = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    expect((await screen.findAllByText('Preencha este campo.')).length).toBeGreaterThan(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('"a cada X horas", uso contínuo: envia os valores certos', async () => {
    const onSubmit = await setup();
    await fillBasics();
    await fireEvent.changeText(screen.getByLabelText('A cada quantas horas'), '8');
    await fireEvent.press(screen.getByRole('radio', { name: 'Uso contínuo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = medicationFormToData(onSubmit.mock.calls[0]![0]);
    expect(data).toMatchObject({
      name: 'Amoxicilina',
      dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
      frequency: { kind: 'interval', everyHours: 8 },
      startDate: '2026-11-04',
      startTime: '08:00',
      status: 'active',
    });
    expect('endDate' in data).toBe(false);
  });

  it('rejeita intervalo fora de 1 a 168 horas', async () => {
    const onSubmit = await setup();
    await fillBasics();
    await fireEvent.changeText(screen.getByLabelText('A cada quantas horas'), '200');
    await fireEvent.press(screen.getByRole('radio', { name: 'Uso contínuo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    expect(await screen.findByText('Digite um número de horas entre 1 e 168.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('horários fixos: exige ao menos um, adiciona com máscara e envia ordenados', async () => {
    const onSubmit = await setup();
    await fillBasics();
    await fireEvent.press(screen.getByRole('radio', { name: 'Uso contínuo' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Horários fixos' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    expect(await screen.findByText('Adicione pelo menos um horário.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    const field = screen.getByLabelText('Novo horário');
    await fireEvent.changeText(field, '2000');
    expect(screen.getByLabelText('Novo horário').props.value).toBe('20:00');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar horário' }));
    await fireEvent.changeText(screen.getByLabelText('Novo horário'), '0800');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar horário' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(medicationFormToData(onSubmit.mock.calls[0]![0]).frequency).toEqual({ kind: 'fixed', times: ['08:00', '20:00'] });
  });

  it('horário repetido ou inválido não entra na lista', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Horários fixos' }));
    await fireEvent.changeText(screen.getByLabelText('Novo horário'), '0800');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar horário' }));
    await fireEvent.changeText(screen.getByLabelText('Novo horário'), '0800');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar horário' }));
    expect(await screen.findByText('Há horários repetidos.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Novo horário'), '2560');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar horário' }));
    expect(await screen.findByText('Horário inválido. Use o formato 08:00.')).toBeTruthy();
  });

  it('só mostra a situação (em uso / concluído / suspenso) ao editar', async () => {
    await setup(jest.fn(), false);
    expect(screen.queryByRole('radio', { name: 'Suspenso' })).toBeNull();
  });

  it('clínica pede o nome; "em casa" não pede nada', async () => {
    const onSubmit = await setup();
    await fillBasics();
    await fireEvent.changeText(screen.getByLabelText('A cada quantas horas'), '12');
    await fireEvent.press(screen.getByRole('radio', { name: 'Uso contínuo' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Clínica' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    expect(await screen.findByText('Preencha este campo.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Nome da clínica'), 'Clínica Pet Feliz');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(medicationFormToData(onSubmit.mock.calls[0]![0]).place).toEqual({ kind: 'clinic', text: 'Clínica Pet Feliz' });
  });

  describe('código de barras pela câmera', () => {
    it('sem a leitura disponível, o botão não aparece', async () => {
      await setup();
      expect(screen.queryByRole('button', { name: 'Ler código de barras com a câmera' })).toBeNull();
    });

    it('o botão abre a leitura da câmera', async () => {
      const onScan = jest.fn();
      await renderWithProviders(
        <MedicationForm initialValues={medicationFormDefaults('2026-11-04')} submitting={false} onScan={onScan} scannedCode={null} onSubmit={jest.fn()} />,
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Ler código de barras com a câmera' }));
      expect(onScan).toHaveBeenCalledTimes(1);
    });

    it('o código lido preenche o campo e continua editável', async () => {
      await renderWithProviders(
        <MedicationForm initialValues={medicationFormDefaults('2026-11-04')} submitting={false} onScan={jest.fn()} scannedCode="7891234567895" onSubmit={jest.fn()} />,
      );
      expect(screen.getByLabelText('Código de barras (opcional)').props.value).toBe('7891234567895');
      await fireEvent.changeText(screen.getByLabelText('Código de barras (opcional)'), '789');
      expect(screen.getByLabelText('Código de barras (opcional)').props.value).toBe('789');
    });
  });

  it('NÃO mostra "Corrija os campos destacados" quando o formulário é válido e foi enviado', async () => {
    const onSubmit = await setup();
    await fillBasics();
    await fireEvent.changeText(screen.getByLabelText('A cada quantas horas'), '8');
    await fireEvent.press(screen.getByRole('radio', { name: 'Uso contínuo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Corrija os campos destacados.')).toBeNull();
  });

  it('mostra "Corrija os campos destacados" quando há erro', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar medicamento' }));
    expect(await screen.findByText('Corrija os campos destacados.')).toBeTruthy();
  });
});
