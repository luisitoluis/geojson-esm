export type GeometryType =
  | "Point"
  | "MultiPoint"
  | "LineString"
  | "MultiLineString"
  | "Polygon"
  | "MultiPolygon"
  | "GeoJSON";

export type PointAttr = [string, string] | [string, string, string];

export type PolygonCorner = [string, string] | [string, string, string];

export type PolygonAttr = string | Record<string, PolygonCorner>;

export interface ParseParams {
  Point?: PointAttr;
  MultiPoint?: string;
  LineString?: string;
  MultiLineString?: string;
  Polygon?: PolygonAttr;
  MultiPolygon?: string;
  GeoJSON?: string;
  include?: string[];
  exclude?: string[];
  extra?: Record<string, unknown> | ((item: Record<string, unknown>) => Record<string, unknown>);
  extraGlobal?: Record<string, unknown>;
  bbox?: boolean;
  crs?: Record<string, unknown>;
  removeInvalidGeometries?: boolean;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: GeometryType;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
  bbox?: [number, number, number, number];
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
  bbox?: [number, number, number, number];
  crs?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

export declare const defaults: ParseParams;

export declare function parse(
  data: Record<string, unknown> | Record<string, unknown>[],
  params?: ParseParams,
  callback?: (result: GeoJSONFeatureCollection) => void,
): GeoJSONFeatureCollection | undefined;

declare const _default: { parse: typeof parse; defaults: typeof defaults };
export default _default;
