# geojson.js-modern

Turn plain JS objects into [GeoJSON](https://geojson.org). A modernized,
dependency-free ESM reimplementation of the classic
[`geojson`](https://github.com/caseycesari/GeoJSON.js) package: same core
idea, rebuilt with a modern toolchain (native ESM + CJS via `tsup`, tests
with Vitest, linting with Biome, CI with GitHub Actions, dependency updates
via Renovate).

## Install

```bash
npm install geojson-modern
```

## Usage

```js
import { parse } from "geojson-modern";

const data = [
  { name: "Location A", category: "Store", lat: 39.984, lng: -75.343 },
  { name: "Location B", category: "House", lat: 39.284, lng: -75.833 },
];

const geojson = parse(data, { Point: ["lat", "lng"] });
```

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-75.343, 39.984] },
      "properties": { "name": "Location A", "category": "Store" }
    }
  ]
}
```

### Options

| Option | Type | Description |
|---|---|---|
| `Point` | `[string, string]` | `[latAttr, lngAttr]` — the two item attributes holding lat/lng |
| `LineString` / `MultiLineString` / `Polygon` / `MultiPolygon` / `MultiPoint` | `string` | attribute holding nested `[lat, lng]` coordinate data |
| `include` | `string[]` | whitelist of attributes to keep in `properties` |
| `exclude` | `string[]` | blacklist of attributes to drop from `properties` |
| `extra` | `object \| (item) => object` | extra properties merged into each feature |
| `extraGlobal` | `object` | properties merged into the `FeatureCollection` itself |
| `bbox` | `boolean` | compute a bounding box for the collection and each feature |
| `crs` | `object` | attach a `crs` member to the output |
| `removeInvalidGeometries` | `boolean` | skip items with missing/invalid geometry instead of throwing |

A callback can be passed as the third argument instead of using the return
value: `parse(data, params, (geojson) => { ... })`.

Repeated defaults can be set once:

```js
import { defaults, parse } from "geojson-modern";

defaults.Point = ["lat", "lng"];
parse(data); // no need to repeat Point every time
```

## Development

```bash
npm install
npm test        # vitest run
npm run lint     # biome check
npm run build    # tsup -> dist/ (ESM + CJS + .d.ts)
```

## Why a fork?

The original `geojson` package is small, stable, and still works — but its
tooling (Grunt, PhantomJS, Travis CI, CommonJS-only) hasn't been touched
since 2019. This rewrite keeps the same simple API and behavior while
updating the tooling: native ESM/CJS dual output, Vitest instead of
Grunt+PhantomJS, Biome instead of JSHint, and GitHub Actions + Renovate for
CI/CD.

## License

MIT-(https://github.com/LuisitoLuis/geojson.js-modern) (MIT).
