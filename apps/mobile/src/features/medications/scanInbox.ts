import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Caixa de correio entre a tela de leitura do código de barras e o formulário que a abriu:
 * a leitura guarda o código aqui, volta para o formulário, e ele recolhe o código ao receber o foco.
 * (Evita passar o resultado por parâmetros de rota, que não funcionam bem ao voltar de uma tela.)
 */
let pending: string | null = null;

export function setScannedCode(code: string): void {
  pending = code;
}

/** Entrega o código guardado uma única vez. */
export function takeScannedCode(): string | null {
  const code = pending;
  pending = null;
  return code;
}

/** Código lido pela câmera (ou null). Atualiza toda vez que a tela volta a ter o foco. */
export function useScannedCode(): string | null {
  const [code, setCode] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const scanned = takeScannedCode();
      if (scanned) setCode(scanned);
    }, []),
  );
  return code;
}
