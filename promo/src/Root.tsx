import { Composition } from "remotion";
import { Promo, TOTAL } from "./Promo";
import { Update, UPDATE_TOTAL } from "./Update";

export const Root = () => (
  <>
    <Composition id="DjieShellPromo" component={Promo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    {/* Versi vertikal 9:16 untuk Reels / TikTok / Shorts */}
    <Composition id="DjieShellPromoVertical" component={Promo} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    {/* Pengenalan update v0.4: Server Lokal, Tim, edit file SFTP */}
    <Composition id="DjieShellUpdate04" component={Update} durationInFrames={UPDATE_TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="DjieShellUpdate04Vertical" component={Update} durationInFrames={UPDATE_TOTAL} fps={30} width={1080} height={1920} />
  </>
);
