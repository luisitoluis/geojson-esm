/**
 * Modern port of caseycesari/GeoJSON.js.
 * Same parse results as v0.4.1: Feature vs FeatureCollection, coordinate
 * handling, defaults, crs, bbox, and invalid-geometry rules.
 */

const GEOMETRY_TYPES = [
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeoJSON",
];

export class InvalidGeometryError extends Error {
  constructor(item, params) {
    super(`Invalid Geometry: item: ${JSON.stringify(item)}, params: ${JSON.stringify(params)}`);
    this.name = "InvalidGeometryError";
  }
}

export function isGeometryValid(geometry) {
  if (!geometry || !Object.keys(geometry).length) return false;
  return (
    !!geometry.type &&
    !!geometry.coordinates &&
    Array.isArray(geometry.coordinates) &&
    !!geometry.coordinates.length
  );
}

function hasOwn(obj, key) {
  return Object.hasOwn(obj, key);
}

function isNested(value) {
  return typeof value === "string" && /^.+\..+$/.test(value);
}

function walkPath(item, path) {
  let current = item;
  for (const key of path.split(".")) {
    if (current == null || !hasOwn(current, key)) return { ok: false };
    current = current[key];
  }
  return { ok: true, value: current };
}

function applyDefaults(params, defaults) {
  const settings = { ...params };
  for (const setting of Object.keys(defaults)) {
    if (!settings[setting]) settings[setting] = defaults[setting];
  }
  return settings;
}

function checkCRS(crs) {
  if (crs.type === "name") {
    if (crs.properties?.name) return true;
    throw new Error('Invalid CRS. Properties must contain "name" key');
  }
  if (crs.type === "link") {
    if (crs.properties?.href && crs.properties.type) return true;
    throw new Error('Invalid CRS. Properties must contain "href" and "type" key');
  }
  throw new Error('Invald CRS. Type attribute must be "name" or "link"');
}

function geomAttrList(geom) {
  const attrs = [];
  for (const param of Object.keys(geom)) {
    const value = geom[param];
    if (typeof value === "string") {
      attrs.push(value);
    } else if (value && typeof value === "object") {
      attrs.push(value[0]);
      attrs.push(value[1]);
    }
  }
  if (attrs.length === 0) throw new Error("No geometry attributes specified");
  return attrs;
}

function splitGeom(settings) {
  const geom = {};
  for (const param of Object.keys(settings)) {
    if (GEOMETRY_TYPES.includes(param)) {
      geom[param] = settings[param];
      delete settings[param];
    }
  }
  settings.geom = geom;
  return geomAttrList(geom);
}

function buildGeom(item, params) {
  let geom;

  for (const gtype of Object.keys(params.geom)) {
    const val = params.geom[gtype];
    const coordinates = [];

    if (geom !== undefined && geom !== false) break;

    if (typeof val === "string" && hasOwn(item, val)) {
      geom = gtype === "GeoJSON" ? item[val] : { type: gtype, coordinates: item[val] };
    } else if (typeof val === "string" && isNested(val)) {
      geom = undefined;
      const resolved = walkPath(item, val);
      geom = resolved.ok ? { type: gtype, coordinates: resolved.value } : false;
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      const points = Object.keys(val).map((key) =>
        buildGeom(item[key], { geom: { Point: val[key] } }),
      );
      geom = {
        type: gtype,
        coordinates: [].concat(points.map((point) => point.coordinates)),
      };
    } else if (
      Array.isArray(val) &&
      hasOwn(item, val[0]) &&
      hasOwn(item, val[1]) &&
      hasOwn(item, val[2])
    ) {
      geom = {
        type: gtype,
        coordinates: [Number(item[val[1]]), Number(item[val[0]]), Number(item[val[2]])],
      };
    } else if (Array.isArray(val) && hasOwn(item, val[0]) && hasOwn(item, val[1])) {
      geom = {
        type: gtype,
        coordinates: [Number(item[val[1]]), Number(item[val[0]])],
      };
    } else if (Array.isArray(val) && isNested(val[0]) && isNested(val[1]) && isNested(val[2])) {
      geom = undefined;
      let failed = false;
      for (const path of val) {
        const resolved = walkPath(item, path);
        if (!resolved.ok) {
          failed = true;
          break;
        }
        coordinates.push(resolved.value);
      }
      geom = failed
        ? false
        : {
            type: gtype,
            coordinates: [Number(coordinates[1]), Number(coordinates[0]), Number(coordinates[2])],
          };
    } else if (Array.isArray(val) && isNested(val[0]) && isNested(val[1])) {
      let failed = false;
      if (geom !== false) {
        for (const path of val) {
          const resolved = walkPath(item, path);
          if (!resolved.ok) {
            failed = true;
            break;
          }
          coordinates.push(resolved.value);
        }
      } else {
        failed = true;
      }
      if (!failed) {
        geom = {
          type: gtype,
          coordinates: [Number(coordinates[1]), Number(coordinates[0])],
        };
      } else {
        geom = false;
      }
    } else if (
      Array.isArray(val) &&
      val[0]?.constructor?.name === "Object" &&
      Object.keys(val[0])[0] === "coordinates"
    ) {
      const order = val[0].coordinates;
      geom = {
        type: gtype,
        coordinates: [
          Number(item.coordinates[order.indexOf("lng")]),
          Number(item.coordinates[order.indexOf("lat")]),
        ],
      };
    }
  }

  if (params.doThrows?.invalidGeometry && !geojson.isGeometryValid(geom)) {
    throw new InvalidGeometryError(item, params);
  }

  return geom;
}

function buildProperties(item, params, geometryAttrs) {
  const properties = {};

  if (!params.exclude && !params.include) {
    for (const attr of Object.keys(item)) {
      if (!geometryAttrs.includes(attr)) properties[attr] = item[attr];
    }
  } else if (params.include) {
    for (const attr of params.include) properties[attr] = item[attr];
  } else {
    for (const attr of Object.keys(item)) {
      if (!geometryAttrs.includes(attr) && !params.exclude.includes(attr)) {
        properties[attr] = item[attr];
      }
    }
  }

  if (params.extra && typeof params.extra === "object") {
    for (const key of Object.keys(params.extra)) properties[key] = params.extra[key];
  }

  return properties;
}

function getFeature(item, params, geometryAttrs) {
  return {
    type: "Feature",
    geometry: buildGeom(item, params),
    properties: buildProperties(item, params, geometryAttrs),
  };
}

function addOptionals(geojsonOutput, settings) {
  if (settings.crs && checkCRS(settings.crs)) {
    if (settings.isPostgres) geojsonOutput.geometry.crs = settings.crs;
    else geojsonOutput.crs = settings.crs;
  }
  if (settings.bbox) geojsonOutput.bbox = settings.bbox;
  if (settings.extraGlobal) {
    geojsonOutput.properties = {};
    for (const key of Object.keys(settings.extraGlobal)) {
      geojsonOutput.properties[key] = settings.extraGlobal[key];
    }
  }
}

export function parse(objects, params, callback) {
  const settings = applyDefaults(params, geojson.defaults);
  const geometryAttrs = splitGeom(settings);

  let output;
  if (Array.isArray(objects)) {
    output = { type: "FeatureCollection", features: [] };
    for (const item of objects) {
      const feature = getFeature(item, settings, geometryAttrs);
      if (settings.removeInvalidGeometries !== true || geojson.isGeometryValid(feature.geometry)) {
        output.features.push(feature);
      }
    }
  } else {
    output = getFeature(objects, settings, geometryAttrs);
  }

  addOptionals(output, settings);

  if (typeof callback === "function") {
    callback(output);
    return undefined;
  }
  return output;
}

const geojson = {
  version: "0.4.1",
  defaults: {
    doThrows: { invalidGeometry: false },
    removeInvalidGeometries: false,
  },
  errors: { InvalidGeometryError },
  isGeometryValid,
  parse,
};

export const version = geojson.version;
export const defaults = geojson.defaults;
export const errors = geojson.errors;

export default geojson;
