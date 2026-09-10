# True North — Logo, Symbol & Favicon kit

Opção escolhida: **1a — estrela dourada sobre navy**. Comparativo em `../Favicon Options.dc.html`.

## Cores
- Navy (fundo / ink): `#012358`
- Gold (estrela): `#F2C40A`
- Teal (acento, não usado no favicon): `#1E7D7F`

## Arquivos

| Arquivo | Uso |
|---|---|
| `favicon.svg` | Favicon principal (browsers modernos). Estrela completa + disco central. |
| `favicon-small.svg` | Versão simplificada (só estrela) — fonte dos PNGs 16/32. |
| `favicon.ico` | Fallback legado. Contém 16, 32 e 48px. |
| `favicon-16x16.png`, `favicon-32x32.png` | Rasters da versão simplificada. |
| `favicon-48x48.png` | Raster da versão completa. |
| `apple-touch-icon.png` | 180×180, iOS home screen. |
| `icon-192.png`, `icon-512.png` | PWA / manifest. |
| `icon-maskable-512.png`, `maskable.svg` | PWA maskable (fundo navy sem raio, símbolo a 80%). |
| `symbol.svg`, `symbol-512.png` | Símbolo isolado (transparente) — top bar, loading, avatar padrão. |
| `site.webmanifest` | Manifest pronto; ajustar caminhos se não usar `/icons/`. |
| `logo-teal-navy.png` | Logo completo com wordmark (transparente). Em superfícies escuras, colocar sobre chip branco arredondado. |

## Implementação

Copiar tudo para `public/icons/` (e `favicon.ico` também para `public/`), depois no `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/icons/site.webmanifest">
<meta name="theme-color" content="#012358">
```

Next.js App Router: alternativamente `favicon.svg` → `app/icon.svg`, `apple-touch-icon.png` → `app/apple-icon.png`, `site.webmanifest` → `app/manifest.webmanifest`; o Next gera as tags.

## Regras de uso do símbolo
- Área de proteção: ~10% do lado em cada borda (já incluída nos SVGs).
- Raio do container: 14/64 do lado (≈22%). Sem raio no maskable.
- Abaixo de 24px usar a versão simplificada (sem disco central).
- Não recolorir a estrela. Em fundo claro sem container, usar `symbol.svg`.
