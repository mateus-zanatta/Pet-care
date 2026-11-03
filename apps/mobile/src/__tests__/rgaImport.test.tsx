import type { Pet, RgaImportResult } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import React from 'react';
import { RgaImportFlow } from '@/features/rga/RgaImportFlow';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }) }));
jest.mock('@/features/auth/AuthProvider', () => ({ useUser: () => ({ uid: 'u1', displayName: 'Ana', isAnonymous: false }) }));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/core/firebase', () => ({ diagnoseEmulatorConnection: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn(), reportRgaImportFailure: jest.fn() }));
jest.mock('@/features/pets/usePhotoPicker', () => ({ PermissionDeniedError: class extends Error {}, pickFromGallery: jest.fn(), takePhoto: jest.fn() }));
jest.mock('@/features/pets/hooks', () => ({ usePetPhotoUrl: () => null }));

const mockPick = jest.fn();
const mockImport = jest.fn();
const mockClassify = jest.fn((_error?: unknown): string => 'generic');
jest.mock('@/features/rga/rga.service', () => {
  class RgaFileError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    RgaFileError,
    pickRgaFile: () => mockPick(),
    importRgaFile: (file: unknown) => mockImport(file),
    rgaPhotoDataUri: (b64: string) => `data:image/jpeg;base64,${b64}`,
    classifyImportError: (e: unknown) => mockClassify(e),
  };
});

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFind = jest.fn();
const mockUpload = jest.fn();
jest.mock('@/features/pets/pets.repo', () => ({
  createPet: (input: unknown) => mockCreate(input),
  updatePet: (...args: unknown[]) => mockUpdate(...args),
  findPetByRga: (...args: unknown[]) => mockFind(...args),
  uploadPetPhoto: (...args: unknown[]) => mockUpload(...args),
  removePetPhoto: jest.fn(),
}));

const recognized: RgaImportResult = {
  mode: 'pdf',
  recognized: true,
  creator: 'JasperReports Library version 6.20.0',
  fields: {
    name: 'REX DE TESTE',
    rga: 'ABC.1D23.C-SP',
    hasMicrochip: false,
    neutered: 'yes',
    species: 'dog',
    sex: 'male',
    birthDate: '2020-03-15',
    cor: 'Caramelo',
    naturalidade: { cidade: 'Campinas', uf: 'SP' },
    issuedOn: '2026-10-01',
    tutor: { nome: 'FULANO DE TAL', telefone: '19987654321' },
  },
  confirm: [],
  warnings: [],
  qr: { found: true, rga: 'ABC.1D23.C-SP', matches: true },
  photoJpegBase64: 'AAAA',
};

const existingPet: Pet = {
  id: 'p1',
  ownerId: 'u1',
  origin: 'manual',
  name: 'Rex',
  species: 'dog',
  sex: 'male',
  neutered: 'yes',
  rga: 'ABC.1D23.C-SP',
  cor: 'Preto',
};

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockPick.mockResolvedValue({ base64: 'AAAA', mimeType: 'application/pdf' });
  mockImport.mockResolvedValue(recognized);
  mockFind.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ petId: 'new1', status: 'committed' });
  mockUpdate.mockResolvedValue('committed');
  mockUpload.mockResolvedValue(undefined);
});

const choose = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Escolher arquivo' }));
};

describe('Importar RG Animal', () => {
  it('lê o arquivo e abre o formulário PREENCHIDO para revisão, sem salvar nada ainda', async () => {
    await renderWithProviders(<RgaImportFlow />);
    await choose();

    const name = await screen.findByLabelText('Nome, lido do RG');
    expect(name.props.value).toBe('REX DE TESTE');
    expect(screen.getByLabelText('Nº do RG Animal (SinPatinhas), lido do RG').props.value).toBe('ABC.1D23.C-SP');
    expect(screen.getByLabelText('Cor da pelagem, lido do RG').props.value).toBe('Caramelo');
    expect(screen.getByRole('radio', { name: 'Cachorro' }).props.accessibilityState.selected).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled(); // nunca salva automaticamente
  });

  it('ao confirmar, cria o pet como "rga_import" com os dados do SinPatinhas e a foto do RG', async () => {
    await renderWithProviders(<RgaImportFlow />);
    await choose();
    await screen.findByLabelText('Nome, lido do RG');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const input = mockCreate.mock.calls[0]![0];
    expect(input).toMatchObject({
      uid: 'u1',
      origin: 'rga_import',
      data: { name: 'REX DE TESTE', species: 'dog', sex: 'male', neutered: 'yes', rga: 'ABC.1D23.C-SP', birthDate: '2020-03-15' },
      extra: { sinpatinhas: { origem: 'pdf', emitidoEm: '2026-10-01', qrConfere: true } },
    });
    // Responsável: NÃO foi marcado, então não é salvo. CPF/CNPJ nem existe.
    expect(input.extra.tutor).toBeUndefined();
    expect(JSON.stringify(input)).not.toContain('FULANO');
    // A foto do RG vem marcada como foto de perfil
    // (a foto já chega pronta do servidor: é enviada em base64, sem arquivo temporário)
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith('new1', expect.objectContaining({ base64: 'AAAA', uri: 'data:image/jpeg;base64,AAAA' })),
    );
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'new1' } });
  });

  it('se o servidor NÃO confirmar a gravação, não tenta enviar a foto e AVISA a pessoa (nada de falha silenciosa)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockCreate.mockResolvedValue({ petId: 'new1', status: 'pending' });
    await renderWithProviders(<RgaImportFlow />);
    await choose();
    await screen.findByLabelText('Nome, lido do RG');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'new1' } }));
    expect(mockUpload).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('não confirmou a gravação'));
  });

  it('se o envio da foto falhar, o pet fica salvo e a pessoa é avisada', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockUpload.mockRejectedValue(Object.assign(new Error('x'), { code: 'storage/unauthorized' }));
    await renderWithProviders(<RgaImportFlow />);
    await choose();
    await screen.findByLabelText('Nome, lido do RG');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'new1' } }));
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Não foi possível enviar a foto'));
  });

  it('só salva nome e telefone do responsável se a pessoa marcar', async () => {
    await renderWithProviders(<RgaImportFlow />);
    await choose();
    await screen.findByLabelText('Nome, lido do RG');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Salvar também o nome e o telefone do responsável que constam no RG' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0]![0].extra.tutor).toEqual({ nome: 'FULANO DE TAL', telefone: '19987654321' });
  });

  it('a pessoa pode desmarcar a foto do RG e corrigir campos antes de salvar', async () => {
    await renderWithProviders(<RgaImportFlow />);
    await choose();
    await screen.findByLabelText('Nome, lido do RG');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Usar a foto do RG como foto de perfil' }));
    await fireEvent.changeText(screen.getByLabelText('Cor da pelagem, lido do RG'), 'Branco');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar pet' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0]![0].data.cor).toBe('Branco');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('QR diferente do texto: avisa que o arquivo pode ter sido alterado e marca o RGA com "confira"', async () => {
    mockImport.mockResolvedValue({
      ...recognized,
      qr: { found: true, rga: 'ZZZ.9999.Z-RJ', matches: false },
      warnings: ['qr_mismatch'],
      confirm: ['rga'],
    });
    await renderWithProviders(<RgaImportFlow />);
    await choose();

    expect(await screen.findByText(/pode ter sido alterado/)).toBeTruthy();
    expect(screen.getByLabelText('Nº do RG Animal (SinPatinhas), confira')).toBeTruthy();
  });

  describe('arquivo não reconhecido', () => {
    it('com dados parciais: avisa, preenche o que deu, marca "confira" e libera o preenchimento manual', async () => {
      mockImport.mockResolvedValue({
        ...recognized,
        recognized: false,
        reason: 'missing_required_fields',
        fields: { cor: 'Caramelo', sex: 'male' },
        confirm: ['cor', 'sex'],
        warnings: [],
      });
      await renderWithProviders(<RgaImportFlow />);
      await choose();

      expect(await screen.findByText('Não reconheci este arquivo como RG Animal do SinPatinhas.')).toBeTruthy();
      expect(screen.getByText('Faltaram dados essenciais (nome, RGA ou espécie).')).toBeTruthy();
      expect(screen.getByLabelText('Cor da pelagem, confira').props.value).toBe('Caramelo');
      expect(screen.getByLabelText('Nome')).toBeTruthy(); // campo editável, sem selo
    });

    it('sem nenhum dado aproveitável: volta ao início explicando o motivo', async () => {
      mockImport.mockResolvedValue({
        mode: 'pdf', recognized: false, reason: 'multiple_pages', fields: {}, confirm: [], warnings: [], qr: { found: false },
      });
      await renderWithProviders(<RgaImportFlow />);
      await choose();

      expect(await screen.findByText(/Não reconheci este arquivo.*mais de uma página/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Preencher manualmente' })).toBeTruthy();
    });
  });

  it('imagem com QR: preenche só o RGA e o resto fica para a pessoa', async () => {
    mockImport.mockResolvedValue({
      mode: 'qr', recognized: true, fields: { rga: 'ABC.1D23.C-SP' }, confirm: [], warnings: [], qr: { found: true, rga: 'ABC.1D23.C-SP' },
    });
    await renderWithProviders(<RgaImportFlow />);
    await choose();

    expect((await screen.findByLabelText('Nº do RG Animal (SinPatinhas), lido do RG')).props.value).toBe('ABC.1D23.C-SP');
    expect(screen.getByLabelText('Nome').props.value).toBe('');
    expect(screen.queryByRole('checkbox', { name: 'Usar a foto do RG como foto de perfil' })).toBeNull();
  });

  describe('RGA já cadastrado na conta', () => {
    it('oferece atualizar o pet existente, mostrando o que mudaria, em vez de criar outro', async () => {
      mockFind.mockResolvedValue(existingPet);
      await renderWithProviders(<RgaImportFlow />);
      await choose();

      expect(await screen.findByText('Este RGA já está cadastrado')).toBeTruthy();
      expect(screen.getByText(/Você já tem um pet com este RGA: Rex/)).toBeTruthy();
      expect(screen.getByText('Nome: Rex → REX DE TESTE')).toBeTruthy();
      expect(screen.getByText('Cor: Preto → Caramelo')).toBeTruthy();
      expect(screen.getByText('Nascimento: (vazio) → 15/03/2020')).toBeTruthy();
      expect(screen.queryByText(/RG Animal:/)).toBeNull(); // o RGA é igual: não aparece como mudança

      await fireEvent.press(screen.getByRole('button', { name: 'Atualizar este pet' }));
      await screen.findByLabelText('Nome, lido do RG');
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      expect(mockUpdate.mock.calls[0]![0]).toBe('p1');
      expect(mockUpdate.mock.calls[0]![1]).toMatchObject({ name: 'REX DE TESTE', cor: 'Caramelo' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('cancelar não altera nada', async () => {
      mockFind.mockResolvedValue(existingPet);
      await renderWithProviders(<RgaImportFlow />);
      await choose();
      await screen.findByText('Este RGA já está cadastrado');
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
      expect(mockBack).toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  it('a partir de um pet existente, atualiza ESSE pet (sem procurar duplicados)', async () => {
    await renderWithProviders(<RgaImportFlow existingPet={existingPet} />);
    await choose();
    await screen.findByLabelText('Nome, lido do RG');
    expect(mockFind).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0]![0]).toBe('p1');
  });

  describe('erros', () => {
    it('cancelar o seletor de arquivos não faz nada', async () => {
      mockPick.mockResolvedValue(null);
      await renderWithProviders(<RgaImportFlow />);
      await choose();
      expect(mockImport).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeTruthy();
    });

    it('tipo de arquivo não aceito', async () => {
      const { RgaFileError } = jest.requireMock('@/features/rga/rga.service');
      mockPick.mockRejectedValue(new RgaFileError('unsupported'));
      await renderWithProviders(<RgaImportFlow />);
      await choose();
      expect(await screen.findByText('Escolha um PDF, uma foto (JPG) ou um print (PNG).')).toBeTruthy();
    });

    it('arquivo acima de 5 MB', async () => {
      const { RgaFileError } = jest.requireMock('@/features/rga/rga.service');
      mockPick.mockRejectedValue(new RgaFileError('too_large'));
      await renderWithProviders(<RgaImportFlow />);
      await choose();
      expect(await screen.findByText('O arquivo passa de 5 MB. Escolha um menor.')).toBeTruthy();
    });

    it('sem internet', async () => {
      mockImport.mockRejectedValue({ code: 'functions/unavailable' });
      mockClassify.mockReturnValue('network');
      await renderWithProviders(<RgaImportFlow />);
      await choose();
      expect(await screen.findByText(/Sem conexão/)).toBeTruthy();
    });
  });
});
