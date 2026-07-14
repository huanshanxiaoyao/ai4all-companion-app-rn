#!/usr/bin/env python3
"""Expose a loopback-only test API to a trusted LAN for device testing.

This is intentionally a small TCP forwarder rather than a production reverse
proxy. Bind it only on a trusted network and stop it when device testing ends.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib


async def copy_stream(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    *,
    request_peer: object | None = None,
) -> None:
    first_chunk = True
    try:
        while data := await reader.read(64 * 1024):
            if first_chunk and request_peer is not None:
                request_line = data.split(b"\r\n", 1)[0].decode("ascii", errors="replace")
                print(f"LAN request peer={request_peer} {request_line}", flush=True)
            first_chunk = False
            writer.write(data)
            await writer.drain()
    finally:
        with contextlib.suppress(Exception):
            writer.write_eof()


async def serve(
    listen_host: str,
    listen_port: int,
    target_host: str,
    target_port: int,
) -> None:
    async def handle(
        client_reader: asyncio.StreamReader,
        client_writer: asyncio.StreamWriter,
    ) -> None:
        peer = client_writer.get_extra_info("peername")
        try:
            target_reader, target_writer = await asyncio.open_connection(
                target_host,
                target_port,
            )
        except OSError as error:
            print(f"LAN target unavailable peer={peer} error={error}", flush=True)
            client_writer.close()
            await client_writer.wait_closed()
            return

        try:
            await asyncio.gather(
                copy_stream(client_reader, target_writer, request_peer=peer),
                copy_stream(target_reader, client_writer),
            )
        finally:
            target_writer.close()
            client_writer.close()
            with contextlib.suppress(Exception):
                await target_writer.wait_closed()
            with contextlib.suppress(Exception):
                await client_writer.wait_closed()

    server = await asyncio.start_server(handle, listen_host, listen_port)
    addresses = ", ".join(str(sock.getsockname()) for sock in server.sockets or [])
    print(
        f"LAN test proxy ready: {addresses} -> {target_host}:{target_port}",
        flush=True,
    )
    async with server:
        await server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, required=True)
    parser.add_argument("--target-host", default="127.0.0.1")
    parser.add_argument("--target-port", type=int, required=True)
    args = parser.parse_args()
    asyncio.run(
        serve(
            args.listen_host,
            args.listen_port,
            args.target_host,
            args.target_port,
        )
    )


if __name__ == "__main__":
    main()
