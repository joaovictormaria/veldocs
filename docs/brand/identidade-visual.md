# VELDOCS — Identidade visual

> Fonte oficial: [`VELDOCS-logo.pdf`](./VELDOCS-logo.pdf), entregue pelo usuário em 2026-09-11. Ecossistema: **VELNOX.IA**.

## Marca

- **Nome:** VELDOCS (VEL em neutro + DOCS em gradiente azul → ciano)
- **Assinatura:** Gestão inteligente de documentos empresariais.
- **Endosso:** by VELNOX.IA
- **Símbolo:** documento com dobra no canto e um "V" de verificação — organização e conformidade documental.

## Paleta oficial

| Nome | Hex | Token CSS | Uso |
|---|---|---|---|
| Azul principal | `#3D5AFE` | `--brand-primary` | elementos de marca, botões e destaques gráficos |
| Azul escuro | `#2541B2` | `--brand-dark` | texto de destaque e links sobre fundo claro |
| Ciano | `#00E5FF` | `--brand-cyan` | texto de destaque sobre fundo escuro, gradientes |

Superfícies do quadro da marca (fundo das logos recortadas):

| Nome | Hex | Token CSS |
|---|---|---|
| Superfície clara | `#FBFAFA` | `--surface-light` |
| Superfície escura | `#121317` | `--surface-dark` |

Constantes equivalentes em [`src/presentation/brand.ts`](../../src/presentation/brand.ts); um teste unitário garante que CSS e código usam os mesmos valores. No Tailwind, os tokens viram as cores `brand-primary`, `brand-dark`, `brand-cyan`, `surface-light` e `surface-dark` (`@theme` em `src/app/globals.css`).

> Acessibilidade: para texto pequeno, use o azul escuro sobre fundo claro e o ciano sobre fundo escuro. O azul principal fica reservado a elementos gráficos e textos grandes.

## Arquivos no projeto

| Arquivo | Dimensões | Uso |
|---|---|---|
| `public/brand/veldocs-logo-light.png` | 470 × 186, fundo transparente | logo completa para fundos claros |
| `public/brand/veldocs-logo-dark.png` | 476 × 186, fundo transparente | logo completa para fundos escuros |
| `public/brand/veldocs-icon.png` | 158 × 158, cantos arredondados | ícone do app |
| `src/app/icon.png` | 192 × 192 | ícone do site (convenção `icon` do Next.js) |
| `src/app/apple-icon.png` | 180 × 180 | ícone para iOS (convenção `apple-icon`) |
| `src/app/favicon.ico` | 48, 32 e 16 px | favicon (convenção `favicon`) |

Os arquivos foram recortados da imagem embutida no PDF (1536 × 1024, raster) com ImageMagick: logos recortadas dos painéis claro e escuro com o fundo liso removido; ícone recortado do "Ícone / App" com máscara de cantos arredondados.

## Regras de uso

- Não distorcer, girar, recolorir nem aplicar sombras/efeitos à logo.
- Usar a versão clara em fundos claros e a escura em fundos escuros; a página inicial alterna automaticamente pelo tema do sistema.
- Manter área de respiro ao redor da logo de pelo menos a altura do símbolo "V".
- A versão monocromática (preta) do quadro da marca serve para impressão e usos sem cor.

## Pendências

- **Arquivos vetoriais (SVG) originais** da logo e do ícone: o PDF recebido contém apenas uma imagem raster. Com os vetores, gerar versões nítidas em qualquer tamanho e substituir os recortes.
- Tipografia oficial não informada no quadro da marca.
- Design system completo (componentes, espaçamentos, tipografia) — pendente.
