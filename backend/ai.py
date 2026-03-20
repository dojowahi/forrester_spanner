from typing import Optional
from google import genai
from google.genai import types
from loguru import logger

from backend.config import settings

def get_embeddings(client, text=None, image_bytes=None, model_name=None):
    """Generates 768-dimensional embeddings for text or image bytes."""
    if model_name is None:
        model_name = settings.EMBEDDING_MODEL
    try:
        contents = []
        if text:
            contents.append(text)
        if image_bytes and len(image_bytes) > 0:
            if "text-embedding" not in model_name:
                contents.append(types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"))
            
        if not contents:
            logger.warning("get_embeddings called with empty valid contents. Returning zero vector.")
            return [0.0] * 768

        response = client.models.embed_content(
            model=model_name,
            contents=contents,
            config=types.EmbedContentConfig(
                task_type="SEMANTIC_SIMILARITY",
                output_dimensionality=768
            )
        )
        return response.embeddings[0].values
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        return [0.0] * 768

def generate_image(client, prompt: str):
    """Generates an image using Gemini 3.1 modalities."""
    try:
        response = client.models.generate_content(
            model=settings.IMAGE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['IMAGE'],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
                thinking_config=types.ThinkingConfig(include_thoughts=False, thinking_level=types.ThinkingLevel.MINIMAL)
            ),
        )
        if hasattr(response, "candidates") and response.candidates:
            parts = response.candidates[0].content.parts
            for part in parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    return part.inline_data.data
    except Exception as e:
        logger.error(f"Gemini Image Generation failed: {e}")
        raise e
    return None
