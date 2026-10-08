# Production image size

The production image is measured from the repository root with Docker BuildKit
using the same command and base image for both revisions:

```sh
docker build --tag shsf:measure .
docker image inspect shsf:measure --format 'SIZE={{.Size}}'
docker history --no-trunc --format '{{.Size}}\t{{.CreatedBy}}' shsf:measure
```

The baseline (the image before this change) was `323,775,687` bytes (323.8 MB).
Its largest runtime layer was the second production install and Prisma
generation at 875 MB before compression/metadata accounting.

The resulting image is `187,963,500` bytes (188.0 MB), a reduction of
`135,812,187` bytes (42.0%). Its largest application layer is the copied,
pruned production `Backend/node_modules` tree at 421 MB before compression.

The runtime stage now receives dependencies and the generated Prisma client
from the build stage after `pnpm prune --prod`. Corepack, pnpm, the package
manager cache, development dependencies, and the second install/generation
step are build-only. The runtime still includes OpenSSL, Prisma CLI metadata
and migrations for `prisma migrate deploy`, compiled backend/UI assets, and
`fill_examples`, which are required by startup or the running application.
The runtime also retains `pino-pretty` because the development Compose/preview
workflow sets `NODE_ENV=development` while using this same image.

To inspect a future build, compare both the image size and the top-level
`docker history` entries; do not include BuildKit cache or downloaded function
runtime images in the measurement.
