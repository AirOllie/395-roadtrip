"""Read the anonymous, public Fall Map publication without executing its scripts.
Match each published leaf icon to this same publication's legend. Fail closed.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import urllib.request

MAP_ID = '12FSQxbVe9CedswOvJaWaeI5vvYU'
SOURCE = 'https://www.google.com/maps/d/embed?mid=' + MAP_ID
SOURCE_PAGE = 'https://californiafallcolor.com/map/'
ROOT = Path(__file__).resolve().parents[1]
LABELS = {
 'unknown': ('未报告', '', '#788077'),
 'starting': ('刚开始变色', '0–10%', '#68a554'),
 'patchy': ('局部变色', '10–50%', '#cfb637'),
 'near': ('接近盛期', '50–75%', '#df8c28'),
 'peak': ('盛期', '75–100%', '#bd4335'),
 'past': ('已过盛期', '', '#76533f'),
}
# Exact name matches only. June Lake Overlook explicitly uses an area reference.
TARGETS = {
 'pass': ('Sonora Pass', False), 'conway': ('Conway Summit', False),
 'silver': ('Silver Lake', False), 'convict': ('Convict Lake', False),
 'mono': ('Mono Lake', False), 'hot': ('Hot Creek', False),
 'june-overlook': ('June Lake Loop', True),
 'mono-center': ('Mono Basin Scenic Area Visitor Center', False),
 'bridgeport-court': ('Bridgeport Courthouse', False),
 'south': ('South Lake', True), 'sabrina': ('Lake Sabrina', False),
 'mcgee': ('McGee Creek', False),
}

def icon_hash(icon):
 if not re.fullmatch(r'data:image/png;base64,[A-Za-z0-9+/=]+', icon):
  raise ValueError('Unsupported source icon encoding')
 binary = base64.b64decode(icon.split(',', 1)[1], validate=True)
 if not binary.startswith(b'\x89PNG\r\n\x1a\n') or len(binary) > 100000:
  raise ValueError('Invalid source leaf image')
 return hashlib.sha256(binary).hexdigest()

def key_stage(name):
 if 'Past Peak' in name: return 'past'
 if '75-100%' in name: return 'peak'
 if '50-75%' in name: return 'near'
 if '10-50%' in name: return 'patchy'
 if '0-10%' in name: return 'starting'
 if 'Not Yet Reporting' in name: return 'unknown'
 raise ValueError('Unrecognized source legend')

def parse_publication(html):
 marker = 'var _pageData = '
 if marker not in html: raise ValueError('Public map format changed')
 encoded, _ = json.JSONDecoder().raw_decode(html.split(marker, 1)[1])
 if not isinstance(encoded, str): raise ValueError('Invalid publication envelope')
 tree = json.loads(encoded)
 features = []
 def walk(node):
  if not isinstance(node, list): return
  try:
   icon, name, ll = node[0][0], node[5][0][0], node[4][4]
   if (isinstance(icon, str) and icon.startswith('data:image/')
       and isinstance(name, str) and isinstance(ll, list) and len(ll) == 2
       and all(isinstance(v, (float, int)) and math.isfinite(v) for v in ll)
       and -90 <= ll[0] <= 90 and -180 <= ll[1] <= 180):
    features.append({'name': name, 'icon': icon, 'lat': ll[0], 'lon': ll[1]})
  except (IndexError, TypeError): pass
  for child in node: walk(child)
 walk(tree)
 legend = {}
 for f in features:
  if f['name'].startswith('Key:'):
   stage = key_stage(f['name'])
   legend[stage] = {'label': LABELS[stage][0], 'range': LABELS[stage][1],
                    'color': LABELS[stage][2], 'icon': f['icon'], 'hash': icon_hash(f['icon'])}
 if set(legend) != set(LABELS): raise ValueError('Incomplete Fall Map legend')
 by_hash = {v['hash']: key for key, v in legend.items()}
 points, seen = [], set()
 for f in features:
  if f['name'].startswith('Key:'): continue
  stage = by_hash.get(icon_hash(f['icon']))
  if stage is None: raise ValueError('Source leaf no longer matches its legend')
  identity = (f['name'], f['lat'], f['lon'])
  if identity in seen: continue
  seen.add(identity)
  points.append({'name': f['name'], 'lat': f['lat'], 'lon': f['lon'], 'stage': stage,
                 'observedAt': None})
 if len(points) < 50: raise ValueError('Unexpectedly incomplete public map')
 return legend, points

def build_entries(points):
 entries = {}
 for entry_id, (source_name, regional) in TARGETS.items():
  matches = [p for p in points if p['name'].casefold() == source_name.casefold()]
  # Ambiguity is unknown, never arbitrarily choose a same-name location.
  match = matches[0] if len(matches) == 1 else None
  entries[entry_id] = {'stage': match['stage'] if match else 'unknown',
                       'sourceName': source_name if match else None,
                       'regional': regional if match else False,
                       'listed': bool(match), 'observedAt': None}
 return entries

def save_payload(payload, output):
 output.mkdir(parents=True, exist_ok=True)
 (output / '秋色状态.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
 (output / 'fall-state.js').write_text('window.FALL_STATE=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n')

def sync(input_path=None, output=ROOT):
 checked = datetime.now(timezone.utc).isoformat(timespec='seconds')
 previous_path = output / '秋色状态.json'
 previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
 try:
  if input_path: html = Path(input_path).read_text()
  else:
   request = urllib.request.Request(SOURCE, headers={'User-Agent': '395-roadtrip-fall-sync/1.0 (+https://github.com/AirOllie/395-roadtrip)'})
   with urllib.request.urlopen(request, timeout=40) as response:
    raw = response.read(5000001)
   if len(raw) > 5000000: raise ValueError('Map publication exceeds expected size')
   html = raw.decode('utf-8')
  legend, points = parse_publication(html)
  fingerprint = hashlib.sha256(json.dumps(points, sort_keys=True).encode()).hexdigest()
  payload = {'version': 1, 'source': SOURCE_PAGE, 'mapUrl': SOURCE,
             'checkedAt': checked, 'lastSuccessAt': checked, 'ok': True,
             'stateChangedAt': previous.get('stateChangedAt', checked) if previous.get('fingerprint') == fingerprint else checked,
             'fingerprint': fingerprint, 'observedAt': None, 'legend': legend,
             'points': points, 'entries': build_entries(points),
             'note': 'Fall Map 当前发布版；通常周五更新。同步时间不是现场观测时间，原图未注明逐点观测日期。'}
  save_payload(payload, output)
  print(f'Synced {len(points)} published markers; {sum(e["listed"] for e in payload["entries"].values())} matched scenic entries')
  return 0
 except Exception as exc:
  if previous.get('points'):
   previous.update(ok=False, checkedAt=checked, error='公开地图读取失败，保留上次成功状态；请查看原图。')
   save_payload(previous, output)
  print(f'Fall Map sync failed: {type(exc).__name__}: {exc}', file=sys.stderr)
  return 1

if __name__ == '__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--input');parser.add_argument('--output', type=Path, default=ROOT)
 args=parser.parse_args();sys.exit(sync(args.input,args.output))
