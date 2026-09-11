import { CORE_MODULE_KEY, MODULE_KEYS, type ModuleKey } from "./module-catalog";

/**
 * Kits comerciais (MASTER SPEC 2.7), definidos pelo usuário em 2026-09-11.
 *
 * Camada opcional sobre os módulos: a compra avulsa continua existindo e um
 * kit pode ser combinado com módulos fora dele (DEC-024). Preços não ficam
 * aqui — vêm do banco (`kit_prices`), como os dos módulos.
 *
 * Módulos listados na ordem do catálogo.
 */
export const KIT_KEYS = ["essencial", "gestao", "inteligencia", "comunicacao", "controle-avancado", "complete"] as const;

export type KitKey = (typeof KIT_KEYS)[number];

export interface KitDefinition {
  readonly key: KitKey;
  readonly name: string;
  /** "Indicado para", como na tabela do usuário. */
  readonly audience: string;
  readonly modules: readonly ModuleKey[];
}

export const KIT_CATALOG: readonly KitDefinition[] = [
  {
    key: "essencial",
    name: "Essencial",
    audience: "Empresas que querem começar",
    // Na tabela do usuário: "Core + Vencimentos + Alertas". Os alertas fazem
    // parte do Controle de vencimentos; não existe módulo "Alertas".
    modules: [CORE_MODULE_KEY, "vencimentos"],
  },
  {
    key: "gestao",
    name: "Gestão",
    audience: "Empresas que controlam pessoas e fornecedores",
    modules: [CORE_MODULE_KEY, "vencimentos", "funcionarios", "fornecedores", "solicitacoes"],
  },
  {
    key: "inteligencia",
    name: "Inteligência",
    audience: "Empresas que querem IA e análise",
    modules: [CORE_MODULE_KEY, "analise-documentos", "assistente-ia", "ocr", "score-documental", "radar-risco"],
  },
  {
    key: "comunicacao",
    name: "Comunicação",
    audience: "Empresas que precisam interagir com terceiros",
    modules: [CORE_MODULE_KEY, "solicitacoes", "whatsapp", "portal-terceiros"],
  },
  {
    key: "controle-avancado",
    name: "Controle Avançado",
    audience: "Empresas com processos mais estruturados",
    modules: [CORE_MODULE_KEY, "contratos", "aprovacoes", "automacao", "relatorios-avancados", "modo-auditoria"],
  },
  {
    key: "complete",
    name: "Complete",
    audience: "Empresas que querem praticamente tudo",
    modules: MODULE_KEYS,
  },
];

const BY_KEY = new Map(KIT_CATALOG.map((kit) => [kit.key, kit]));

export function isKitKey(key: string): key is KitKey {
  return BY_KEY.has(key as KitKey);
}

export function findKit(key: string): KitDefinition | undefined {
  return BY_KEY.get(key as KitKey);
}
