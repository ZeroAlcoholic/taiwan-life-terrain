# -*- coding: utf-8 -*-
"""Convert MOI county boundary shapefile -> simplified GeoJSON + centroids."""
import json
import sys

import shapefile
import shapely
from shapely.geometry import shape, MultiPolygon, Polygon

SRC = r"D:\Python\taiwan-life-terrain\tmp\shp\COUNTY_MOI_1140318"
OUT_GEO = r"D:\Python\taiwan-life-terrain\data\counties.geojson"
OUT_CEN = r"D:\Python\taiwan-life-terrain\data\county-centroids.json"

OFFICIAL = {
    "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市",
    "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣",
    "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
}

# Keep only polygons inside this bbox (excludes Diaoyutai ~123.5E, Dongsha/
# Nansha in the South China Sea). Kinmen 118.2E, Matsu up to 26.4N, Pengjia
# Islet 122.08E all stay inside.
LON_MIN, LON_MAX = 117.8, 122.3
LAT_MIN, LAT_MAX = 21.5, 26.6

# Drop islets smaller than ~1.5 km^2 (1 deg^2 ~ 11000 km^2 here), always keep
# the largest polygon of each county.
MIN_AREA = 1.4e-4

TOLERANCE = float(sys.argv[1]) if len(sys.argv) > 1 else 0.002
PRECISION = 4

sf = shapefile.Reader(SRC, encoding="utf-8")
feats = []
for sr in sf.iterShapeRecords():
    rec = sr.record
    geom = shape(sr.shape.__geo_interface__)
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])
    parts = list(geom.geoms)
    # bbox filter for remote islets outside the 22-county core extent
    parts = [
        p for p in parts
        if LON_MIN <= p.centroid.x <= LON_MAX and LAT_MIN <= p.centroid.y <= LAT_MAX
    ]
    parts.sort(key=lambda p: p.area, reverse=True)
    kept = [p for i, p in enumerate(parts) if i == 0 or p.area >= MIN_AREA]
    feats.append({
        "name": rec["COUNTYNAME"],
        "nameEn": rec["COUNTYENG"],
        "code": rec["COUNTYCODE"],
        "geom": MultiPolygon(kept),
    })

names = {f["name"] for f in feats}
assert names == OFFICIAL, (sorted(names - OFFICIAL), sorted(OFFICIAL - names))

# Topology-preserving simplification of the whole coverage (keeps shared
# county borders identical -> no slivers/gaps between extruded 3D shapes).
geoms = shapely.coverage_simplify([f["geom"] for f in feats], TOLERANCE)

def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], float):
            return [round(v, PRECISION) for v in obj]
        return [round_coords(o) for o in obj]
    return obj

features = []
centroids = {}
for f, g in zip(feats, geoms):
    # Snap to the output precision grid so rounding below is lossless and
    # cannot introduce self-intersections; then repair if needed.
    g = shapely.set_precision(g, 10.0 ** -PRECISION)
    g = shapely.make_valid(g)
    if isinstance(g, shapely.GeometryCollection):
        g = MultiPolygon([p for sub in g.geoms if isinstance(sub, (Polygon, MultiPolygon))
                          for p in (sub.geoms if isinstance(sub, MultiPolygon) else [sub])])
    if isinstance(g, Polygon):
        g = MultiPolygon([g])
    gj = shapely.geometry.mapping(g)
    gj = {"type": gj["type"], "coordinates": round_coords(gj["coordinates"])}
    features.append({
        "type": "Feature",
        "properties": {"name": f["name"], "nameEn": f["nameEn"], "code": f["code"]},
        "geometry": gj,
    })
    # Label point: centroid of the largest polygon; fall back to a point
    # guaranteed inside it (for elongated/concave shapes).
    main = max(f["geom"].geoms, key=lambda p: p.area)
    c = main.centroid
    if not main.contains(c):
        c = main.representative_point()
    centroids[f["name"]] = [round(c.x, 4), round(c.y, 4)]

ORDER = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市",
         "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣",
         "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]
features.sort(key=lambda ft: ORDER.index(ft["properties"]["name"]))

fc = {
    "type": "FeatureCollection",
    "name": "taiwan_counties",
    "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
    "features": features,
}
with open(OUT_GEO, "w", encoding="utf-8") as fh:
    json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"))
with open(OUT_CEN, "w", encoding="utf-8") as fh:
    json.dump({k: centroids[k] for k in ORDER}, fh, ensure_ascii=False, indent=2)

import os
print("tolerance", TOLERANCE)
print("counties:", len(features))
print("geojson bytes:", os.path.getsize(OUT_GEO))
