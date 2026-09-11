# VELDOCS — Arquivos dos documentos

Fonte da verdade: `src/app/api/documents/[documentId]/files/`, [`src/application/documents/manage-document-files.ts`](../../src/application/documents/manage-document-files.ts), [`src/domain/documents/file-policy.ts`](../../src/domain/documents/file-policy.ts) e [`src/infrastructure/storage/`](../../src/infrastructure/storage/).

FASE 5 (MASTER SPEC 7.4, 7.5 e 8). O arquivo fica num **bucket privado S3 compatível** — Railway Storage Buckets em produção, MinIO no desenvolvimento e nos testes — e **nunca passa pelo servidor da aplicação**: o navegador envia e baixa direto do bucket por URLs assinadas de curta duração, emitidas depois da autorização.

## Endpoints

| Método | Rota | Permissão | Resposta |
|---|---|---|---|
| `GET` | `/api/documents/[documentId]/files` | `documents.read` | `{ files }` — só os disponíveis |
| `POST` | `/api/documents/[documentId]/files` | `documents.update` | `201 { file, upload }` — formulário assinado |
| `POST` | `/api/documents/[documentId]/files/[fileId]/complete` | `documents.update` | `{ file }` — conferido e disponível |
| `GET` | `/api/documents/[documentId]/files/[fileId]/download` | `documents.read` | `302` para a URL assinada |
| `DELETE` | `/api/documents/[documentId]/files/[fileId]` | `documents.update` | `204` |

Documento ou arquivo de outra empresa, inexistente ou com id inválido: `404`. Sem storage configurado no ambiente: `503 storage_unavailable`.

## Envio em três passos

```text
1. POST …/files           { fileName, contentType, sizeBytes }
   servidor confere o declarado e emite um formulário assinado (10 min)
2. POST <upload.url>      campos de upload.fields + o arquivo por último
   o navegador envia direto ao bucket privado
3. POST …/files/[id]/complete
   servidor confere no bucket o tamanho e a assinatura do conteúdo
   → confere: AVAILABLE   → não confere: REJECTED e o objeto é apagado
```

A política assinada do passo 1 fixa **chave, tipo e tamanho máximo**: trocar o `Content-Type` ou mandar mais de 25 MB é recusado pelo próprio bucket (`403`).

## Regras

| Regra | Onde |
|---|---|
| Allowlist: PDF, JPEG, PNG e WebP | aplicação e CHECK no banco |
| Extensão do nome precisa combinar com o tipo | pedido de envio |
| Até 25 MB | pedido, política assinada e CHECK no banco |
| Conteúdo precisa ter a assinatura (magic bytes) do tipo declarado | conclusão, lendo o primeiro 1 KB do objeto |
| Tamanho recebido igual ao declarado | conclusão |
| Nome higienizado: sem diretórios, caracteres de controle ou proibidos, até 160 caracteres | pedido |
| Chave do objeto só com ids: `companies/{empresa}/documents/{documento}/files/{arquivo}` — nunca o nome original | domínio e CHECK no banco (a chave precisa bater com os ids da própria linha) |
| Toda operação no storage confere o prefixo da empresa antes de falar com o bucket | adaptador S3 |
| Download: URL assinada de 5 minutos, `Content-Disposition: attachment` com o nome higienizado | download |
| Remover tira o arquivo do documento, mas **o objeto continua no bucket** | exclusão lógica |

O storage não tem versionamento: apagar um objeto é irreversível. Por isso nada é apagado automaticamente — só o conteúdo recusado na conferência, que nunca chegou a ficar disponível.

## Auditoria

`document_file.uploaded`, `document_file.rejected` (com o motivo), `document_file.downloaded` e `document_file.deleted` — cada uma com documento, tipo e tamanho. Nome e conteúdo do arquivo não entram.

## Ambientes

| Variável | Uso |
|---|---|
| `STORAGE_ENDPOINT` | endereço do storage para o servidor |
| `STORAGE_PUBLIC_ENDPOINT` | endereço usado pelo navegador (só difere dentro do docker-compose) |
| `STORAGE_REGION` | `auto` no Railway, `us-east-1` no MinIO |
| `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | bucket e credenciais |
| `STORAGE_FORCE_PATH_STYLE` | `true` no MinIO (`http://host/bucket`), `false` no Railway (`https://bucket.host`) |

Sem as quatro variáveis obrigatórias, o envio fica desligado e a tela avisa. Fora de development, os endereços precisam ser `https` e a senha do MinIO local é recusada. A CSP libera para conexões **só** a origem do bucket, calculada da configuração.

Em produção, as variáveis do serviço são **referências** às do bucket no Railway, e o bucket tem CORS liberado apenas para a origem da aplicação.

## Pendências

- **Antivírus** (MASTER SPEC 7.4): hoje a proteção é allowlist de formatos de documento, assinatura do conteúdo e limite de tamanho, sem executáveis, compactados ou formatos com macros. A varredura por antivírus fica pendente e é obrigatória antes do portal de terceiros (FASE 10) — ver DEC-035.
- Limpeza de envios que não foram concluídos (`PENDING` vencido) e política de retenção dos objetos removidos.
- Versões do arquivo (FASE 6): hoje cada envio é um novo arquivo, e os anteriores continuam guardados.

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/domain/documents/file-policy.test.ts`](../../tests/unit/domain/documents/file-policy.test.ts), [`tests/unit/application/documents/manage-document-files.test.ts`](../../tests/unit/application/documents/manage-document-files.test.ts), [`tests/unit/infrastructure/storage/storage.test.ts`](../../tests/unit/infrastructure/storage/storage.test.ts) |
| Integração (PostgreSQL + MinIO) | [`tests/integration/documents/document-files.test.ts`](../../tests/integration/documents/document-files.test.ts) |
| E2E | [`tests/e2e/document-files.spec.ts`](../../tests/e2e/document-files.spec.ts) |
