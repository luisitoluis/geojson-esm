/**
 * ESM port of https://github.com/caseycesari/GeoJSON.js v0.4.1.
 * Same object, same parse results, written in current JavaScript.
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

const geomAttrs = [];

export class InvalidGeometryError extends Error {
  constructor(item, params) {
    super(`Invalid Geometry: item: ${JSON.stringify(item)}, params: ${JSON.stringify(params)}`);
    this.name = "InvalidGeometryError";
  }
}

function isGeometryValid(geometry) {
  if (!geometry || !Object.keys(geometry).length) return false;
  return (
    !!geometry.type &&
    !!geometry.coordinates &&
    Array.isArray(geometry.coordinates) &&
    !!geometry.coordinates.length
  );
}

function isNested(value) {
  return /^.+\..+$/.test(value);
}

function applyDefaults(params, defaults) {
  const settings = params || {};
  for (const setting in defaults) {
    if (Object.hasOwn(defaults, setting) && !settings[setting]) {
      settings[setting] = defaults[setting];
    }
  }
  return settings;
}

function checkCRS(crs) {
  if (crs.type === "name") {
    if (crs.properties && crs.properties.name) return true;
    throw new Error('Invalid CRS. Properties must contain "name" key');
  }
  if (crs.type === "link") {
    if (crs.properties && crs.properties.href && crs.properties.type) return true;
    throw new Error('Invalid CRS. Properties must contain "href" and "type" key');
  }
  throw new Error('Invald CRS. Type attribute must be "name" or "link"');
}

function setGeomAttrList(geom) {
  for (const param in geom) {
    if (!Object.hasOwn(geom, param)) continue;
    const value = geom[param];
    if (typeof value === "string") {
      geomAttrs.push(value);
    } else if (typeof value === "object") {
      geomAttrs.push(value[0]);
      geomAttrs.push(value[1]);
    }
  }
  if (geomAttrs.length === 0) throw new Error("No geometry attributes specified");
}

function setGeom(params) {
  params.geom = {};
  for (const param in params) {
    if (Object.hasOwn(params, param) && GEOMETRY_TYPES.includes(param)) {
      params.geom[param] = params[param];
      delete params[param];
    }
  }
  setGeomAttrList(params.geom);
}

function walkNested(item, path) {
  let current = item;
  for (const key of path.split(".")) {
    if (current == null || !Object.hasOwn(current, key)) return { ok: false, value: current };
    current = current[key];
  }
  return { ok: true, value: current };
}

function buildGeom(item, params) {
  let geom;

  for (const gtype in params.geom) {
    if (!Object.hasOwn(params.geom, gtype)) continue;
    const val = params.geom[gtype];
    const coordinates = [];

    if (geom !== undefined && geom !== false) break;

    if (typeof val === "string" && Object.hasOwn(item, val)) {
      geom = gtype === "GeoJSON" ? item[val] : { type: gtype, coordinates: item[val] };
    } else if (typeof val === "string" && isNested(val)) {
      geom = undefined;
      const resolved = walkNested(item, val);
      geom = resolved.ok ? { type: gtype, coordinates: resolved.value } : false;
    } else if (typeof val === "object" && !Array.isArray(val)) {
      const points = Object.keys(val).map((key) => buildGeom(item[key], { geom: { Point: val[key] } }));
      geom = {
        type: gtype,
        coordinates: [].concat(points.map((point) => point.coordinates)),
      };
    } else if (
      Array.isArray(val) &&
      Object.hasOwn(item, val[0]) &&
      Object.hasOwn(item, val[1]) &&
      Object.hasOwn(item, val[2])
    ) {
      geom = {
        type: gtype,
        coordinates: [Number(item[val[1]]), Number(item[val[0]]), Number(item[val[2]])],
      };
    } else if (Array.isArray(val) && Object.hasOwn(item, val[0]) && Object.hasOwn(item, val[1])) {
      geom = {
        type: gtype,
        coordinates: [Number(item[val[1]]), Number(item[val[0]])],
      };
    } else if (Array.isArray(val) && isNested(val[0]) && isNested(val[1]) && isNested(val[2])) {
      geom = undefined;
      for (let i = 0; i < val.length; i++) {
        const resolved = walkNested(item, val[i]);
        if (!resolved.ok) {
          geom = false;
          coordinates[i] = resolved.value;
          break;
        }
        coordinates[i] = resolved.value;
      }
      if (geom !== false) {
        geom = {
          type: gtype,
          coordinates: [Number(coordinates[1]), Number(coordinates[0]), Number(coordinates[2])],
        };
      }
    } else if (Array.isArray(val) && isNested(val[0]) && isNested(val[1])) {
      for (let i = 0; i < val.length; i++) {
        const resolved = walkNested(item, val[i]);
        if (!resolved.ok) {
          geom = false;
          coordinates[i] = resolved.value;
          break;
        }
        coordinates[i] = resolved.value;
      }
      if (geom !== false) {
        geom = {
          type: gtype,
          coordinates: [Number(coordinates[1]), Number(coordinates[0])],
        };
      }
    } else if (
      Array.isArray(val) &&
      val[0].constructor.name === "Object" &&
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

  if (params.doThrows && params.doThrows.invalidGeometry && !GeoJSON.isGeometryValid(geom)) {
    throw new InvalidGeometryError(item, params);
  }

  return geom;
}

function addExtra(properties, extra) {
  for (const key in extra) {
    if (Object.hasOwn(extra, key)) properties[key] = extra[key];
  }
}

function getPropFunction(params) {
  let copyAttributes;
  if (!params.exclude && !params.include) {
    copyAttributes = function copyAll(properties) {
      for (const attr in this) {
        if (Object.hasOwn(this, attr) && !geomAttrs.includes(attr)) properties[attr] = this[attr];
      }
    };
  } else if (params.include) {
    copyAttributes = function copyIncluded(properties) {
      for (const attr of params.include) properties[attr] = this[attr];
    };
  } else {
    copyAttributes = function copyExcluded(properties) {
      for (const attr in this) {
        if (Object.hasOwn(this, attr) && !geomAttrs.includes(attr) && !params.exclude.includes(attr)) {
          properties[attr] = this[attr];
        }
      }
    };
  }

  return function propertiesOfItem() {
    const properties = {};
    copyAttributes.call(this, properties);
    if (params.extra) addExtra(properties, params.extra);
    return properties;
  };
}

function getFeature(item, params, propFunc) {
  return {
    type: "Feature",
    geometry: buildGeom(item, params),
    properties: propFunc.call(item),
  };
}

function addOptionals(output, settings) {
  if (settings.crs && checkCRS(settings.crs)) {
    if (settings.isPostgres) output.geometry.crs = settings.crs;
    else output.crs = settings.crs;
  }
  if (settings.bbox) output.bbox = settings.bbox;
  if (settings.extraGlobal) {
    output.properties = {};
    for (const key in settings.extraGlobal) {
      if (Object.hasOwn(settings.extraGlobal, key)) output.properties[key] = settings.extraGlobal[key];
    }
  }
}

function parse(objects, params, callback) {
  const settings = applyDefaults(params, GeoJSON.defaults);
  geomAttrs.length = 0;
  setGeom(settings);
  const propFunc = getPropFunction(settings);

  let output;
  if (Array.isArray(objects)) {
    output = { type: "FeatureCollection", features: [] };
    for (const item of objects) {
      const feature = getFeature(item, settings, propFunc);
      if (settings.removeInvalidGeometries !== true || GeoJSON.isGeometryValid(feature.geometry)) {
        output.features.push(feature);
      }
    }
  } else {
    output = getFeature(objects, settings, propFunc);
  }

  addOptionals(output, settings);

  if (callback && typeof callback === "function") {
    callback(output);
    return undefined;
  }
  return output;
}

const GeoJSON = {
  version: "0.4.1",
  defaults: {
    doThrows: { invalidGeometry: false },
    removeInvalidGeometries: false,
  },
  errors: { InvalidGeometryError },
  isGeometryValid,
  parse,
};

export const version = GeoJSON.version;
export const defaults = GeoJSON.defaults;
export const errors = GeoJSON.errors;
export { isGeometryValid, parse };
export default GeoJSON;
