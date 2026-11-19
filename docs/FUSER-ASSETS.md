# Fuser asset batch (17 Nov 2026)

Expiring Fuser trial credits spent on virtual try-on renders, vendored
as static assets — NO runtime Fuser dependency.

- `apps/web/public/assets/{1,2,3}TryOn.jpg` — the `STUDIO_MODEL_SAMPLES`
  models wearing the matching `*Product.png` garments (Gemini Nano
  Banana image-to-image on a model+garment composite).
- Registered as `STUDIO_TRYON_SAMPLES` in `lib/runway-samples.ts`,
  reachable via `sampleById`.

Fashn Try-On exists in Fuser's bundle but is gated on the trial plan —
the renders used the composite-image workaround instead. Provenance +
prompts: `assets/fuser/MANIFEST.md`.
