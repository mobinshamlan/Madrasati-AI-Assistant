import unittest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.websockets import WebSocketState
from backend.phone_bridge import media


class PhoneDisconnectTests(unittest.IsolatedAsyncioTestCase):
    async def test_parent_followup_cancels_scheduled_goodbye(self):
        socket = MagicMock()
        socket.accept = AsyncMock()
        socket.send_text = AsyncMock()
        socket.close = AsyncMock()
        socket.application_state = socket.client_state = WebSocketState.CONNECTED
        first = True
        async def receive():
            nonlocal first
            if first:
                first = False
                return json.dumps({"event": "start", "start": {"streamSid": "test-stream", "customParameters": {}}})
            await asyncio.sleep(0.05)
            return json.dumps({"event": "stop"})
        socket.receive_text = receive

        class Upstream:
            send = AsyncMock()
            close = AsyncMock()
            def __aiter__(self):
                return self.events()
            async def events(self):
                yield json.dumps({"type": "session.output_transcript.delta", "delta": "يومك سعيد"})
                yield json.dumps({"type": "session.input_transcript.delta", "delta": "طيب كم درجته؟"})

        with patch("backend.phone_bridge._connect_openai", AsyncMock(return_value=Upstream())), patch("backend.phone_bridge.build_instructions", return_value="test"), patch("backend.phone_bridge.HANGUP_AFTER_GOODBYE", 0.01):
            await media(socket)
        socket.close.assert_not_awaited()

    async def test_socket_closed_during_receive_is_a_normal_hangup(self):
        socket = MagicMock()
        socket.accept = AsyncMock()
        socket.application_state = WebSocketState.CONNECTED
        socket.client_state = WebSocketState.CONNECTED

        async def receive():
            socket.application_state = WebSocketState.DISCONNECTED
            raise RuntimeError('WebSocket is not connected. Need to call "accept" first.')

        socket.receive_text = receive
        await media(socket)

    async def test_unrelated_runtime_errors_still_surface(self):
        socket = MagicMock()
        socket.accept = AsyncMock()
        socket.application_state = WebSocketState.CONNECTED
        socket.client_state = WebSocketState.CONNECTED
        socket.receive_text = AsyncMock(side_effect=RuntimeError("unexpected failure"))
        with self.assertRaisesRegex(RuntimeError, "unexpected failure"):
            await media(socket)
