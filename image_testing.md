# Image (Receipt Scanner) Testing Rules

- Accepted MIME types only: image/jpeg, image/png, image/webp (transcode others first).
- For animated images (GIF/APNG/animated WEBP), extract frame 1 only.
- Resize before encoding — avoid multi-MB base64 payloads (backend resizes to max 1600px).
- Don't send blank or solid-colour images.
- Endpoint: POST /api/ai/scan-receipt (multipart field `file`). Returns extracted JSON
  { merchant, total, date, category, items[] } — frontend confirms then saves as transaction.
- Model: gemini-3-flash-preview via EMERGENT_LLM_KEY.
