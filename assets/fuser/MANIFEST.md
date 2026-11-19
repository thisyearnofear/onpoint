# Fuser-generated assets

Virtual try-on renders + model/garment reference bank via Fuser studio canvas (Gemini Nano Banana 2 Lite i2i composites + fal MiniMax H3 text-to-image). Try-on inputs were side-by-side composites of a model photo + flat garment shot from `apps/web/public/assets/`, prompted for garment transfer preserving identity, pose, and styling. Checked in as static assets — no runtime Fuser dependency.

## Try-on renders (from earlier session)

| File | Model input | Garment input | Notes |
|---|---|---|---|
| tryon-model1-tee1.jpg | 1Model.png | 1Product.png | Full-body studio shot, graphic reproduced. |
| tryon-model2-tee2.jpg | 2Model.png | 2Product.png | "Animal Collective" tee; print + text reproduced accurately. |
| tryon-model3-tee3.jpg | 3Model.png | 3Product.png | Full-body studio shot. |

## Model bank — full-body, head-to-toe, front-facing, evenly lit

| File | Notes |
|---|---|
| model-female-1.jpg | Woman, gray tee + shorts, studio. |
| model-female-2.jpg | Woman, white graphic tee + denim shorts, studio. |
| model-female-3.png | Woman, dark top, head-and-shoulders portrait. |
| model-female-4.png | Woman, black tank + jeans, full body, studio. |
| model-male-1.png | Man, white tee + gray trousers, full body, studio. |

## Garment bank — unfolded flat-lay, wrinkle-free, logo visible

| File | Notes |
|---|---|
| garment-hoodie-navy-flatlay.png | Navy hoodie, top-down flat lay on white. |
| model-garment-blacktee.jpg | Black tee flat-lay + worn reference (composite frame). |
| model-garment-whitetee.jpg | White graphic tee flat-lay + worn reference (composite frame). |

To run additional try-ons: composite model+garment side-by-side and feed to the Gemini/nano-banana i2i node, or wire two image nodes into the image socket in Fuser.

## Integration

Copies live at `apps/web/public/assets/{1,2,3}TryOn.jpg` and are registered as `STUDIO_TRYON_SAMPLES` in `apps/web/lib/runway-samples.ts` (also reachable via `sampleById`). Same people and garments as `STUDIO_MODEL_SAMPLES` — the try-on results of that catalog's own inputs.
