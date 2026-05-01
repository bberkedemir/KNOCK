"""
Terminal '73 — Vision Pipeline
YOLOv8 segmentation for mask generation + HuggingFace / local inpainting.
"""
import os, io, sys, requests
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from dotenv import load_dotenv

load_dotenv()

STATIC_DIR = Path(__file__).parent / "static"

# Predefined fallback regions (x1, y1, x2, y2) as fractions of image size
FALLBACK_REGIONS = {
    "weapon": (0.32, 0.42, 0.52, 0.92),   # narrow strip over the rifle
    "badge":  (0.25, 0.20, 0.45, 0.40),    # left chest area
}

INPAINT_PROMPTS = {
    "weapon": "A tired soldier standing at ease with empty relaxed hands, "
              "no weapon, natural background, 1973 Vietnam era photograph style",
    "badge":  "A soldier's chest in olive drab fatigues, plain fabric with no badge "
              "or insignia, natural cloth texture, 1973 Vietnam era photograph style",
}


# ---------------------------------------------------------------------------
# Step A: Mask Generation
# ---------------------------------------------------------------------------
def generate_mask(image_path: str, target: str = "weapon") -> str:
    """Generate an inpainting mask for the target object."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    mask = None

    # Strategy 1: Try YOLOv8 segmentation
    try:
        mask = _yolo_mask(image_path, target, w, h)
        if mask is not None:
            print(f"[MASK] YOLOv8 detected {target}")
    except Exception as e:
        print(f"[MASK] YOLOv8 failed: {e}")

    # Strategy 2: OpenCV edge-based detection in expected region
    if mask is None:
        try:
            mask = _cv_fallback_mask(image_path, target, w, h)
            if mask is not None:
                print(f"[MASK] CV fallback detected {target}")
        except Exception as e:
            print(f"[MASK] CV fallback failed: {e}")

    # Strategy 3: Predefined rectangular region
    if mask is None:
        print(f"[MASK] Using predefined region for {target}")
        mask = _predefined_mask(w, h, target)

    # Save mask as PNG with white = area to inpaint, black = keep
    mask_path = str(STATIC_DIR / f"mask_{target}.png")
    mask.save(mask_path)
    print(f"[MASK] Saved → {mask_path}")
    return mask_path


def _yolo_mask(image_path, target, w, h):
    """Try to detect objects using YOLO-World (Open Vocabulary) and create mask."""
    from ultralytics import YOLO

    # Use YOLO-World to detect objects not in standard COCO
    model = YOLO("yolov8s-world.pt")
    
    # Set custom open-vocabulary classes
    if target == "weapon":
        model.set_classes(["rifle", "gun", "weapon"])
    else:
        model.set_classes(["badge", "insignia", "patch"])

    results = model.predict(source=image_path, conf=0.15, verbose=False)

    for result in results:
        if len(result.boxes) > 0:
            # Get the highest confidence bounding box
            best_box = max(result.boxes, key=lambda b: float(b.conf[0]))
            xyxy = best_box.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = map(int, xyxy)
            
            # Create a soft elliptical mask over the bounding box
            mask = Image.new("L", (w, h), 0)
            draw = ImageDraw.Draw(mask)
            
            # Expand the bounding box slightly for natural blending
            padding_x = int((x2 - x1) * 0.15)
            padding_y = int((y2 - y1) * 0.15)
            nx1 = max(0, x1 - padding_x)
            ny1 = max(0, y1 - padding_y)
            nx2 = min(w, x2 + padding_x)
            ny2 = min(h, y2 + padding_y)
            
            draw.ellipse([nx1, ny1, nx2, ny2], fill=255)
            
            # Blur edges for smooth transition during inpainting
            mask = mask.filter(ImageFilter.GaussianBlur(radius=15))
            # Re-threshold to get a solid core with soft edges
            mask = mask.point(lambda p: 255 if p > 64 else 0)
            return mask

    return None


def _cv_fallback_mask(image_path, target, w, h):
    """Use OpenCV edge detection in the expected region."""
    import cv2

    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Get expected region
    rx1, ry1, rx2, ry2 = FALLBACK_REGIONS[target]
    x1, y1 = int(rx1 * w), int(ry1 * h)
    x2, y2 = int(rx2 * w), int(ry2 * h)

    roi = gray[y1:y2, x1:x2]
    # Use tighter edge detection
    edges = cv2.Canny(roi, 100, 200)
    
    # Mildly dilate edges to create a connected but tight mask
    kernel = np.ones((5, 5), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if len(contours) == 0:
        return None

    # Create mask from largest contour
    mask = np.zeros((h, w), dtype=np.uint8)
    for c in contours:
        c[:, :, 0] += x1
        c[:, :, 1] += y1
    largest = max(contours, key=cv2.contourArea)
    cv2.drawContours(mask, [largest], -1, 255, -1)
    
    # Small final dilation for a slight safety margin, smooth edges
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8), iterations=1)
    
    # Soften the edges of the mask
    mask_img = Image.fromarray(mask).filter(ImageFilter.GaussianBlur(radius=3))

    return mask_img


def _predefined_mask(w, h, target):
    """Create a soft elliptical mask in the predefined region."""
    rx1, ry1, rx2, ry2 = FALLBACK_REGIONS[target]
    x1, y1 = int(rx1 * w), int(ry1 * h)
    x2, y2 = int(rx2 * w), int(ry2 * h)

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    # Draw ellipse for more natural inpainting
    draw.ellipse([x1, y1, x2, y2], fill=255)
    # Blur edges for smooth transition
    mask = mask.filter(ImageFilter.GaussianBlur(radius=20))
    # Re-threshold
    mask = mask.point(lambda p: 255 if p > 64 else 0)
    return mask


# ---------------------------------------------------------------------------
# Step B: Inpainting
# ---------------------------------------------------------------------------
def inpaint_image(original_path: str, mask_path: str, target: str) -> str:
    """Inpaint the masked region using configured method."""
    mode = os.getenv("INPAINT_MODE", "api")
    allow_local = os.getenv("ALLOW_LOCAL_INPAINT", "false").lower() == "true"

    if mode == "local" and not allow_local:
        print("[INPAINT] Local mode requested but disabled by flag. Forcing API.")
        mode = "api"

    if mode == "local":
        return _inpaint_local(original_path, mask_path, target)
    return _inpaint_hf_api(original_path, mask_path, target)


def _inpaint_hf_api(original_path, mask_path, target):
    """Use HuggingFace Inference API for inpainting."""
    token = os.getenv("HF_API_TOKEN", "")
    
    """API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-inpainting" """
    # Using runwayml model for reliable inpainting on the inference API
    API_URL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-inpainting"
    headers = {"Authorization": f"Bearer {token}"}
    prompt = INPAINT_PROMPTS[target]

    # Prepare images: resize to 512x512 for SD
    img = Image.open(original_path).convert("RGB").resize((512, 512))
    msk = Image.open(mask_path).convert("L").resize((512, 512))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    msk_bytes = io.BytesIO()
    msk.save(msk_bytes, format="PNG")
    msk_bytes.seek(0)

    # Try the API — catch all network / API errors
    result = None
    try:
        resp = requests.post(
            API_URL, headers=headers,
            files={"image": ("image.png", img_bytes, "image/png"),
                   "mask": ("mask.png", msk_bytes, "image/png")},
            data={"prompt": prompt},
            timeout=120,
        )

        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
            result = Image.open(io.BytesIO(resp.content))
        else:
            print(f"[INPAINT] HF API error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[INPAINT] HF API request failed: {e}")

    if result is None:
        allow_local = os.getenv("ALLOW_LOCAL_INPAINT", "false").lower() == "true"
        if allow_local:
            print("[INPAINT] Falling back to simple blend")
            result = _simple_blend_fallback(original_path, mask_path)
        else:
            print("[INPAINT] HF API failed and local fallback is disabled.")
            raise RuntimeError("HuggingFace API failed and local fallback is disabled.")

    output_path = str(STATIC_DIR / f"soldier_{target}_removed.png")
    # Resize back to original size
    orig_size = Image.open(original_path).size
    result = result.resize(orig_size, Image.LANCZOS)
    result.save(output_path)
    return output_path


def _inpaint_local(original_path, mask_path, target):
    """Run diffusers locally (requires GPU for speed)."""
    allow_local = os.getenv("ALLOW_LOCAL_INPAINT", "false").lower() == "true"
    if not allow_local:
        print("[INPAINT] Local mode disabled by flag.")
        raise RuntimeError("Local inpainting is disabled by ALLOW_LOCAL_INPAINT flag.")

    try:
        import torch
        from diffusers import StableDiffusionInpaintPipeline

        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        pipe = StableDiffusionInpaintPipeline.from_pretrained(
            "runwayml/stable-diffusion-inpainting", torch_dtype=dtype).to(device)

        img = Image.open(original_path).convert("RGB").resize((512, 512))
        msk = Image.open(mask_path).convert("RGB").resize((512, 512))
        prompt = INPAINT_PROMPTS[target]
        result = pipe(prompt=prompt, image=img, mask_image=msk).images[0]

        output_path = str(STATIC_DIR / f"soldier_{target}_removed.png")
        orig_size = Image.open(original_path).size
        result = result.resize(orig_size, Image.LANCZOS)
        result.save(output_path)
        return output_path
    except Exception as e:
        allow_local = os.getenv("ALLOW_LOCAL_INPAINT", "false").lower() == "true"
        if allow_local:
            print(f"[INPAINT] Local diffusers failed: {e}. Falling back to simple blend.")
            return _simple_blend_fallback_save(original_path, mask_path, target)
        else:
            print(f"[INPAINT] Local diffusers failed: {e}. Local fallback is disabled.")
            raise


def _simple_blend_fallback(original_path, mask_path):
    """Local fallback: use OpenCV inpainting to fill masked region from surrounding pixels."""
    import cv2

    img = cv2.imread(original_path)
    msk = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if msk.shape[:2] != img.shape[:2]:
        msk = cv2.resize(msk, (img.shape[1], img.shape[0]))
    # Threshold mask to binary
    _, msk = cv2.threshold(msk, 127, 255, cv2.THRESH_BINARY)

    # Telea inpainting — fills from boundary inward using surrounding pixel context
    result = cv2.inpaint(img, msk, inpaintRadius=12, flags=cv2.INPAINT_TELEA)
    # Convert back to PIL
    return Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))


def _simple_blend_fallback_save(original_path, mask_path, target):
    result = _simple_blend_fallback(original_path, mask_path)
    output_path = str(STATIC_DIR / f"soldier_{target}_removed.png")
    result.save(output_path)
    return output_path


# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------
def process_inpainting(image_path: str, target: str) -> str:
    """Full pipeline: mask generation → inpainting. Returns output path."""
    print(f"\n{'='*50}")
    print(f"[PIPELINE] Starting inpainting for: {target}")
    print(f"[PIPELINE] Source: {image_path}")
    mask_path = generate_mask(image_path, target)
    output_path = inpaint_image(image_path, mask_path, target)
    print(f"[PIPELINE] Complete → {output_path}")
    print(f"{'='*50}\n")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        img = str(STATIC_DIR / "soldier.png")
        if Path(img).exists():
            print("Testing weapon mask generation...")
            process_inpainting(img, "weapon")
        else:
            print(f"No image found at {img}")
    else:
        print("Usage: python vision_pipeline.py --test")
