import { classifyImportError, detectMime, rgaPhotoDataUri } from './rga.service';

jest.mock('@/core/firebase/callable', () => ({ callFunction: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

describe('detectMime', () => {
  it('usa o tipo informado pelo sistema', () => {
    expect(detectMime('x', 'application/pdf')).toBe('application/pdf');
    expect(detectMime('x', 'image/jpg')).toBe('image/jpeg');
    expect(detectMime('x', 'IMAGE/PNG')).toBe('image/png');
  });
  it('cai na extensão quando o sistema não informa o tipo', () => {
    expect(detectMime('Carteira RGA.PDF', '')).toBe('application/pdf');
    expect(detectMime('foto.jpeg', null)).toBe('image/jpeg');
    expect(detectMime('print.png', undefined)).toBe('image/png');
  });
  it('recusa o resto', () => {
    expect(detectMime('doc.docx', 'application/vnd.openxmlformats')).toBeNull();
    expect(detectMime('semextensao', '')).toBeNull();
  });
});

describe('classifyImportError', () => {
  it('conta sem permissão', () => {
    expect(classifyImportError({ code: 'functions/permission-denied' })).toBe('accountRequired');
    expect(classifyImportError({ code: 'functions/unauthenticated' })).toBe('accountRequired');
  });
  it('falha de rede', () => {
    expect(classifyImportError({ code: 'functions/unavailable' })).toBe('network');
    expect(classifyImportError(new TypeError('Network request failed'))).toBe('network');
    // renovar o token de login nos emuladores sem alcançá-los (o caso do celular que perdeu o PC)
    expect(classifyImportError({ code: 'auth/network-request-failed', message: '[auth/network-request-failed] A network error' })).toBe('network');
  });
  it('o resto é genérico', () => {
    expect(classifyImportError(new Error('boom'))).toBe('generic');
    expect(classifyImportError(null)).toBe('generic');
  });
});

describe('rgaPhotoDataUri', () => {
  it('monta o endereço de exibição da foto sem precisar de arquivo temporário', () => {
    expect(rgaPhotoDataUri('QUJD')).toBe('data:image/jpeg;base64,QUJD');
  });
});
