import { Composition } from "remotion";
import { Promo, TOTAL } from "./Promo";

export const Root = () => (
  <>
    <Composition id="DjieShellPromo" component={Promo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    {/* Versi vertikal 9:16 untuk Reels / TikTok / Shorts */}
    <Composition id="DjieShellPromoVertical" component={Promo} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
  </>
);
