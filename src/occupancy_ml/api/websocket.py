"""WebSocket connection management for real-time communication."""

import asyncio
import logging
import queue
import threading
from typing import List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Thread-safe WebSocket connection manager with message queuing."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.message_queue = queue.Queue()
        self._lock = threading.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        with self._lock:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket) -> None:
        """Send a message to a specific WebSocket connection."""
        await websocket.send_text(message)

    def queue_message(self, message: str) -> None:
        """Thread-safe method to queue a message for broadcasting."""
        self.message_queue.put(message)

    async def broadcast(self, message: str) -> None:
        """Broadcast message to all active connections."""
        with self._lock:
            connections_to_remove = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error sending message to WebSocket: {e}")
                    connections_to_remove.append(connection)
            
            # Remove broken connections
            for connection in connections_to_remove:
                self.active_connections.remove(connection)

    async def process_message_queue(self) -> None:
        """Process queued messages and broadcast them."""
        try:
            # Get message from queue (non-blocking)
            message = self.message_queue.get_nowait()
            await self.broadcast(message)
        except queue.Empty:
            # No messages in queue, return immediately
            pass
        except Exception as e:
            logger.error(f"Error processing message queue: {e}")


# Global connection manager instance
manager = ConnectionManager()
