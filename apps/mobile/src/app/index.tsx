import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Rota inicial explícita: quem está logado (ou sem cadastro) vai para a Home;
 * quem não tem sessão vai para as boas-vindas. As rotas protegidas do layout
 * também voltam para cá quando o login muda (ex.: ao sair da conta).
 */
export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/home' : '/welcome'} />;
}
