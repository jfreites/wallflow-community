# Wallflow Community

Obras enviadas por artistas para la fuente **Comunidad** de [Wallflow](https://github.com/jfreites/wallflow), la app de wallpapers para macOS.

## ¿Eres artista? Suma tu obra

1. Revisa los [lineamientos](LINEAMIENTOS.md): formato horizontal, mínimo 2560×1440, JPG o PNG.
2. Envíala desde el formulario: **[enlace al formulario](https://docs.google.com/forms/d/e/1FAIpQLSdiI5cEii51oTpfTRgt8xx0WBsDXxrhw85obPDpyP9KK_a62g/viewform)**. Tienes que iniciar sesión con una cuenta de Google.
3. Revisamos cada envío a mano. Cuando la obra se publica, aparece en Wallflow con tu nombre y un enlace a tu perfil.

Cada artista elige su licencia: **CC0** (dominio público) o **CC BY 4.0** (uso libre con crédito).

## Cómo funciona

Este repositorio no guarda imágenes. Contiene el catálogo (`manifest.json`) y los scripts que lo mantienen. Las imágenes y el catálogo publicado están en un bucket de Cloudflare R2, que Wallflow lee directamente:

```
<PUBLIC_BASE_URL>/manifest.json
<PUBLIC_BASE_URL>/artworks/<id>/full.jpg      lado mayor ≤ 5120 px, JPEG q90
<PUBLIC_BASE_URL>/artworks/<id>/preview.jpg   1280 px de ancho
<PUBLIC_BASE_URL>/artworks/<id>/thumb.jpg     400 px de ancho
```

### Formato del manifest

```json
{
  "version": 1,
  "updatedAt": "2026-11-01T00:00:00Z",
  "items": [{
    "id": "aurora-boreal-ana-perez",
    "title": "Aurora boreal",
    "author": "Ana Pérez",
    "authorUrl": "https://instagram.com/…",
    "license": "CC0-1.0",
    "tags": ["paisaje", "noche"],
    "width": 5120, "height": 2880,
    "addedAt": "2026-11-01"
  }]
}
```

`license` es un identificador SPDX: `CC0-1.0` o `CC-BY-4.0`. `authorUrl` y `tags` son opcionales.

## Publicar obras (mantenimiento)

Requisitos: Node 22 o superior, pnpm, y un token de R2 con permiso de lectura y escritura sobre el bucket.

```sh
pnpm install
cp .env.example .env   # completar las credenciales de R2 y la URL pública
```

**Agregar una obra.** Valida los lineamientos, genera los 3 tamaños sin metadatos, los sube a R2 y agrega la entrada al `manifest.json` local:

```sh
pnpm artwork:add ~/Downloads/aurora.png \
  --title "Aurora boreal" --author "Ana Pérez" --license cc-by \
  --url https://instagram.com/anaperez --tags paisaje,noche
```

Agrega `--dry-run` para validar sin subir nada: las imágenes quedan en `.out/<id>/`. `--date AAAA-MM-DD` cambia la fecha de alta, que por defecto es la de hoy.

**Publicar.** Valida el manifest, comprueba que todas las imágenes estén en R2 y lo sube. Las obras aparecen en Wallflow en un minuto, como mucho:

```sh
pnpm manifest:publish
git commit -am "Agregar «Aurora boreal» de Ana Pérez" && git push
```

**Retirar una obra.** Borra sus imágenes de R2 y la quita del manifest:

```sh
pnpm artwork:remove aurora-boreal-ana-perez
pnpm manifest:publish
```

> Usa los nombres `artwork:*` y `manifest:*`: `pnpm add` y `pnpm publish` son comandos propios de pnpm.
