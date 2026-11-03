import { HEALTH_EVENT_FORM_DEFAULTS, VACCINE_FORM_DEFAULTS, healthEventFormToData, vaccineFormToData } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import { HealthEventForm } from './HealthEventForm';
import { VaccineForm } from './VaccineForm';

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});

describe('VaccineForm', () => {
  it('não envia sem nome e data e mostra os erros traduzidos', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<VaccineForm isNew initialValues={VACCINE_FORM_DEFAULTS} submitting={false} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar vacina' }));
    expect((await screen.findAllByText('Preencha este campo.')).length).toBe(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia os valores; não sugere nome de vacina nem datas', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<VaccineForm isNew initialValues={VACCINE_FORM_DEFAULTS} submitting={false} onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Nome da vacina').props.value).toBe('');
    await fireEvent.changeText(screen.getByLabelText('Nome da vacina'), 'V10');
    await fireEvent.changeText(screen.getByLabelText('Data da aplicação'), '01/10/2026');
    await fireEvent.changeText(screen.getByLabelText('Data da próxima dose (opcional)'), '01/10/2027');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar vacina' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(vaccineFormToData(onSubmit.mock.calls[0]![0])).toEqual({ name: 'V10', appliedOn: '2026-10-01', nextDoseOn: '2027-10-01' });
  });

  it('próxima dose antes da aplicação é recusada', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<VaccineForm isNew initialValues={VACCINE_FORM_DEFAULTS} submitting={false} onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByLabelText('Nome da vacina'), 'V10');
    await fireEvent.changeText(screen.getByLabelText('Data da aplicação'), '01/10/2026');
    await fireEvent.changeText(screen.getByLabelText('Data da próxima dose (opcional)'), '01/09/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar vacina' }));
    expect(await screen.findByText('A próxima data precisa ser depois da data do registro.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('o aviso de erro só aparece quando há erro (formulário válido enviado não o mostra)', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<VaccineForm isNew initialValues={VACCINE_FORM_DEFAULTS} submitting={false} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar vacina' }));
    expect(await screen.findByText('Corrija os campos destacados.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nome da vacina'), 'V10');
    await fireEvent.changeText(screen.getByLabelText('Data da aplicação'), '01/10/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar vacina' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Corrija os campos destacados.')).toBeNull();
  });

  it('avisa que os anexos entram depois de salvar (só no cadastro novo)', async () => {
    await renderWithProviders(<VaccineForm isNew initialValues={VACCINE_FORM_DEFAULTS} submitting={false} onSubmit={jest.fn()} />);
    expect(screen.getByText(/Depois de salvar, você poderá anexar/)).toBeTruthy();
  });
});

describe('HealthEventForm', () => {
  it('exige título e data; escolhe o tipo', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<HealthEventForm isNew initialValues={HEALTH_EVENT_FORM_DEFAULTS} submitting={false} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar registro' }));
    expect((await screen.findAllByText('Preencha este campo.')).length).toBe(2);
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Vermífugo' }));
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Vermífugo mensal');
    await fireEvent.changeText(screen.getByLabelText('Data'), '01/10/2026');
    await fireEvent.changeText(screen.getByLabelText('Próxima aplicação ou retorno (opcional)'), '01/11/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar registro' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(healthEventFormToData(onSubmit.mock.calls[0]![0])).toEqual({
      type: 'deworming',
      date: '2026-10-01',
      title: 'Vermífugo mensal',
      nextDate: '2026-11-01',
    });
  });

  it('formulário válido enviado não mostra o aviso de erro', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<HealthEventForm initialValues={{ ...HEALTH_EVENT_FORM_DEFAULTS, title: 'Consulta', date: '2026-10-01' }} submitting={false} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar registro' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Corrija os campos destacados.')).toBeNull();
  });

  it('oferece todos os tipos da linha do tempo', async () => {
    await renderWithProviders(<HealthEventForm initialValues={HEALTH_EVENT_FORM_DEFAULTS} submitting={false} onSubmit={jest.fn()} />);
    for (const label of ['Consulta', 'Vermífugo', 'Antipulgas e carrapatos', 'Exame', 'Cirurgia', 'Outro']) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    }
  });

  it('CRMV exige a UF', async () => {
    const onSubmit = jest.fn();
    await renderWithProviders(<HealthEventForm initialValues={{ ...HEALTH_EVENT_FORM_DEFAULTS, title: 'Consulta', date: '2026-10-01' }} submitting={false} onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByLabelText('CRMV (número)'), '12345');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Preencha este campo.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
