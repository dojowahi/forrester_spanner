import sys
import os
sys.path.append(os.path.abspath('.'))
from google import genai
from backend.ai import generate_image
from backend.config import settings

print(f"Testing with IMAGE_MODEL={settings.IMAGE_MODEL}")

client = genai.Client(vertexai=True, project='gen-ai-4all', location='global')
try:
    img_bytes = generate_image(client, 'A professional studio product shot of a smart watch, high resolution')
    if img_bytes:
        with open('test_product.jpg', 'wb') as f:
            f.write(img_bytes)
        print("SUCCESS: test_product.jpg created")
    else:
        print("FAILURE: img_bytes is None or Empty")
except Exception as e:
    print(f"EXCEPTION: {e}")
