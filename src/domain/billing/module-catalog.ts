/**
 * Catálogo comercial de módulos (MASTER SPEC 2.2, 2.3 e 2.6).
 *
 * O Core é obrigatório e não pode ser removido. Os demais módulos são
 * contratáveis por empresa.
 *
 * Preços NÃO ficam aqui: a spec (2.3) define que serão decididos
 * comercialmente depois e a spec (2.5) exige que o preço vigente venha do
 * banco. Aqui fica apenas a identidade de cada módulo e suas dependências.
 */

export const CORE_MODULE_KEY = "core";

/** Chaves do catálogo. A ordem é a de exibição no Builder. */
export const MODULE_KEYS = [
  CORE_MODULE_KEY,
  "vencimentos",
  "funcionarios",
  "fornecedores",
  "contratos",
  "solicitacoes",
  "aprovacoes",
  "automacao",
  "analise-documentos",
  "assistente-ia",
  "whatsapp",
  "portal-terceiros",
  "relatorios-avancados",
  "ocr",
  "score-documental",
  "radar-risco",
  "modo-auditoria",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleDefinition {
  readonly key: ModuleKey;
  readonly name: string;
  readonly description: string;
  /** Frase de benefício exibida no Builder (MASTER SPEC 2.4). */
  readonly benefit: string;
  readonly isCore: boolean;
  /**
   * Outros módulos exigidos para ativar este. O Core é exigido de todos e
   * não precisa ser repetido aqui.
   */
  readonly dependsOn: readonly ModuleKey[];
}

const define = (
  key: ModuleKey,
  name: string,
  description: string,
  benefit: string,
  dependsOn: readonly ModuleKey[] = [],
): ModuleDefinition => ({ key, name, description, benefit, isCore: key === CORE_MODULE_KEY, dependsOn });

/**
 * Ordem = ordem de exibição no Builder.
 *
 * Dependências: a spec só declara uma explicitamente ("WhatsApp depende de
 * Gestão documental", que é Core e portanto implícito). Qualquer outra
 * dependência é decisão comercial e deve ser registrada aqui antes de valer.
 */
export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  define(
    CORE_MODULE_KEY,
    "Core",
    "Empresa, usuários, autenticação, permissões, gestão documental, storage e dashboard básico.",
    "A base do VELDOCS: sem ela o produto não existe.",
  ),
  define(
    "vencimentos",
    "Controle de vencimentos",
    "Acompanhamento de validade dos documentos, com alertas antes do vencimento.",
    "Nenhum documento vence sem aviso.",
  ),
  define(
    "funcionarios",
    "Funcionários",
    "Documentos vinculados a cada funcionário e ao seu cargo.",
    "A documentação da equipe sempre em dia.",
  ),
  define(
    "fornecedores",
    "Fornecedores",
    "Documentos e regularidade dos fornecedores.",
    "Contrate sabendo quem está regular.",
  ),
  define("contratos", "Contratos", "Ciclo de vida dos contratos, prazos e renovações.", "Nenhuma renovação esquecida."),
  define(
    "solicitacoes",
    "Solicitações",
    "Pedidos de documentos para pessoas dentro e fora da empresa.",
    "Peça e receba documentos sem perder o controle.",
  ),
  define(
    "aprovacoes",
    "Aprovações",
    "Fluxos de aprovação com responsáveis e histórico.",
    "Cada documento aprovado por quem tem autoridade.",
  ),
  define(
    "automacao",
    "Automação",
    "Regras automáticas para alertas, cobranças e rotinas documentais.",
    "O sistema cobra por você.",
  ),
  define(
    "analise-documentos",
    "Análise inteligente de documentos",
    "Leitura automática do conteúdo dos documentos e extração de informações-chave.",
    "O sistema entende o que está no documento.",
  ),
  define(
    "assistente-ia",
    "Assistente IA",
    "Assistente que responde perguntas sobre a documentação da empresa.",
    "Pergunte em vez de procurar.",
  ),
  define(
    "whatsapp",
    "WhatsApp",
    "Consultas e avisos pelo WhatsApp.",
    "A documentação no canal que a equipe já usa.",
    // Única dependência declarada na spec (2.6): depende da gestão
    // documental, que é Core.
  ),
  define(
    "portal-terceiros",
    "Portal de terceiros",
    "Área externa para fornecedores e parceiros enviarem documentos.",
    "Terceiros enviam documentos sem acessar o sistema interno.",
  ),
  define(
    "relatorios-avancados",
    "Relatórios avançados",
    "Relatórios detalhados e exportações da situação documental.",
    "Os números prontos para a diretoria.",
  ),
  define(
    "ocr",
    "OCR / extração de dados",
    "Reconhecimento de texto em documentos digitalizados.",
    "Documento escaneado vira informação pesquisável.",
  ),
  define(
    "score-documental",
    "Score documental",
    "Indicador do nível de regularidade documental da empresa.",
    "Uma nota que resume a saúde documental.",
  ),
  define(
    "radar-risco",
    "Radar de risco",
    "Destaque para os pontos de risco documental mais urgentes.",
    "Veja primeiro o que pode causar problema.",
  ),
  define(
    "modo-auditoria",
    "Modo auditoria",
    "Visão e exportação preparadas para auditorias e fiscalizações.",
    "Chegue na auditoria com tudo organizado.",
  ),
];

const BY_KEY = new Map(MODULE_CATALOG.map((module) => [module.key, module]));

export function findModule(key: string): ModuleDefinition | undefined {
  return BY_KEY.get(key as ModuleKey);
}

export function isModuleKey(key: string): key is ModuleKey {
  return BY_KEY.has(key as ModuleKey);
}

export function isCoreModule(key: string): boolean {
  return key === CORE_MODULE_KEY;
}

/**
 * Expande a seleção incluindo as dependências (transitivas) de cada módulo.
 * O Core é sempre incluído: é obrigatório (2.2).
 */
export function withDependencies(selection: readonly string[]): string[] {
  const resolved = new Set<string>([CORE_MODULE_KEY]);

  const visit = (key: string) => {
    if (resolved.has(key)) return;
    resolved.add(key);
    for (const dependency of findModule(key)?.dependsOn ?? []) visit(dependency);
  };

  for (const key of selection) visit(key);

  // Preserva a ordem do catálogo.
  return MODULE_KEYS.filter((key) => resolved.has(key));
}

/** Dependências que faltam na seleção (vazio = seleção válida). */
export function missingDependencies(selection: readonly string[]): string[] {
  const selected = new Set(selection);
  const missing = new Set<string>();

  for (const key of selection) {
    for (const dependency of findModule(key)?.dependsOn ?? []) {
      if (!selected.has(dependency)) missing.add(dependency);
    }
  }

  return [...missing].sort();
}
