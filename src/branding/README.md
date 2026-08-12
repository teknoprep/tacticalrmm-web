# Branding module

Everything that makes this build say **BlueCloud RMM** instead of Tactical RMM lives
here. Nothing else should hardcode a product name, a brand colour or a logo path.

## Why a module and not edits in place

The first version of this change edited `quasar.variables.sass`, `MainLayout.vue`,
`LoginView.vue` and overwrote three upstream asset files. That works and it is the
wrong shape: every one of those files belongs to amidaware, so every upstream release
becomes a merge conflict over our logo, and an overwritten `src/assets/logo.png` is a
change git cannot even show meaningfully.

So the brand is a module that upstream files *reference*. The footprint in upstream
files is now four one-line imports and two element swaps, which is about as small as
this can get without a fork-wide theming system.

## Contents

| File | Purpose |
|---|---|
| `index.ts` | the single source of truth: product name, logos, palette |
| `brand.sass` | Quasar palette variables, imported by `quasar.variables.sass` |
| `assets/logo.png` | standard logo, for LIGHT backgrounds |
| `assets/logo-reverse.png` | white logo, for DARK backgrounds (the toolbar) |
| `assets/logo-square.png` | 256x256, for PDFs and the script manager |
| `assets/favicon.ico` | multi-size ICO, master copy |

Two logos on purpose: the toolbar is dark, so the standard dark-text logo is invisible
there, and the login card and generated PDFs are light, so the white one is invisible
on those. One logo everywhere disappears somewhere.

## Where upstream files touch this

    quasar.variables.sass      @import "../branding/brand.sass"
    src/layouts/MainLayout.vue BRAND.name + BRAND.logoReverse
    src/views/LoginView.vue    BRAND.name + BRAND.logoSquare
    package.json               productName (drives <title> via index.html)
    public/favicon.ico         copy of assets/favicon.ico -- Quasar serves public/ verbatim

`public/favicon.ico` is a copy rather than a reference because Quasar copies `public/`
verbatim into the build and does not resolve imports there. `npm run brand:sync`
refreshes it, so the master stays in this directory.

## Changing the brand

Edit `index.ts` and `brand.sass`. Colours came from the compiled stylesheet on
www.blueuc.com (`--primary: #00C4FF`, `--o-color-5: #1B1319`), not from a screenshot,
so they match the website exactly rather than approximately.
