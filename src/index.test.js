import { describe, expect, it } from "vitest";
import { defaults, parse } from "./index.js";

const sampleData = [
  { name: "Location A", category: "Store", lat: 39.984, lng: -75.343 },
  { name: "Location B", category: "House", lat: 39.284, lng: -75.833 },
  { name: "Location C", category: "Office", lat: 39.123, lng: -74.534 },
];

describe("parse", () => {
  it("converts an array of points into a FeatureCollection", () => {
    const result = parse(sampleData, { Point: ["lat", "lng"] });

    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(3);
    expect(result.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-75.343, 39.984] },
      properties: { name: "Location A", category: "Store" },
    });
  });

  it("accepts a single object instead of an array", () => {
    const result = parse(sampleData[0], { Point: ["lat", "lng"] });
    expect(result.features).toHaveLength(1);
  });

  it("honors include", () => {
    const result = parse(sampleData, { Point: ["lat", "lng"], include: ["name"] });
    expect(result.features[0].properties).toEqual({ name: "Location A" });
  });

  it("honors exclude", () => {
    const result = parse(sampleData, { Point: ["lat", "lng"], exclude: ["category"] });
    expect(result.features[0].properties).toEqual({ name: "Location A" });
  });

  it("merges extra properties from an object", () => {
    const result = parse(sampleData, {
      Point: ["lat", "lng"],
      include: ["name"],
      extra: { source: "import" },
    });
    expect(result.features[0].properties).toEqual({ name: "Location A", source: "import" });
  });

  it("merges extra properties from a function", () => {
    const result = parse(sampleData, {
      Point: ["lat", "lng"],
      include: ["name"],
      extra: (item) => ({ slug: item.name.toLowerCase().replace(/\s+/g, "-") }),
    });
    expect(result.features[0].properties.slug).toBe("location-a");
  });

  it("attaches extraGlobal to the FeatureCollection", () => {
    const result = parse(sampleData, {
      Point: ["lat", "lng"],
      extraGlobal: { creator: "Test Suite" },
    });
    expect(result.properties).toEqual({ creator: "Test Suite" });
  });

  it("attaches crs when provided", () => {
    const crs = { type: "name", properties: { name: "EPSG:4326" } };
    const result = parse(sampleData, { Point: ["lat", "lng"], crs });
    expect(result.crs).toEqual(crs);
  });

  it("computes a bbox for the collection and each feature", () => {
    const result = parse(sampleData, { Point: ["lat", "lng"], bbox: true });
    expect(result.bbox).toEqual([-75.833, 39.123, -74.534, 39.984]);
    expect(result.features[0].bbox).toHaveLength(4);
  });

  it("parses LineString data", () => {
    const data = {
      name: "Trail",
      line: [
        [0, 102],
        [1, 103],
        [0, 104],
        [1, 105],
      ],
    };
    const result = parse(data, { LineString: "line", include: ["name"] });
    expect(result.features[0].geometry).toEqual({
      type: "LineString",
      coordinates: [
        [102, 0],
        [103, 1],
        [104, 0],
        [105, 1],
      ],
    });
  });

  it("parses Polygon data", () => {
    const data = {
      name: "Area",
      polygon: [
        [
          [0, 100],
          [0, 101],
          [1, 101],
          [1, 100],
          [0, 100],
        ],
      ],
    };
    const result = parse(data, { Polygon: "polygon", include: ["name"] });
    expect(result.features[0].geometry.type).toBe("Polygon");
    expect(result.features[0].geometry.coordinates[0]).toEqual([
      [100, 0],
      [101, 0],
      [101, 1],
      [100, 1],
      [100, 0],
    ]);
  });

  it("supports a callback instead of a return value", () => {
    let received;
    const result = parse(sampleData, { Point: ["lat", "lng"] }, (fc) => {
      received = fc;
    });
    expect(result).toBeUndefined();
    expect(received.features).toHaveLength(3);
  });

  it("throws on an item with no matching geometry", () => {
    expect(() => parse([{ name: "No coords" }], { Point: ["lat", "lng"] })).toThrow();
  });

  it("skips invalid geometries when removeInvalidGeometries is set", () => {
    const data = [...sampleData, { name: "Broken" }];
    const result = parse(data, { Point: ["lat", "lng"], removeInvalidGeometries: true });
    expect(result.features).toHaveLength(3);
  });

  it("respects module-level defaults", () => {
    defaults.Point = ["lat", "lng"];
    const result = parse(sampleData);
    expect(result.features).toHaveLength(3);
    defaults.Point = undefined;
  });

  it("accepts a 3-tuple Point with altitude", () => {
    const data = [{ name: "Mountain", lat: 39.984, lng: -75.343, alt: 142 }];
    const result = parse(data, { Point: ["lat", "lng", "alt"] });
    expect(result.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [-75.343, 39.984, 142],
    });
  });

  it("omits altitude when the third tuple element is missing", () => {
    const data = [{ name: "Spot", lat: 39.984, lng: -75.343 }];
    const result = parse(data, { Point: ["lat", "lng", "alt"] });
    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984]);
  });

  it("resolves dotted-path attribute names for Point", () => {
    const data = [{ name: "Place", address: { lat: 39.984, lng: -75.343 } }];
    const result = parse(data, { Point: ["address.lat", "address.lng"] });
    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984]);
  });

  it("resolves dotted paths combined with a 3-tuple", () => {
    const data = [{ name: "Peak", loc: { lat: 39.984, lng: -75.343, alt: 200 } }];
    const result = parse(data, { Point: ["loc.lat", "loc.lng", "loc.alt"] });
    expect(result.features[0].geometry.coordinates).toEqual([-75.343, 39.984, 200]);
  });

  it("resolves dotted paths for LineString-style nested arrays", () => {
    const data = [
      {
        name: "Path",
        track: {
          points: [
            [0, 100],
            [1, 101],
          ],
        },
      },
    ];
    const result = parse(data, { LineString: "track.points" });
    expect(result.features[0].geometry).toEqual({
      type: "LineString",
      coordinates: [
        [100, 0],
        [101, 1],
      ],
    });
  });

  it("passes through a pre-encoded GeoJSON geometry", () => {
    const data = [
      {
        name: "Pre-encoded",
        geo: { type: "Point", coordinates: [125.6, 10.1] },
      },
    ];
    const result = parse(data, { GeoJSON: "geo" });
    expect(result.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [125.6, 10.1],
    });
  });

  it("excludes the GeoJSON attribute from properties", () => {
    const data = [{ name: "Pre-encoded", geo: { type: "Point", coordinates: [0, 0] } }];
    const result = parse(data, { GeoJSON: "geo" });
    expect(result.features[0].properties).toEqual({ name: "Pre-encoded" });
  });

  it("builds a Polygon from corner points in separate attributes", () => {
    const data = [
      {
        name: "Block",
        northeast: { lat: 10, lng: 20 },
        southwest: { lat: 0, lng: 0 },
      },
    ];
    const result = parse(data, {
      Polygon: {
        northeast: ["lat", "lng"],
        southwest: ["lat", "lng"],
      },
    });
    expect(result.features[0].geometry.type).toBe("Polygon");
    expect(result.features[0].geometry.coordinates[0]).toEqual([
      [20, 10],
      [0, 0],
    ]);
  });

  it("skips a bbox-style Polygon item when a key is missing", () => {
    const data = [
      {
        name: "Broken",
        northeast: { lat: 10, lng: 20 },
      },
    ];
    expect(() =>
      parse(data, {
        Polygon: {
          northeast: ["lat", "lng"],
          southwest: ["lat", "lng"],
        },
      }),
    ).toThrow();
  });

  it("detects geometry in user-supplied param order, not a fixed order", () => {
    const result = parse(
      [
        {
          lat: 1,
          lng: 2,
          line: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
      { LineString: "line", Point: ["lat", "lng"] },
    );
    expect(result.features[0].geometry.type).toBe("LineString");
  });
});
