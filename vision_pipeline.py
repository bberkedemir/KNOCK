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


# ---------------------------------------------------------------------------
# Pre-processing: Merge background + surrender sprite → flat RGB image
# ---------------------------------------------------------------------------
def merge_for_inpainting() -> str:
    """
    Composite static/poses/soldier_surrender.png over static/background/outpost_bg.png
    following the CSS logic (height: 95%, centered at bottom).
    """
    bg_path = STATIC_DIR / "background" / "outpost_bg.png"
    fg_path = STATIC_DIR / "poses" / "soldier_surrender.png"

    bg = Image.open(str(bg_path)).convert("RGBA")
    fg = Image.open(str(fg_path)).convert("RGBA")

    bg_w, bg_h = bg.size
    fg_w, fg_h = fg.size

    # Calculate new height (95% of background height)
    new_h = int(bg_h * 0.95)
    # Calculate new width to maintain aspect ratio
    new_w = int(fg_w * (new_h / fg_h))

    # Resize foreground proportionally
    fg_resized = fg.resize((new_w, new_h), Image.LANCZOS)

    # Create a transparent overlay the size of the background
    overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    
    # Calculate position (centered horizontally, anchored to bottom)
    paste_x = (bg_w - new_w) // 2
    paste_y = bg_h - new_h
    
    overlay.paste(fg_resized, (paste_x, paste_y), fg_resized)

    # Alpha composite: overlay on top of bg
    merged = Image.alpha_composite(bg, overlay)

    output_path = STATIC_DIR / "temp_merged_surrender.jpg"
    merged.convert("RGB").save(str(output_path), quality=95)
    print(f"[MERGE] Corrected aspect composite saved → {output_path} (Soldier: {new_w}x{new_h} at {paste_x},{paste_y})")
    return str(output_path)


def merge_for_inpainting_badge() -> str:
    """
    Composite static/poses/soldier_unarmed_sad.png over static/background/outpost_bg.png
    following the CSS logic. This provides the correct base image for the badge inpainting.
    """
    bg_path = STATIC_DIR / "background" / "outpost_bg.png"
    fg_path = STATIC_DIR / "poses" / "soldier_unarmed_sad.png"

    bg = Image.open(str(bg_path)).convert("RGBA")
    fg = Image.open(str(fg_path)).convert("RGBA")

    bg_w, bg_h = bg.size
    fg_w, fg_h = fg.size

    new_h = int(bg_h * 0.95)
    new_w = int(fg_w * (new_h / fg_h))

    fg_resized = fg.resize((new_w, new_h), Image.LANCZOS)
    overlay = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    
    paste_x = (bg_w - new_w) // 2
    paste_y = bg_h - new_h
    
    overlay.paste(fg_resized, (paste_x, paste_y), fg_resized)
    merged = Image.alpha_composite(bg, overlay)

    output_path = STATIC_DIR / "temp_merged_badge.jpg"
    merged.convert("RGB").save(str(output_path), quality=95)
    print(f"[MERGE] Badge composite saved → {output_path}")
    return str(output_path)


INPAINT_PROMPTS = {
    "weapon": "Olive drab military fatigues, plain uniform shirt texture, natural background, "
              "no weapon, seamless blending, 1973 Vietnam era photograph style",
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

    if mask is None:
        raise RuntimeError(f"YOLO-World failed to detect {target}")

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
        model.set_classes(["M16 rifle", "assault rifle", "gun", "weapon"])
    else:
        # Expand classes for small chest objects in the composite image
        model.set_classes(['badge', 'insignia', 'patch', 'shield', 'police badge', 'military badge', 'pin', 'medal', 'emblem', 'name tag'])

    # Use half=False to avoid dtype mismatch errors between CLIP and YOLO on some GPUs
    # Lower base predict conf because the soldier is now scaled down in a larger composite scene
    conf_val = 0.01 if target == "weapon" else 0.005
    results = model.predict(source=image_path, conf=0.005, verbose=False, half=False) # Predict with very low conf for logging

    print(f"[MASK] YOLO-World scanning for {target} (threshold {conf_val})...")
    
    best_match = None
    for result in results:
        for box in result.boxes:
            c = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = result.names[cls_id]
            print(f"  - Detected: {cls_name} (conf: {c:.3f})")
            
            if c >= conf_val:
                if best_match is None or c > float(best_match.conf[0]):
                    best_match = box

    if best_match:
        xyxy = best_match.xyxy[0].cpu().numpy()
        x1, y1, x2, y2 = map(int, xyxy)
        print(f"[MASK] Selected best match: {result.names[int(best_match.cls[0])]} at [{x1}, {y1}, {x2}, {y2}]")
        
        # Create a soft elliptical mask over the bounding box
        mask = Image.new("L", (w, h), 0)
        draw = ImageDraw.Draw(mask)
        
        # Use a very tight mask (5% padding) so the AI ONLY touches the weapon
        # and doesn't have the space to ruin the existing hands.
        padding_x = int((x2 - x1) * 0.05)
        padding_y = int((y2 - y1) * 0.05)
        
        # Asymmetrical vertical padding to avoid hands (usually near top/middle of weapon)
        # Shift the entire mask downwards slightly.
        shift_y = int((y2 - y1) * 0.05) if target == "weapon" else 0
        
        nx1 = max(0, x1 - padding_x)
        ny1 = max(0, y1 + shift_y) # Move top bound down
        nx2 = min(w, x2 + padding_x)
        ny2 = min(h, y2 + padding_y + shift_y) # Move bottom bound down
        
        draw.ellipse([nx1, ny1, nx2, ny2], fill=255)
        
        # Blur edges for smooth transition during inpainting
        mask = mask.filter(ImageFilter.GaussianBlur(radius=15))
        # Re-threshold to get a solid core with soft edges
        mask = mask.point(lambda p: 255 if p > 64 else 0)
        return mask

    return None





# ---------------------------------------------------------------------------
# Step B: Inpainting
# ---------------------------------------------------------------------------
def inpaint_image(original_path: str, mask_path: str, target: str) -> str:
    """Inpaint the masked region using configured method."""
    use_free = os.getenv("USE_FREE_MODELS", "true").lower() == "true"
    
    if not use_free:
        return _inpaint_openai(original_path, mask_path, target)

    allow_local = os.getenv("ALLOW_LOCAL_INPAINT", "false").lower() == "true"
    if allow_local:
        return _inpaint_local(original_path, mask_path, target)
    
    # If using free models but local is disabled, force local anyway or fail.
    # We removed HF API, so we must use local as fallback for free tier.
    print("[INPAINT] Free models requested but local inpaint disabled. Forcing local fallback.")
    return _inpaint_local(original_path, mask_path, target)


def _inpaint_openai(original_path, mask_path, target):
    """Use OpenAI API for inpainting."""
    import openai
    import io
    import requests
    
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    prompt = INPAINT_PROMPTS[target]

    img = Image.open(original_path).convert("RGBA").resize((512, 512))
    msk = Image.open(mask_path).convert("L").resize((512, 512))
    
    # OpenAI mask needs to be RGBA with alpha=0 where inpainting should occur
    # The current mask has white (255) for areas to inpaint, black (0) for keep.
    transparent_mask = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    transparent_mask.putalpha(msk.point(lambda p: 0 if p > 128 else 255))

    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)
    img_bytes.name = "image.png"

    msk_bytes = io.BytesIO()
    transparent_mask.save(msk_bytes, format="PNG")
    msk_bytes.seek(0)
    msk_bytes.name = "mask.png"

    try:
        response = client.images.edit(
            model="dall-e-2",
            image=img_bytes,
            mask=msk_bytes,
            prompt=prompt,
            n=1,
            size="512x512",
            response_format="url"
        )
        result_url = response.data[0].url
        result_img = Image.open(io.BytesIO(requests.get(result_url).content)).convert("RGB")
        
        output_path = str(STATIC_DIR / f"soldier_{target}_removed.png")
        original = Image.open(original_path).convert("RGB")
        mask = Image.open(mask_path).convert("L")
        
        result_resized = result_img.resize(original.size, Image.LANCZOS)
        final = Image.composite(result_resized, original, mask)
        
        final.save(output_path)
        return output_path

    except Exception as e:
        print(f"[INPAINT] OpenAI API failed: {e}")
        raise RuntimeError(f"OpenAI API failed: {e}")


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
        # Composite result back onto original to perfectly preserve unmasked areas (like the face)
        original = Image.open(original_path).convert("RGB")
        mask = Image.open(mask_path).convert("L")
        
        result_resized = result.resize(original.size, Image.LANCZOS)
        final = Image.composite(result_resized, original, mask)
        
        final.save(output_path)
        return output_path
    except Exception as e:
        print(f"[INPAINT] Local diffusers failed: {e}")
        raise RuntimeError(f"Local diffusers failed: {e}")





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
    elif len(sys.argv) > 1 and sys.argv[1] == "--merge-test":
        print("Testing merge_for_inpainting()...")
        out = merge_for_inpainting()
        print(f"Merge complete: {out}")
    else:
        print("Usage: python vision_pipeline.py --test | --merge-test")
