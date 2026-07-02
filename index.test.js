import { describe, expect, it } from "vitest";
import { defaults, parse } from "../src/index.js";

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
});
