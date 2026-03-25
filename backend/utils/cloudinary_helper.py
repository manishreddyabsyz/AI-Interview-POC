import cloudinary
import cloudinary.uploader
from config import settings

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

def upload_resume(file_content: bytes, filename: str) -> dict:
    """Upload resume to Cloudinary"""
    try:
        result = cloudinary.uploader.upload(
            file_content,
            resource_type="raw",
            folder="resumes",
            public_id=filename,
            overwrite=True
        )
        return {
            "url": result.get("secure_url"),
            "public_id": result.get("public_id")
        }
    except Exception as e:
        raise Exception(f"Error uploading to Cloudinary: {str(e)}")
