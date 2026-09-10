/** Verificação de disponibilidade de um componente de infraestrutura. */
export interface HealthProbe {
  readonly name: string;
  /** Deve rejeitar quando o componente estiver indisponível. */
  check(): Promise<void>;
}
