"""Data serving routes for sensor data files."""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

# Get the project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"

@router.get("/data/{filename}")
async def get_data_file(filename: str):
    """Serve sensor data files."""
    file_path = DATA_DIR / filename
    
    # Security check - ensure file is in data directory and has allowed extension
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Only allow .txt and .csv files
    if not (filename.endswith('.txt') or filename.endswith('.csv')):
        raise HTTPException(status_code=404, detail="File type not allowed")
    
    # Ensure the file is within the data directory (path traversal protection)
    try:
        file_path.resolve().relative_to(DATA_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="text/plain" if filename.endswith('.txt') else "text/csv"
    )

@router.get("/data/list")
async def list_data_files():
    """List available data files."""
    files = []
    
    # Get all .txt and .csv files from the data directory
    for file_path in DATA_DIR.iterdir():
        if file_path.is_file() and (file_path.suffix in ['.txt', '.csv']):
            stat = file_path.stat()
            files.append({
                "filename": file_path.name,
                "size": stat.st_size,
                "modified": stat.st_mtime
            })
    
    return {"files": files}
