import type { AttachmentRef } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import { AttachmentsSection, formatFileSize } from './AttachmentsSection';

const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockOpen = jest.fn();
const mockPickPdf = jest.fn();
const mockPickGallery = jest.fn();
const mockTakePhoto = jest.fn();

jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));
jest.mock('./attachments.service', () => {
  class AttachmentError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    AttachmentError,
    addAttachment: (...a: unknown[]) => mockAdd(...a),
    removeAttachment: (...a: unknown[]) => mockRemove(...a),
    openAttachment: (...a: unknown[]) => mockOpen(...a),
    pickPdf: (...a: unknown[]) => mockPickPdf(...a),
  };
});
jest.mock('@/features/pets/usePhotoPicker', () => {
  class PermissionDeniedError extends Error {}
  return {
    PermissionDeniedError,
    pickFromGallery: (...a: unknown[]) => mockPickGallery(...a),
    takePhoto: (...a: unknown[]) => mockTakePhoto(...a),
  };
});

const target = { collection: 'vaccines' as const, petId: 'p1', recordId: 'v1' };
const pdf: AttachmentRef = { id: 'a1', path: 'pets/p1/attachments/v1/a1.pdf', name: 'hemograma.pdf', contentType: 'application/pdf', size: 340 * 1024, addedAt: '2026-11-04T10:00:00.000Z' };
const photo: AttachmentRef = { id: 'a2', path: 'pets/p1/attachments/v1/a2.jpg', name: 'foto-20261104.jpg', contentType: 'image/jpeg', size: 2.5 * 1024 * 1024, addedAt: '2026-11-04T10:00:00.000Z' };

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockAdd.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  mockOpen.mockResolvedValue(undefined);
});

describe('formatFileSize', () => {
  const t = (key: string, o: Record<string, unknown> = {}) => `${key}:${String(o.size)}`;
  it('KB abaixo de 1 MB e MB com uma casa decimal', () => {
    expect(formatFileSize(340 * 1024, t)).toBe('attachments.kb:340');
    expect(formatFileSize(10, t)).toBe('attachments.kb:1');
    expect(formatFileSize(2.5 * 1024 * 1024, t)).toBe('attachments.mb:2.5');
  });
});

describe('AttachmentsSection', () => {
  it('vazio: explica e oferece foto, galeria e PDF', async () => {
    await renderWithProviders(<AttachmentsSection target={target} attachments={[]} canEdit />);
    expect(screen.getByText('Nenhum anexo ainda.')).toBeTruthy();
    for (const name of ['Tirar foto', 'Escolher foto', 'Escolher PDF']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByText(/Fotos têm a localização removida/)).toBeTruthy();
  });

  it('lista os anexos com tamanho e abre ao tocar em "Abrir"', async () => {
    await renderWithProviders(<AttachmentsSection target={target} attachments={[pdf, photo]} canEdit />);
    expect(screen.getByText('340 KB')).toBeTruthy();
    expect(screen.getByText('2.5 MB')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir hemograma.pdf' }));
    expect(mockOpen).toHaveBeenCalledWith(pdf);
  });

  it('visualizador só abre: sem enviar nem remover', async () => {
    await renderWithProviders(<AttachmentsSection target={target} attachments={[pdf]} canEdit={false} />);
    expect(screen.getByRole('button', { name: 'Abrir hemograma.pdf' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tirar foto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remover hemograma.pdf' })).toBeNull();
  });

  it('foto da galeria: vem SEM recorte e é enviada com os anexos atuais (para respeitar o limite)', async () => {
    const picked = { uri: 'file:///x.jpg', width: 3000, height: 4000 };
    mockPickGallery.mockResolvedValue(picked);
    await renderWithProviders(<AttachmentsSection target={target} attachments={[pdf]} canEdit />);
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher foto' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(target, { kind: 'photo', photo: picked }, [pdf]));
    expect(mockPickGallery).toHaveBeenCalledWith({ crop: false });
  });

  it('PDF escolhido é enviado como PDF; cancelar o seletor não envia nada', async () => {
    mockPickPdf.mockResolvedValueOnce({ uri: 'file:///a.pdf', name: 'a.pdf', size: 10 });
    await renderWithProviders(<AttachmentsSection target={target} attachments={[]} canEdit />);
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher PDF' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(target, { kind: 'pdf', uri: 'file:///a.pdf', name: 'a.pdf', size: 10 }, []));

    mockPickPdf.mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher PDF' }));
    await waitFor(() => expect(mockPickPdf).toHaveBeenCalledTimes(2));
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('mostra o motivo quando o arquivo é grande demais ou a câmera é negada', async () => {
    const { AttachmentError } = jest.requireMock('./attachments.service');
    const { PermissionDeniedError } = jest.requireMock('@/features/pets/usePhotoPicker');
    mockPickPdf.mockResolvedValue({ uri: 'u', name: 'a.pdf', size: 1 });
    mockAdd.mockRejectedValueOnce(new AttachmentError('too_large'));
    await renderWithProviders(<AttachmentsSection target={target} attachments={[]} canEdit />);
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher PDF' }));
    expect(await screen.findByText('O arquivo é maior que 10 MB.')).toBeTruthy();

    mockTakePhoto.mockRejectedValueOnce(new PermissionDeniedError('camera'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tirar foto' }));
    expect(await screen.findByText(/Sem acesso à câmera/)).toBeTruthy();
  });

  it('erro de envio não some em silêncio', async () => {
    mockPickPdf.mockResolvedValue({ uri: 'u', name: 'a.pdf', size: 1 });
    mockAdd.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'storage/unauthorized' }));
    await renderWithProviders(<AttachmentsSection target={target} attachments={[]} canEdit />);
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher PDF' }));
    expect(await screen.findByText('Não foi possível enviar o anexo. Tente de novo.')).toBeTruthy();
  });

  it('com 10 anexos o envio é bloqueado e o motivo aparece', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...pdf, id: `a${i}`, name: `d${i}.pdf` }));
    await renderWithProviders(<AttachmentsSection target={target} attachments={ten} canEdit />);
    expect(screen.getByText('Limite de 10 anexos atingido.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher PDF' }).props.accessibilityState?.disabled).toBe(true);
  });

  it('remover pede confirmação e só então apaga', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<AttachmentsSection target={target} attachments={[pdf]} canEdit />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remover hemograma.pdf' }));
    expect(mockRemove).not.toHaveBeenCalled();
    const destructive = alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!;
    await destructive.onPress!();
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(target, pdf));
  });
});
