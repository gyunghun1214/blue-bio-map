"""Bake the entry-screen globe (dist/intro.js) from NASA imagery: placeholder, filled in at step 3."""
import math


def perspective(lon, lat, lon0, lat0, P):
    """Vertical perspective from P radii off the centre, in unit-disc coordinates (horizon r=1, x right, y up); None
    behind the horizon. The same formula as perspective() in dist/intro.js."""
    r = math.pi / 180
    f, f0, dl = lat * r, lat0 * r, (lon - lon0) * r
    cosc = math.sin(f0) * math.sin(f) + math.cos(f0) * math.cos(f) * math.cos(dl)
    if cosc < 1 / P:
        return None
    k = (P - 1) / (P - cosc) / math.sqrt((P - 1) / (P + 1))
    return (k * math.cos(f) * math.sin(dl), k * (math.cos(f0) * math.sin(f) - math.sin(f0) * math.cos(f) * math.cos(dl)))
