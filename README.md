<div align="center">

# geojson-esm

[![CI](https://img.shields.io/github/actions/workflow/status/LuisitoLuis/geojson.js/ci.yml?style=flat&label=CI&labelColor=0a0a0a)](https://github.com/LuisitoLuis/geojson.js/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-22c55e?style=flat&labelColor=0a0a0a)](https://github.com/LuisitoLuis/geojson.js/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat&labelColor=0a0a0a)](https://github.com/LuisitoLuis/geojson.js/blob/main/package.json)

[![npm](https://img.shields.io/npm/v/geojson-esm?style=for-the-badge&labelColor=0a0a0a)](https://www.npmjs.com/package/geojson-esm)

Turn plain objects into [GeoJSON](https://geojson.org). Same `parse` results as [GeoJSON.js](https://github.com/caseycesari/GeoJSON.js) v0.4.1. The package is the source file, with no build step.

Package: [`geojson-esm`](https://www.npmjs.com/package/geojson-esm)

Visit the [GitHub repository](https://github.com/LuisitoLuis/geojson.js) to get more information.

</div>

## Installation :book:

#### Package install

> Install the package with your favorite package manager. Requires Node.js 20 or later.

- npm

```bash
npm install geojson-esm
```

- pnpm

```bash
pnpm add geojson-esm
```

- bun

```bash
bun add geojson-esm
```

- deno

```bash
deno add npm:geojson-esm
```

## Usage :gear:

#### Example

> Pass an array of objects and the fields that hold latitude and longitude:

```js
import { parse } from "geojson-esm";

const data = [
  { name: "Location A", category: "Store", lat: 39.984, lng: -75.343 },
  { name: "Location B", category: "House", lat: 39.284, lng: -75.833 },
];

const geojson = parse(data, { Point: ["lat", "lng"] });
```

An array becomes a `FeatureCollection`. One object becomes a `Feature`.

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

A callback receives the result and `parse` returns `undefined`. Anything else in the third argument is ignored and the result is returned.

```js
parse(data, { Point: ["lat", "lng"] }, (geojson) => {
  // FeatureCollection
});
```

The default export is the same object the original package exposed: `parse`, `defaults`, `isGeometryValid`, `errors`, and `version`.

### Options

| Option | What it does |
|---|---|
| `Point` | `['lat', 'lng']` or `['lat', 'lng', 'alt']` reads those fields and writes `[lng, lat]` or `[lng, lat, alt]`. A string such as `'coords'` copies that array as-is. `[{ coordinates: ['lat', 'lng'] }]` reads a `[lat, lng]` pair from `item.coordinates`. |
| `LineString`, `MultiPoint`, `MultiLineString`, `Polygon`, `MultiPolygon` | Name of the attribute that already holds coordinates. They are copied as stored. |
| `Polygon` as an object | `{ northeast: ['lat', 'lng'], southwest: ['lat', 'lng'] }` builds a polygon from corner objects. Coordinates are a flat list of positions. |
| `GeoJSON` | Attribute that already holds a GeoJSON geometry. It is used as the feature geometry. |
| `include` / `exclude` | Attributes kept or dropped in `properties`. Geometry attributes are always dropped, except a Point's altitude field. |
| `extra` | Object merged into each feature's `properties`. |
| `extraGlobal` | Object stored on the result as `properties`. |
| `bbox` | Bounding box array copied onto the result. |
| `crs` | CRS object copied onto the result. `type` must be `"name"` or `"link"`. |
| `isPostgres` | With `crs`, stores the CRS on `geometry` instead of the feature or collection. |
| `removeInvalidGeometries` | Drops array items whose geometry fails `isGeometryValid`. |
| `doThrows.invalidGeometry` | Throws `InvalidGeometryError` instead of emitting an invalid geometry. |

Attribute names accept dots: `Point: ['location.lat', 'location.lng']`.

The first geometry key that matches an item wins, in the order written in the options object. `defaults` fills any key the call left unset.

```js
import { defaults, parse } from "geojson-esm";

defaults.Point = ["lat", "lng"];
defaults.include = ["name"];

parse(data, {});
```

`defaults` starts with `doThrows.invalidGeometry: false` and `removeInvalidGeometries: false`. Invalid items stay in the collection unless you change that.