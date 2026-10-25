"""Read-only Supabase activity and availability check; Python 3.11+, no packages."""
import json
import os
from pathlib import Path
import socket
import ssl
import sys
import time
import tomllib
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DELAYS = (5, 15, 30)
TIMEOUT = 20


class CheckError(Exception):
    def __init__(self, message, retryable=False):
        super().__init__(message)
        self.retryable = retryable


def read_settings(path=ROOT / "hugo.toml"):
    with path.open("rb") as source:
        config = tomllib.load(source)["params"]["comments"]
    url = config["supabase_url"].rstrip("/")
    key = config["supabase_publishable_key"]
    parsed = urlsplit(url)
    if (not config.get("enabled") or parsed.scheme != "https" or not parsed.hostname
            or parsed.username or parsed.password or parsed.path or parsed.query
            or parsed.fragment or not key.startswith("sb_publishable_")):
        raise CheckError("配置错误：需要已启用的 HTTPS 项目和公开 publishable key。")
    return url, key


def classify(error):
    if isinstance(error, HTTPError):
        status = error.code
        if status in (401, 403):
            return CheckError(f"HTTP {status}：检查公开密钥、表权限和 RLS。")
        if status == 404:
            return CheckError("HTTP 404：检查项目地址或 comments 表是否存在。")
        return CheckError(f"HTTP {status}：服务暂不可用或请求受限。",
                          status in (408, 429) or status >= 500)
    reason = error.reason if isinstance(error, URLError) else error
    if isinstance(reason, socket.gaierror):
        return CheckError("DNS 解析失败：可能是项目已暂停，也可能是临时 DNS 故障；检查项目状态。", True)
    if isinstance(reason, (TimeoutError, socket.timeout)):
        return CheckError("连接或读取超时。", True)
    if isinstance(reason, ssl.SSLError):
        return CheckError("TLS 校验失败：检查服务证书或运行环境。")
    return CheckError("网络连接失败：检查 Supabase 项目状态与服务可用性。", True)


def valid_comments(data):
    return isinstance(data, list) and len(data) <= 1 and all(
        isinstance(row, dict) and "id" in row for row in data)


def valid_auth(data):
    return isinstance(data, dict) and data.get("name") == "GoTrue"


def check(request, validate, opener=urlopen, sleep=time.sleep):
    for attempt in range(4):
        try:
            with opener(request, timeout=TIMEOUT) as response:
                body = response.read(65537)
            if len(body) > 65536:
                raise CheckError("响应超出预期大小。")
            try:
                data = json.loads(body)
            except (ValueError, UnicodeError):
                raise CheckError("响应不是预期 JSON，未将 HTTP 成功误判为检查通过。")
            if not validate(data):
                raise CheckError("JSON 内容格式异常，检查未通过。")
            return
        except CheckError:
            raise
        except (URLError, OSError) as error:
            failure = classify(error)
            if not failure.retryable or attempt == 3:
                raise failure from None
            delay = DELAYS[attempt]
            print(f"尝试 {attempt + 1}/4 失败：{failure} {delay} 秒后重试。", flush=True)
            sleep(delay)


def main():
    summary = ["## Supabase 只读保活与可用性检查", ""]
    failed = False
    try:
        url, key = read_settings()
    except (CheckError, KeyError, OSError, tomllib.TOMLDecodeError):
        print("::error::无法读取有效的博客 Supabase 配置。")
        return 1
    endpoints = (
        ("数据库只读查询", "/rest/v1/comments?select=id&limit=1", valid_comments),
        ("Google 登录依赖的 Auth 服务", "/auth/v1/health", valid_auth),
    )
    for name, endpoint, validate in endpoints:
        request = Request(url + endpoint, method="GET", headers={
            "apikey": key, "Accept": "application/json",
            "User-Agent": "hanshui-space-availability/1.0",
            "Cache-Control": "no-cache",
        })
        try:
            check(request, validate)
            message = f"{name}：成功（响应格式已验证）。"
            print(message)
            summary.append(f"- ✅ {message}")
        except CheckError as error:
            failed = True
            message = f"{name}：{error}"
            print(f"::error::{message}")
            summary.append(f"- ❌ {message}")
    summary.extend(["", "仅 GET；不写入留言、不修改用户或权限，不输出留言内容。",
                    "免费项目仍可能因低活跃暂停；本检查不自动恢复项目，也不持有管理密钥。"])
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as output:
            output.write("\n".join(summary) + "\n")
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
