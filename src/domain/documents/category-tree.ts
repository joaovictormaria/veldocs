/**
 * Categorias em árvore (MASTER SPEC 10.1): categoria, subcategoria e mais um
 * nível. O limite existe para a navegação continuar compreensível e para
 * qualquer caminho caber na tela.
 */
export const MAX_CATEGORY_DEPTH = 3;

export interface CategoryNode {
  readonly id: string;
  readonly parentId: string | null;
}

type Nodes = ReadonlyMap<string, CategoryNode>;

export function toNodeMap(categories: readonly CategoryNode[]): Map<string, CategoryNode> {
  return new Map(categories.map((category) => [category.id, category]));
}

/** Do pai até a raiz. Interrompe em ciclo, que o banco já impede de existir. */
export function ancestorsOf(categoryId: string, nodes: Nodes): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([categoryId]);

  let current = nodes.get(categoryId)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = nodes.get(current)?.parentId ?? null;
  }
  return chain;
}

/** Nível da categoria: 1 para as raízes. */
export function depthOf(categoryId: string, nodes: Nodes): number {
  return ancestorsOf(categoryId, nodes).length + 1;
}

/** Quantos níveis a subárvore ocupa: 1 quando a categoria não tem filhas. */
export function subtreeHeight(categoryId: string, nodes: Nodes): number {
  const children = [...nodes.values()].filter((node) => node.parentId === categoryId);
  return children.length === 0 ? 1 : 1 + Math.max(...children.map((child) => subtreeHeight(child.id, nodes)));
}

export function isDescendantOf(candidateId: string, ancestorId: string, nodes: Nodes): boolean {
  return ancestorsOf(candidateId, nodes).includes(ancestorId);
}

/**
 * Onde a categoria (com tudo que está abaixo dela) pode ser pendurada sem
 * passar do limite de níveis. `categoryId` nulo: categoria nova, ainda sem
 * subárvore.
 */
export function fitsUnder(parentId: string | null, categoryId: string | null, nodes: Nodes): boolean {
  const parentDepth = parentId === null ? 0 : depthOf(parentId, nodes);
  const height = categoryId === null ? 1 : subtreeHeight(categoryId, nodes);
  return parentDepth + height <= MAX_CATEGORY_DEPTH;
}

/** Caminho completo, da raiz até a categoria: ["Pessoal", "Admissão"]. */
export function pathOf(categoryId: string, names: ReadonlyMap<string, string>, nodes: Nodes): string[] {
  const path = [...ancestorsOf(categoryId, nodes)].reverse().map((id) => names.get(id) ?? id);
  path.push(names.get(categoryId) ?? categoryId);
  return path;
}
