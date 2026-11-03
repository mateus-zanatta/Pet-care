export type TextItem = { text: string; x: number; y: number };

/** O mínimo que precisamos do pdf.js (facilita testar sem um PDF de verdade). */
export type PdfDocumentLike = {
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: unknown[] }>;
  }>;
};

/**
 * Lê os itens de texto da página 1 com suas posições. No pdf.js, x = transform[4] e
 * y = transform[5] (linha de base; origem no canto inferior esquerdo).
 */
export async function extractTextItems(pdf: PdfDocumentLike): Promise<TextItem[]> {
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of content.items) {
    const item = raw as { str?: unknown; transform?: unknown };
    if (typeof item.str !== 'string' || !Array.isArray(item.transform)) continue; // marcadores sem texto
    const [, , , , x, y] = item.transform as number[];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    items.push({ text: item.str, x, y });
  }
  return items;
}
