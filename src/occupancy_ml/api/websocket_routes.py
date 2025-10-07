"""WebSocket endpoint for real-time Kafka processing results."""

import asyncio
import json
import logging
from typing import Dict, Any, Set
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.routing import APIRouter

logger = logging.getLogger(__name__)

# Global set to track active WebSocket connections
active_connections: Set[WebSocket] = set()

# Queue to store recent results for new connections
recent_results: list = []
MAX_RECENT_RESULTS = 10

router = APIRouter()

async def broadcastPredictionResult(result: Dict[str, Any]):
    """Broadcast a prediction processing result to all connected WebSocket clients."""
    if not active_connections:
        logger.debug("No active WebSocket connections to broadcast to")
        return
    
    message = json.dumps({
        "type": "prediction_result",
        "data": result,
        "timestamp": result.get("timestamp", "")
    })
    
    # Store in recent results for new connections
    recent_results.append(result)
    if len(recent_results) > MAX_RECENT_RESULTS:
        recent_results.pop(0)
    
    # Broadcast to all active connections
    disconnected = set()
    for connection in active_connections:
        try:
            await connection.send_text(message)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            disconnected.add(connection)
    
    # Remove disconnected connections
    active_connections.difference_update(disconnected)
    
    logger.info(f"Broadcasted prediction result to {len(active_connections)} clients")

@router.websocket("/ws/prediction-results")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for receiving prediction processing results."""
    await websocket.accept()
    active_connections.add(websocket)
    
    logger.info(f"WebSocket client connected. Total connections: {len(active_connections)}")
    
    # Send recent results to the new connection
    for result in recent_results:
        try:
            message = json.dumps({
                "type": "prediction_result",
                "data": result,
                "timestamp": result.get("timestamp", "")
            })
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending recent result: {e}")
            break
    
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "subscribe":
                # Client can subscribe to specific types of results
                logger.info(f"Client subscribed to: {message.get('filters', 'all')}")
                
    except WebSocketDisconnect:
        active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total connections: {len(active_connections)}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        active_connections.discard(websocket)

@router.get("/ws/status")
async def websocket_status():
    """Get WebSocket connection status."""
    return {
        "active_connections": len(active_connections),
        "recent_results_count": len(recent_results),
        "status": "running"
    }
