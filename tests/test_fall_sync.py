import base64
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fall_sync',ROOT/'scripts/sync_fall_map.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
SAMPLE=json.loads((ROOT/'tests/fixtures/public-map-sample.json').read_text())['records']

def fixture(records):
 records=copy.deepcopy(records)
 seed=next(p for p in records if p[5][0][0]=='Conway Summit')
 for i in range(50):
  p=copy.deepcopy(seed);p[5]=[[f'Synthetic location {i}']];p[4][4]=[37+i/100,-119];records.append(p)
 return 'var _pageData = '+json.dumps(json.dumps(records))+';'

class SyncSafety(unittest.TestCase):
 def test_actual_source_leafs_match_the_actual_legend(self):
  _,points=sync.parse_publication(fixture(SAMPLE));stages={p['name']:p['stage'] for p in points}
  self.assertEqual(stages['Conway Summit'],'patchy')
  self.assertEqual(stages['Silver Lake'],'patchy')
  self.assertEqual(stages['Convict Lake'],'patchy')
  self.assertEqual(stages['Sonora Pass'],'near')
  self.assertTrue(all(p['observedAt'] is None for p in points))
 def test_changed_icons_and_missing_legend_fail_closed(self):
  altered=copy.deepcopy(SAMPLE);p=next(p for p in altered if p[5][0][0]=='Conway Summit')
  raw=base64.b64decode(p[0][0].split(',',1)[1]);p[0][0]='data:image/png;base64,'+base64.b64encode(raw+b'changed').decode()
  with self.assertRaises(ValueError):sync.parse_publication(fixture(altered))
  with self.assertRaises(ValueError):sync.parse_publication(fixture([p for p in SAMPLE if 'Past Peak' not in p[5][0][0]]))
 def test_missing_and_ambiguous_locations_are_not_invented(self):
  _,points=sync.parse_publication(fixture(SAMPLE));entries=sync.build_entries(points)
  self.assertFalse(entries['mono']['listed']);self.assertEqual(entries['mono']['stage'],'unknown')
  conway=next(p for p in points if p['name']=='Conway Summit');points.append(dict(conway,lat=1))
  self.assertFalse(sync.build_entries(points)['conway']['listed'])
 def test_failure_keeps_last_success_and_status(self):
  with tempfile.TemporaryDirectory() as directory:
   p=Path(directory);source=p/'source.html';source.write_text(fixture(SAMPLE))
   self.assertEqual(sync.sync(source,p),0)
   old=json.loads((p/'秋色状态.json').read_text());source.write_text('unavailable')
   self.assertEqual(sync.sync(source,p),1)
   new=json.loads((p/'秋色状态.json').read_text())
   self.assertFalse(new['ok']);self.assertEqual(new['lastSuccessAt'],old['lastSuccessAt'])
   self.assertEqual(new['points'],old['points']);self.assertEqual(new['entries'],old['entries'])

if __name__=='__main__':unittest.main()
