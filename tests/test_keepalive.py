import contextlib
import importlib.util
import io
from pathlib import Path
import socket
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request

spec = importlib.util.spec_from_file_location(
    "keepalive", Path(__file__).resolve().parents[1] / "scripts/supabase_keepalive.py")
keepalive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(keepalive)


class KeepAliveTests(unittest.TestCase):
    def setUp(self):
        self.output = io.StringIO()
        self.enterContext(contextlib.redirect_stdout(self.output))
        self.request = Request("https://example.supabase.co/rest/v1/comments?select=id&limit=1")

    def test_real_config_is_publishable_and_matches_blog(self):
        url, key = keepalive.read_settings()
        self.assertEqual(url, "https://cqvcepicdxkklfnumxsw.supabase.co")
        self.assertTrue(key.startswith("sb_publishable_"))

    def test_database_response_and_empty_table_are_both_valid(self):
        for body in (b'[{"id":2}]', b'[]'):
            keepalive.check(self.request, keepalive.valid_comments,
                            opener=lambda *args, **kwargs: io.BytesIO(body))

    def test_auth_response_is_checked(self):
        self.assertTrue(keepalive.valid_auth({"name": "GoTrue"}))
        self.assertFalse(keepalive.valid_auth({"error": "unavailable"}))

    def test_successful_http_with_wrong_json_is_failure(self):
        for body in (b'<html>error</html>', b'{"message":"error"}', b'[{"content":"text"}]'):
            with self.assertRaises(keepalive.CheckError):
                keepalive.check(self.request, keepalive.valid_comments,
                                opener=lambda *args, **kwargs: io.BytesIO(body))

    def test_transient_dns_recovers_without_silencing_errors(self):
        calls, delays = [], []
        def opener(*args, **kwargs):
            calls.append(kwargs["timeout"])
            if len(calls) < 3:
                raise URLError(socket.gaierror(-2, "name not known"))
            return io.BytesIO(b'[]')
        keepalive.check(self.request, keepalive.valid_comments, opener=opener, sleep=delays.append)
        self.assertEqual(delays, [5, 15])
        self.assertEqual(calls, [20, 20, 20])

    def test_persistent_dns_fails_after_bounded_retries(self):
        delays = []
        def opener(*args, **kwargs):
            raise URLError(socket.gaierror(-2, "name not known"))
        with self.assertRaisesRegex(keepalive.CheckError, "DNS"):
            keepalive.check(self.request, keepalive.valid_comments, opener=opener, sleep=delays.append)
        self.assertEqual(delays, [5, 15, 30])

    def test_bad_key_does_not_retry(self):
        delays = []
        def opener(*args, **kwargs):
            raise HTTPError(self.request.full_url, 401, "Unauthorized", {}, None)
        with self.assertRaisesRegex(keepalive.CheckError, "401"):
            keepalive.check(self.request, keepalive.valid_comments, opener=opener, sleep=delays.append)
        self.assertEqual(delays, [])

    def test_503_and_timeouts_are_retryable(self):
        for error in (HTTPError(self.request.full_url, 503, "Unavailable", {}, None),
                      URLError(TimeoutError())):
            self.assertTrue(keepalive.classify(error).retryable)


if __name__ == "__main__":
    unittest.main()
