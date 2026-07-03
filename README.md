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
| `Point` | `[string, string]` \| `[string, string, string]` | `[latAttr, lngAttr]` — the two item attributes holding lat/lng. Add a third element to include altitude (`[lng, lat, alt]`). |
| `LineString` / `MultiPoint` | `string` | attribute holding nested `[lat, lng]` coordinate data |
| `MultiLineString` | `string` | attribute holding an array of arrays of `[lat, lng]` pairs |
| `Polygon` | `string` \| `object` | string: attribute holding nested rings. object: `{ corner: [latAttr, lngAttr] }` shape, builds a polygon from corner points that live in separate attributes |
| `MultiPolygon` | `string` | attribute holding nested polygon coordinates |
| `GeoJSON` | `string` | pass-through: attribute holding a pre-encoded GeoJSON geometry object `{ type, coordinates, ... }` |
| `include` | `string[]` | whitelist of attributes to keep in `properties` |
| `exclude` | `string[]` | blacklist of attributes to drop from `properties` |
| `extra` | `object \| (item) => object` | extra properties merged into each feature |
| `extraGlobal` | `object` | properties merged into the `FeatureCollection` itself |
| `bbox` | `boolean` | compute a bounding box for the collection and each feature |
| `crs` | `object` | attach a `crs` member to the output |
| `removeInvalidGeometries` | `boolean` | skip items with missing/invalid geometry instead of throwing |

Attribute names accept dot notation to reach into nested objects:
`Point: ['address.lat', 'address.lng']`.

A callback can be passed as the third argument instead of using the return
value: `parse(data, params, (geojson) => { ... })`.

Repeated defaults can be set once:

```js
import { defaults, parse } from "geojson-modern";

defaults.Point = ["lat", "lng"];
parse(data); // no need to repeat Point every time
```

Geometry type detection follows the order you specify in `parse()`'s
second argument; defaults fill in for anything you leave out. Pass-through
GeoJSON geometries are useful when items already contain valid GeoJSON:

```js
const data = [
  { name: "A", geo: { type: "Point", coordinates: [125.6, 10.1] } },
];
parse(data, { GeoJSON: "geo" });
```

Polygon corner points can live in separate attributes (e.g. an address
record with `ne` and `sw` keys):

```js
const data = [
  { name: "Block", ne: { lat: 10, lng: 20 }, sw: { lat: 0, lng: 0 } },
];
parse(data, {
  Polygon: {
    ne: ["lat", "lng"],
    sw: ["lat", "lng"],
  },
});
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

[MIT](https://github.com/LuisitoLuis/geojson.js-modern/blob/main/LICENSE).
