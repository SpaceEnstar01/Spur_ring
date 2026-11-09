import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('research',Path(__file__).with_name('research.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ResearchTests(unittest.TestCase):
    def test_private_and_non_https_denied(self):
        for url in ['http://example.com','file:///etc/passwd','https://user:pass@example.com']:
            with self.assertRaises(ValueError): m.public_url(url)
        with patch.object(m.socket,'getaddrinfo',return_value=[(0,0,0,'',('127.0.0.1',443))]):
            with self.assertRaises(ValueError): m.public_url('https://localhost/')
    def test_unavailable_captions_are_not_invented(self):
        with patch.object(m,'fetch',return_value='var ytInitialPlayerResponse = {"videoDetails":{"title":"real"}};'):
            result=m.transcript('https://www.youtube.com/watch?v=abcdefghijk')
            self.assertFalse(result['available']); self.assertNotIn('segments',result)
    def test_missing_metadata_stays_missing(self):
        with patch.object(m,'fetch',return_value='var ytInitialPlayerResponse = {"videoDetails":{"title":"real","viewCount":"12"}};'):
            result=m.metadata('https://www.youtube.com/watch?v=abcdefghijk')
            self.assertEqual(result['views'],'12');self.assertIsNone(result['published'])
    def test_caption_times_preserved(self):
        responses=['var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"languageCode":"en","baseUrl":"https://www.youtube.com/api/timedtext?id=abc"}]}}};','{"events":[{"tStartMs":1250,"dDurationMs":2000,"segs":[{"utf8":"Example speech"}]}]}']
        with patch.object(m,'fetch',side_effect=responses):
            result=m.transcript('https://www.youtube.com/watch?v=abcdefghijk')
            self.assertEqual(result['segments'][0]['start'],1.25)
            self.assertEqual(result['segments'][0]['duration'],2)
    def test_html_removes_scripts(self):
        self.assertEqual(m.plain('<p>Evidence</p><script>bad()</script>'),'Evidence')
if __name__=='__main__':unittest.main()
