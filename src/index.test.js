import { afterEach, describe, expect, it } from "vitest";
import geojson, {
  defaults,
  errors,
  InvalidGeometryError,
  isGeometryValid,
  parse,
  version,
} from "./index.js";

const sampleData = [
  { name: "Location A", category: "Store", lat: 39.984, lng: -75.343, street: "Market" },
  { name: "Location B", category: "House", lat: 39.284, lng: -75.833, street: "Broad" },
  { name: "Location C", category: "Office", lat: 39.123, lng: -74.534, street: "South" },
];

afterEach(() => {
  for (const key of Object.keys(defaults)) delete defaults[key];
  defaults.doThrows = { invalidGeometry: false };
  defaults.removeInvalidGeometries = false;
});

describe("parse", () => {
  it("converts an array of points into a FeatureCollection", () => {
    const result = parse(sampleData, { Point: ["lat", "lng"] });

    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(3);
    expect(result.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-75.343, 39.984] },
      properties: { name: "Location A", category: "Store", street: "Market" },
    });
  });

  it("returns a single Feature for one object", () => {
    const result = parse(sampleData[0], { Point: ["lat", "lng"] });

    expect(result.type).toBe("Feature");
    expect(result.geometry).toEqual({ type: "Point", coordinates: [-75.343, 39.984] });
    expect(result.properties.name).toBe("Location A");
    expect(result.features).toBeUndefined();
  });

  it("keeps a Point stored in one attribute as-is", () => {
    const result = parse([{ name: "test", coords: [-74, 39], foo: "bar" }], { Point: "coords" });

    expect(result.features[0].geometry.coordinates).toEqual([-74, 39]);
    expect(result.features[0].properties).toEqual({ name: "test", foo: "bar" });
  });

  it("coerces string point coordinates to numbers", () => {
    const result = parse([{ lat: "39.343", lng: "-74.454" }], { Point: ["lat", "lng"] });
    expect(result.features[0].geometry.coordinates).toEqual([-74.454, 39.343]);
  });

  it("keeps a 0,0 point", () => {
    const result = parse([{ lat: 0, lng: 0 }], { Point: ["lat", "lng"] });
    expect(result.features[0].geometry.coordinates).toEqual([0, 0]);
  });

  it("includes altitude and leaves the alt attribute in properties", () => {
    const result = parse([{ name: "Peak", lat: 39.984, lng: -75.343, alt: 22026.46 }], {
      Point: ["lat", "lng", "alt"],
    });

    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984, 22026.46]);
    expect(result.features[0].properties).toEqual({ name: "Peak", alt: 22026.46 });
  });

  it("falls back to two coordinates when altitude is absent", () => {
    const result = parse([{ lat: 39.984, lng: -75.343 }], { Point: ["lat", "lng", "alt"] });
    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984]);
  });

  it("reads a coordinate pair stored as [lat, lng]", () => {
    const data = [{ name: "A", coordinates: [39.984, -75.343] }];
    const result = parse(data, { Point: [{ coordinates: ["lat", "lng"] }] });
    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984]);
  });

  it("copies line and polygon coordinates without swapping them", () => {
    const data = [
      { x: 0.5, y: 102, prop0: "value0" },
      {
        line: [
          [102, 0],
          [103, 1],
          [104, 0],
          [105, 1],
        ],
        prop0: "value0",
      },
      {
        polygon: [
          [
            [100, 0],
            [101, 0],
            [101, 1],
            [100, 1],
            [100, 0],
          ],
        ],
        prop0: "value0",
      },
    ];
    const result = parse(data, { Point: ["x", "y"], LineString: "line", Polygon: "polygon" });

    expect(result.features[0].geometry.coordinates).toEqual([102, 0.5]);
    expect(result.features[1].geometry.coordinates[0]).toEqual([102, 0]);
    expect(result.features[2].geometry.coordinates[0][0]).toEqual([100, 0]);
  });

  it("resolves dotted paths and keeps nested line coordinates", () => {
    const data = [
      { geo: { point: { lat: 39.984, lng: -75.343 } } },
      {
        geo: {
          line: [
            [102, 0],
            [105, 1],
          ],
        },
      },
    ];
    const result = parse(data, {
      Point: ["geo.point.lat", "geo.point.lng"],
      LineString: "geo.line",
    });

    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984]);
    expect(result.features[1].geometry.coordinates).toEqual([
      [102, 0],
      [105, 1],
    ]);
  });

  it("resolves a nested point with altitude", () => {
    const result = parse([{ location: { lat: 39.984, lng: -75.343, alt: 22026.46 } }], {
      Point: ["location.lat", "location.lng", "location.alt"],
    });
    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984, 22026.46]);
  });

  it("sets geometry to false when a nested path is missing", () => {
    const result = parse([{ geo: null }, { name: "nope" }], { LineString: "geo.line" });
    expect(result.features[0].geometry).toBe(false);
    expect(result.features[1].geometry).toBe(false);
  });

  it("passes through a GeoJSON attribute", () => {
    const result = parse([{ name: "A", geo: { type: "Point", coordinates: [125.6, 10.1] } }], {
      GeoJSON: "geo",
    });
    expect(result.features[0].geometry).toEqual({ type: "Point", coordinates: [125.6, 10.1] });
    expect(result.features[0].properties).toEqual({ name: "A" });
  });

  it("builds a polygon from corner attributes as a list of positions", () => {
    const result = parse(
      {
        northeast: { lat: 29.8399961, lng: -82.38140709999999 },
        southwest: { lat: 29.7183041, lng: -82.555449 },
      },
      {
        Polygon: {
          northeast: ["lat", "lng"],
          southwest: ["lat", "lng"],
        },
      },
    );

    expect(result.type).toBe("Feature");
    expect(result.geometry.coordinates).toEqual([
      [-82.38140709999999, 29.8399961],
      [-82.555449, 29.7183041],
    ]);
  });

  it("honors include and exclude", () => {
    expect(
      parse(sampleData, { Point: ["lat", "lng"], include: ["name"] }).features[0].properties,
    ).toEqual({
      name: "Location A",
    });
    expect(
      parse(sampleData, { Point: ["lat", "lng"], exclude: ["name"] }).features[0].properties,
    ).toEqual({
      category: "Store",
      street: "Market",
    });
  });

  it("copies extra and extraGlobal", () => {
    const result = parse(sampleData, {
      Point: ["lat", "lng"],
      extra: { foo: "bar" },
      extraGlobal: { source: "test" },
    });
    expect(result.features[0].properties.foo).toBe("bar");
    expect(result.properties).toEqual({ source: "test" });
  });

  it("copies the bbox array and a valid crs", () => {
    const crs = { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } };
    const bbox = [-75, 39, -76, 40];
    const result = parse(sampleData, { Point: ["lat", "lng"], bbox, crs });
    expect(result.bbox).toEqual(bbox);
    expect(result.crs).toEqual(crs);
    expect(result.features[0].bbox).toBeUndefined();
  });

  it("puts crs on the geometry when isPostgres is set", () => {
    const crs = { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } };
    const result = parse(
      {
        northeast: { lat: 1, lng: 2 },
        southwest: { lat: 0, lng: 0 },
      },
      {
        Polygon: { northeast: ["lat", "lng"], southwest: ["lat", "lng"] },
        isPostgres: true,
        crs,
      },
    );
    expect(result.geometry.crs).toEqual(crs);
    expect(result.crs).toBeUndefined();
  });

  it("rejects an invalid crs", () => {
    expect(() => parse(sampleData, { Point: ["lat", "lng"], crs: { type: "foo" } })).toThrow(
      'Invald CRS. Type attribute must be "name" or "link"',
    );
    expect(() =>
      parse(sampleData, { Point: ["lat", "lng"], crs: { type: "name", properties: {} } }),
    ).toThrow('Invalid CRS. Properties must contain "name" key');
    expect(() =>
      parse(sampleData, {
        Point: ["lat", "lng"],
        crs: { type: "link", properties: { name: "foo" } },
      }),
    ).toThrow('Invalid CRS. Properties must contain "href" and "type" key');
  });

  it("returns an empty FeatureCollection for an empty list", () => {
    const result = parse([], { Point: ["lat", "lng"] });
    expect(result).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("throws when no geometry attributes are specified", () => {
    expect(() => parse(sampleData)).toThrow("No geometry attributes specified");
  });

  it("keeps invalid geometries unless removeInvalidGeometries is set", () => {
    const data = [...sampleData, { name: "Broken" }];
    const kept = parse(data, { Point: ["lat", "lng"] });
    expect(kept.features).toHaveLength(4);
    expect(kept.features[3].geometry).toBeUndefined();

    const filtered = parse(data, { Point: ["lat", "lng"], removeInvalidGeometries: true });
    expect(filtered.features).toHaveLength(3);
  });

  it("throws InvalidGeometryError when doThrows.invalidGeometry is set", () => {
    expect(() =>
      parse([{ lat: "39.343", lng: "-74.454" }], {
        Point: "lat",
        doThrows: { invalidGeometry: true },
      }),
    ).toThrow(InvalidGeometryError);
  });

  it("uses the callback and ignores a non-function third argument", () => {
    let received;
    expect(
      parse(sampleData, { Point: ["lat", "lng"] }, (geojson) => {
        received = geojson;
      }),
    ).toBeUndefined();
    expect(received.features).toHaveLength(3);
    expect(parse(sampleData, { Point: ["lat", "lng"] }, "foo").features).toHaveLength(3);
  });

  it("applies defaults that the call did not set", () => {
    defaults.Point = ["lat", "lng"];
    defaults.include = ["name"];
    defaults.crs = { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } };

    const withDefaults = parse(sampleData, {});
    expect(withDefaults.crs.properties.name).toBe("urn:ogc:def:crs:OGC:1.3:CRS84");
    expect(withDefaults.features[0].properties).toEqual({ name: "Location A" });

    const override = parse(sampleData, { include: ["category"] });
    expect(override.features[0].properties).toEqual({ category: "Store" });
    expect(override.crs.properties.name).toBe("urn:ogc:def:crs:OGC:1.3:CRS84");
  });

  it("moves geometry keys onto params.geom and fills missing defaults", () => {
    const params = { Point: ["lat", "lng"], include: ["name"] };
    parse(sampleData, params);
    expect(params.Point).toBeUndefined();
    expect(params.geom.Point).toEqual(["lat", "lng"]);
    expect(params.include).toEqual(["name"]);
    expect(params.doThrows).toEqual({ invalidGeometry: false });
    expect(params.removeInvalidGeometries).toBe(false);
  });
});

describe("public surface", () => {
  it("exposes version, defaults, errors, and isGeometryValid", () => {
    expect(version).toBe("0.4.1");
    expect(Object.keys(defaults)).toEqual(["doThrows", "removeInvalidGeometries"]);
    expect(errors.InvalidGeometryError).toBe(InvalidGeometryError);
    expect(isGeometryValid({ type: "Point", coordinates: [1, 2] })).toBe(true);
    expect(isGeometryValid(false)).toBe(false);
    expect(geojson.parse).toBe(parse);
    expect(geojson.defaults).toBe(defaults);
  });

  it("lets a caller replace isGeometryValid", () => {
    geojson.isGeometryValid = () => false;
    const result = parse([{ lat: 1, lng: 2 }, { name: "nope" }], {
      Point: ["lat", "lng"],
      removeInvalidGeometries: true,
    });
    expect(result.features).toEqual([]);
    geojson.isGeometryValid = isGeometryValid;
  });
});
