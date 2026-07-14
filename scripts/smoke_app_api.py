#!/usr/bin/env python3
"""Run the install-test App V1 flow against a local isolated backend."""

from __future__ import annotations

import argparse
import sqlite3
import time

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8182/api/v1")
    parser.add_argument("--database", default="/tmp/ai4all-app-v1-e2e.sqlite3")
    args = parser.parse_args()

    phone = f"139{int(time.time()) % 100_000_000:08d}"
    with httpx.Client(base_url=args.base_url, timeout=130) as client:
        config = checked(client.get("/app/config"), "config")
        assert config["features"]["voice_input"] is True

        checked(
            client.post(
                "/auth/otp/send",
                json={"phone": phone, "captcha_verify_param": "local-smoke"},
            ),
            "otp-send",
        )
        with sqlite3.connect(args.database) as db:
            row = db.execute(
                "SELECT code FROM phone_verifications WHERE phone = ? ORDER BY id DESC LIMIT 1",
                (phone,),
            ).fetchone()
        assert row is not None

        verified = checked(
            client.post("/auth/otp/verify", json={"phone": phone, "code": row[0]}),
            "otp-verify",
        )
        session = checked(
            client.post(
                "/auth/session",
                json={"phone": phone, "verified_token": verified["verified_token"]},
            ),
            "session",
        )
        token = session["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        assert session["account"]["ai_display_name"] == "朝夕"

        checked(client.get("/me", headers=headers), "me")
        history = checked(client.get("/chat/messages", headers=headers), "history-empty")
        assert history["messages"] == []

        turn_payload = {"text": "你好，我来测试 App", "client_message_id": "smoke_client_0001"}
        first_turn = checked(
            client.post("/chat/turn", headers=headers, json=turn_payload),
            "chat-turn",
        )
        assert first_turn["reply"]
        duplicate = checked(
            client.post("/chat/turn", headers=headers, json=turn_payload),
            "chat-idempotency",
        )
        assert duplicate["reply"] == first_turn["reply"]
        assert duplicate["metadata"]["deduplicated"] is True

        history = checked(client.get("/chat/messages", headers=headers), "history-filled")
        assert [item["role"] for item in history["messages"]] == ["user", "assistant"]

        transcript = checked(
            client.post(
                "/audio/transcriptions",
                headers=headers,
                files={"audio": ("smoke.m4a", b"smoke-audio", "audio/m4a")},
                data={"duration_ms": "1500", "language": "zh"},
            ),
            "asr",
        )
        assert transcript["transcript"]

        checked(client.delete("/auth/session/current", headers=headers), "logout")
        assert client.get("/me", headers=headers).status_code == 401

    print("App V1 API smoke passed: auth, account, chat, idempotency, history, ASR, logout")


def checked(response: httpx.Response, stage: str) -> dict:
    if response.status_code >= 400:
        raise AssertionError(f"{stage} failed: HTTP {response.status_code} {response.text}")
    return response.json()


if __name__ == "__main__":
    main()
