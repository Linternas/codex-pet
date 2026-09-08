# Transparent app icon

Source: build/Codex-Pet.jpeg
Output: build/Codex-Pet-source.png
Tool: built-in image_gen, background-extraction edit.

Prompt:
Use case: background-extraction. Edit the provided Codex Pet icon. Remove ALL background: the gray outside backdrop, drop shadow, rounded-square tile, and baked-in checkerboard pattern. Output an actual RGBA transparent PNG, not a checkerboard depiction. Preserve the black and white puppy exactly: same eyes, ears, nose, expression, thick black outlines, white interior and gray shading, same proportions and pose. Keep the original puppy silhouette and flat bottom crop at its body; do not invent legs or additional artwork. Square canvas, centered puppy with transparent padding. No text, no new objects, no opaque tile. Only puppy pixels should be opaque; all surrounding regions including gaps between tail and body must have alpha zero.

Validated RGBA alpha0–255: source1254×1254, runtime1024×1024. Original JPEG preserved.
