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
    # Security check - only allow specific files
    allowed_files = ["datatest.txt", "datatest2.txt", "datatraining.txt"]
    
    if filename not in allowed_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = DATA_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="text/plain"
    )

@router.get("/data/list")
async def list_data_files():
    """List available data files."""
    files = []
    
    for filename in ["datatest.txt", "datatest2.txt", "datatraining.txt"]:
        file_path = DATA_DIR / filename
        if file_path.exists():
            stat = file_path.stat()
            files.append({
                "filename": filename,
                "size": stat.st_size,
                "modified": stat.st_mtime
            })
    
    return {"files": files}
