import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('learning_search', Path(__file__).with_name('media-learning-search.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PlatformSchemaRegression(unittest.TestCase):
    def test_platform_link_fields(self):
        for key, url in [('aweme_url','https://www.douyin.com/video/123'),('video_url','https://www.bilibili.com/video/BVexample'),('note_url','https://m.weibo.cn/detail/123')]:
            with self.subTest(key=key):
                result = module.normalize_record({key:url,'desc':'Public description','cookie':'must never pass through','user_id':'private'})
                self.assertEqual(result['url'],url)
                self.assertNotIn('cookie',result)
                self.assertNotIn('user_id',result)
                self.assertFalse(result['raw']['comments_collected'])
    def test_missing_source_url_is_not_fabricated(self):
        self.assertIsNone(module.normalize_record({'title':'A search hit without a link'}))

if __name__ == '__main__':
    unittest.main()
