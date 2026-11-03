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
  const ok = { name: 'Ana', email: 'ana@exemplo.com', password: 'senha1234', acceptTerms: true };

  it('aceita cadastro válido', () => {
    expect(registerSchema.safeParse(ok).success).toBe(true);
  });
  it('exige senha com 8+ caracteres, letras e números', () => {
    expect(issues(registerSchema.safeParse({ ...ok, password: 'abc1' }))).toContain('password:validation.passwordTooShort');
    expect(issues(registerSchema.safeParse({ ...ok, password: '12345678' }))).toContain('password:validation.passwordWeak');
    expect(issues(registerSchema.safeParse({ ...ok, password: 'abcdefgh' }))).toContain('password:validation.passwordWeak');
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
