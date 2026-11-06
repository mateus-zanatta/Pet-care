import { forgotSchema, loginSchema, registerSchema } from './schemas';

const issues = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => `${String(i.path[0])}:${i.message}`);

describe('loginSchema', () => {
  it('aceita e-mail e senha', () => {
    expect(loginSchema.safeParse({ email: ' ana@exemplo.com ', password: 'x' }).success).toBe(true);
  });
  it('rejeita e-mail inválido e senha vazia', () => {
    expect(issues(loginSchema.safeParse({ email: 'ana', password: '' }))).toEqual([
      'email:validation.emailInvalid',
      'password:validation.required',
    ]);
  });
});

describe('registerSchema', () => {
  const ok = { name: 'Ana Souza', email: 'ana@exemplo.com', password: 'Girassol#Azul42', acceptTerms: true };

  it('aceita cadastro com senha forte', () => {
    expect(registerSchema.safeParse(ok).success).toBe(true);
  });
  it('recusa senha fraca, batida ou com dados pessoais', () => {
    for (const password of ['abc1', 'senha1234', 'Abcdefghij1', 'Senha@2024!', 'Ana#Souza2026']) {
      expect(issues(registerSchema.safeParse({ ...ok, password }))).toContain('password:validation.passwordWeak');
    }
    expect(issues(registerSchema.safeParse({ ...ok, password: '' }))).toContain('password:validation.required');
  });
  it('exige aceitar os termos', () => {
    expect(issues(registerSchema.safeParse({ ...ok, acceptTerms: false }))).toEqual(['acceptTerms:validation.termsRequired']);
  });
});

describe('forgotSchema', () => {
  it('valida o e-mail', () => {
    expect(forgotSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(forgotSchema.safeParse({ email: 'a@b' }).success).toBe(false);
  });
});
