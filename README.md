# geojson.js

Turn plain JS objects into [GeoJSON](https://geojson.org). A modernized,
dependency-free reimplementation of the classic
[`GeoJSON.js`](https://github.com/caseycesari/GeoJSON.js) package: same core
idea, rebuilt with a modern toolchain (native ESM + CJS via `tsup`, tests
with Vitest, linting with Biome, CI with GitHub Actions, dependency updates
via Renovate).

[![npm version](https://img.shields.io/npm/v/geojson-modern)](https://www.npmjs.com/package/geojson-modern)
[![CI](https://github.com/LuisitoLuis/geojson.js/actions/workflows/ci.yml/badge.svg)](https://github.com/LuisitoLuis/geojson.js/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/LuisitoLuis/geojson.js/blob/main/LICENSE)
![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-339933)
![Types: TypeScript](https://img.shields.io/badge/types-TypeScript-3178c6)

## Install

```bash
npm install geojson.js
# or
pnpm install geojson.js
yarn install geojson.js
```

Requires Node.js 18 or later. Ships ESM, CJS, and TypeScript declarations.

## Usage

ESM:

```js
import { parse } from "geojson.js";

const data = [
  { name: "Location A", category: "Store", lat: 39.984, lng: -75.343 },
  { name: "Location B", category: "House", lat: 39.284, lng: -75.833 },
];

const geojson = parse(data, { Point: ["lat", "lng"] });
```

CommonJS:

```js
const { parse } = require("geojson-modern");
const geojson = parse(data, { Point: ["lat", "lng"] });
```

Or via the default export:

```js
const geojson = require("geojson.js").default;
geojson.parse(data, { Point: ["lat", "lng"] });
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

When a callback is passed as the third argument the function returns
`undefined` and the result is delivered to the callback:

```js
parse(data, { Point: ["lat", "lng"] }, (geojson) => {
  // do something with the FeatureCollection
});
```

## Features

On top of the original API, this fork supports:

- **3-tuple Point with altitude** — `Point: ["lat", "lng", "alt"]` produces
  `coordinates: [lng, lat, alt]`.
- **Dotted-path attribute names** — `Point: ["address.lat", "address.lng"]`
  walks into nested objects, useful when coordinates live under a sub-object.
- **GeoJSON pass-through** — `GeoJSON: "attr"` lets an item carry a
  pre-encoded GeoJSON geometry that gets used as-is.
- **Polygon from corner attributes** — `Polygon: { ne: ["lat", "lng"], sw: [...] }`
  builds a polygon from corner points that live in separate attributes
  (typical of address records). Each corner tuple accepts an optional
  altitude in the third position.
- **Module-level `defaults`** — set `defaults.Point = ["lat", "lng"]` once
  to skip repeating the same config on every call.

## Options

| Option | Type | Description |
|---|---|---|
| `Point` | `[string, string]` \| `[string, string, string]` | `[latAttr, lngAttr]` — the two item attributes holding lat/lng. Add a third element to include altitude (`[lng, lat, alt]`). |
| `LineString` / `MultiPoint` | `string` | attribute holding nested `[lat, lng]` coordinate data |
| `MultiLineString` | `string` | attribute holding an array of arrays of `[lat, lng]` pairs |
| `Polygon` | `string` \| `object` | string: attribute holding nested rings. object: `{ corner: [latAttr, lngAttr] \| [latAttr, lngAttr, altAttr] }` — builds a polygon from corner points that live in separate attributes |
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

Geometry type detection follows the order you specify in `parse()`'s second
argument; defaults fill in for anything you leave out.

### Examples

Pass-through GeoJSON geometries are useful when items already contain valid
GeoJSON:

```js
const data = [
  { name: "A", geo: { type: "Point", coordinates: [125.6, 10.1] } },
];
parse(data, { GeoJSON: "geo" });
```

Polygon corner points can live in separate attributes (e.g. an address
record with `ne` and `sw` keys), with optional altitude per corner:

```js
const data = [
  {
    name: "Block",
    ne: { lat: 10, lng: 20, alt: 100 },
    sw: { lat: 0, lng: 0, alt: 95 },
  },
];
parse(data, {
  Polygon: {
    ne: ["lat", "lng", "alt"],
    sw: ["lat", "lng", "alt"],
  },
});
```

Module-level defaults:

```js
import { defaults, parse } from "geojson-modern";

defaults.Point = ["lat", "lng"];
parse(data); // no need to repeat Point every time
```
## Why a fork?

The original `geojson` package is small, stable, and still works — but its
tooling (Grunt, PhantomJS, Travis CI, CommonJS-only) hasn't been touched
since 2019. This rewrite keeps the same simple API and behavior while
updating the tooling (native ESM/CJS dual output, Vitest instead of
Grunt+PhantomJS, Biome instead of JSHint, GitHub Actions + Renovate) and
backfills four features that the original had been missing.

## License

[MIT](https://github.com/LuisitoLuis/geojson.js/blob/main/LICENSE).
