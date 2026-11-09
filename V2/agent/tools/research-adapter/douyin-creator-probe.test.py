import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('creator_probe',Path(__file__).with_name('douyin-creator-probe.py'))
probe=importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class CreatorProbeRegression(unittest.TestCase):
    def test_only_explicit_creator_homepages_are_accepted(self):
        self.assertEqual(probe.creator_id('https://www.douyin.com/user/MS4wLjABAAAAExample?from_tab_name=main'),'MS4wLjABAAAAExample')
        for url in ['https://evil.example/user/MS4wLjABAAAAExample','https://www.douyin.com.evil.example/user/MS4wLjABAAAAExample','http://127.0.0.1/user/MS4wLjABAAAAExample','https://user:pass@www.douyin.com/user/MS4wLjABAAAAExample','https://www.douyin.com/video/123','https://v.douyin.com/example/']:
            with self.subTest(url=url):
                self.assertRaises(ValueError,probe.creator_id,url)

    def test_private_or_unavailable_counts_are_not_fabricated(self):
        row={'aweme_id':'1234567890123456789','desc':'My video','statistics':{'play_count':0,'digg_count':12,'comment_count':3},'author':{'uid':'not persisted','nickname':'not persisted'}}
        result=probe.normalize_video(row)
        self.assertEqual(result['metrics']['likes'],12)
        self.assertIsNone(result['metrics']['plays'])
        self.assertIsNone(result['metrics']['shares'])
        self.assertNotIn('author',result)
        self.assertEqual(result['comments'],[])

    def test_unknown_video_ids_do_not_generate_fake_links(self):
        self.assertIsNone(probe.normalize_video({'desc':'No ID'}))

if __name__=='__main__':
    unittest.main()
