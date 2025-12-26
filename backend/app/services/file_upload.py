import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings


def ensure_upload_dir() -> Path:
    """업로드 디렉토리가 존재하는지 확인하고 없으면 생성"""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def save_upload_file(file: UploadFile, subdirectory: str = "events") -> str:
    """
    업로드된 파일을 저장하고 저장된 파일 경로를 반환
    
    Args:
        file: 업로드된 파일
        subdirectory: 저장할 서브디렉토리 (예: "events", "users")
    
    Returns:
        저장된 파일의 상대 경로 (예: "events/abc123.jpg")
    """
    # 허용된 이미지 확장자
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    
    # 파일 확장자 확인
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"허용되지 않은 파일 형식입니다. 허용된 형식: {', '.join(allowed_extensions)}"
        )
    
    # 고유한 파일명 생성
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # 저장할 디렉토리 경로
    upload_dir = ensure_upload_dir()
    save_dir = upload_dir / subdirectory
    save_dir.mkdir(parents=True, exist_ok=True)
    
    # 파일 저장 경로
    file_path = save_dir / unique_filename
    
    # 파일 내용 읽기 및 저장
    try:
        content = file.file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 저장 중 오류가 발생했습니다: {str(e)}"
        )
    finally:
        file.file.seek(0)  # 파일 포인터 초기화
    
    # 상대 경로 반환 (예: "events/abc123.jpg")
    return f"{subdirectory}/{unique_filename}"


def delete_file(file_path: str) -> bool:
    """
    파일을 삭제
    
    Args:
        file_path: 삭제할 파일의 상대 경로
    
    Returns:
        삭제 성공 여부
    """
    upload_dir = Path(settings.UPLOAD_DIR)
    full_path = upload_dir / file_path
    
    try:
        if full_path.exists():
            full_path.unlink()
            return True
        return False
    except Exception:
        return False

