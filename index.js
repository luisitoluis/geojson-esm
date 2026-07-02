/**
 * geojson-modern
 * Turn plain JS objects into GeoJSON.
 *
 * A modernized, dependency-free reimplementation of the classic
 * `geojson` npm package: same idea (convert arrays of flat objects
 * into valid GeoJSON Features), rewritten as native ESM with a small,
 * predictable, well-tested core.
 */

const GEOMETRY_TYPES = [
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
];

/**
 * Default settings that get merged into every `parse()` call.
 * Mutate this if you're repeatedly parsing datasets that share
 * the same shape, e.g.:
 *
 *   defaults.Point = ['lat', 'lng'];
 */
export const defaults = {};

function isNil(value) {
  return value === null || value === undefined;
}

/** Normalize a single coordinate pair into GeoJSON [x, y] order. */
function toCoordPair(pair) {
  if (Array.isArray(pair)) {
    const [lat, lng] = pair;
    return [lng, lat];
  }
  if (pair && typeof pair === "object") {
    const lat = pair.lat ?? pair.latitude ?? pair.y;
    const lng = pair.lng ?? pair.lon ?? pair.long ?? pair.longitude ?? pair.x;
    return [lng, lat];
  }
  throw new TypeError(`Cannot convert value to a coordinate pair: ${JSON.stringify(pair)}`);
}

const coordinateBuilders = {
  Point(item, attr) {
    const [latAttr, lngAttr] = attr;
    return [item[lngAttr], item[latAttr]];
  },
  MultiPoint(item, attr) {
    return item[attr].map(toCoordPair);
  },
  LineString(item, attr) {
    return item[attr].map(toCoordPair);
  },
  MultiLineString(item, attr) {
    return item[attr].map((line) => line.map(toCoordPair));
  },
  Polygon(item, attr) {
    return item[attr].map((ring) => ring.map(toCoordPair));
  },
  MultiPolygon(item, attr) {
    return item[attr].map((poly) => poly.map((ring) => ring.map(toCoordPair)));
  },
};

/** Which item attribute(s) does this geometry type depend on? */
function attrsForType(type, attr) {
  return type === "Point" ? attr : [attr];
}

function isGeometryPresent(item, type, attr) {
  const attrs = attrsForType(type, attr);
  return attrs.every((key) => !isNil(item[key]));
}

function detectGeometry(item, params) {
  for (const type of GEOMETRY_TYPES) {
    const attr = params[type];
    if (isNil(attr)) continue;
    if (isGeometryPresent(item, type, attr)) {
      return { type, attr };
    }
  }
  return null;
}

function buildProperties(item, params, geometryAttrs) {
  const { include, exclude, extra } = params;
  let properties;

  if (Array.isArray(include)) {
    properties = {};
    for (const key of include) properties[key] = item[key];
  } else {
    properties = {};
    for (const key of Object.keys(item)) {
      if (geometryAttrs.includes(key)) continue;
      if (Array.isArray(exclude) && exclude.includes(key)) continue;
      properties[key] = item[key];
    }
  }

  if (typeof extra === "function") {
    Object.assign(properties, extra(item));
  } else if (extra && typeof extra === "object") {
    Object.assign(properties, extra);
  }

  return properties;
}

function extendBbox(bbox, coordinates) {
  const stack = [coordinates];
  while (stack.length) {
    const value = stack.pop();
    if (Array.isArray(value[0])) {
      stack.push(...value);
      continue;
    }
    const [x, y] = value;
    if (x < bbox[0]) bbox[0] = x;
    if (y < bbox[1]) bbox[1] = y;
    if (x > bbox[2]) bbox[2] = x;
    if (y > bbox[3]) bbox[3] = y;
  }
  return bbox;
}

function itemToFeature(item, params) {
  const detected = detectGeometry(item, params);

  if (!detected) {
    if (params.removeInvalidGeometries) return null;
    throw new Error(
      `Unable to detect a geometry for item: ${JSON.stringify(item)}. Check that the configured geometry attribute(s) are present, or set removeInvalidGeometries: true to skip them.`,
    );
  }

  const { type, attr } = detected;
  const coordinates = coordinateBuilders[type](item, attr);
  const geometryAttrs = attrsForType(type, attr);
  const properties = buildProperties(item, params, geometryAttrs);

  const feature = {
    type: "Feature",
    geometry: { type, coordinates },
    properties,
  };

  if (params.bbox) {
    feature.bbox = extendBbox(
      [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ],
      coordinates,
    );
  }

  return feature;
}

/**
 * Convert an array (or single object) of flat data into GeoJSON.
 *
 * @param {object|object[]} data
 * @param {object} params - geometry mapping + options, see README.
 * @param {Function} [callback] - if provided, called with the result instead of returning it.
 * @returns {object|undefined}
 */
export function parse(data, params, callback) {
  const settings = { ...defaults, ...(params ?? {}) };
  const items = Array.isArray(data) ? data : [data];

  const features = items
    .map((item) => itemToFeature(item, settings))
    .filter((feature) => feature !== null);

  const featureCollection = {
    type: "FeatureCollection",
    features,
  };

  if (settings.crs) {
    featureCollection.crs = settings.crs;
  }

  if (settings.bbox) {
    featureCollection.bbox = features.reduce(
      (acc, feature) => extendBbox(acc, feature.geometry.coordinates),
      [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ],
    );
  }

  if (settings.extraGlobal) {
    featureCollection.properties = { ...settings.extraGlobal };
  }

  if (typeof callback === "function") {
    callback(featureCollection);
    return undefined;
  }

  return featureCollection;
}

export default { parse, defaults };
