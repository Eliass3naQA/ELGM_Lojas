// Sugestões de variações por segmento da loja, para agilizar o cadastro de produtos.
// O lojista pode criar qualquer opção; estas são só atalhos.

export type OptionTemplate = { name: string; values: string[] };

const T = {
  tamanhoRoupa: { name: "Tamanho", values: ["PP", "P", "M", "G", "GG"] },
  cor: { name: "Cor", values: ["Preto", "Branco", "Azul", "Bege"] },
  numeracao: { name: "Numeração", values: ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44"] },
  peso: { name: "Peso", values: ["250g", "500g", "1kg"] },
  moagem: { name: "Moagem", values: ["Grãos", "Fina", "Média", "Grossa"] },
  sabor: { name: "Sabor", values: ["Tradicional", "Chocolate", "Baunilha"] },
  voltagem: { name: "Voltagem", values: ["110V", "220V", "Bivolt"] },
  armazenamento: { name: "Armazenamento", values: ["64GB", "128GB", "256GB"] },
  tamanhoGenerico: { name: "Tamanho", values: ["P", "M", "G"] },
  volume: { name: "Volume", values: ["30ml", "50ml", "100ml"] },
} satisfies Record<string, OptionTemplate>;

const bySegment: Record<string, OptionTemplate[]> = {
  moda: [T.tamanhoRoupa, T.cor, T.numeracao],
  calçados: [T.numeracao, T.cor],
  alimentos: [T.peso, T.moagem, T.sabor],
  bebidas: [T.volume, T.sabor],
  eletrônicos: [T.voltagem, T.cor, T.armazenamento],
  "casa & jardim": [T.tamanhoGenerico, T.cor, T.voltagem],
  esportes: [T.tamanhoRoupa, T.cor, T.numeracao],
  beleza: [T.volume, T.cor],
};

export function optionTemplatesFor(category: string): OptionTemplate[] {
  const key = category.trim().toLowerCase();
  return bySegment[key] ?? [T.tamanhoGenerico, T.cor];
}
