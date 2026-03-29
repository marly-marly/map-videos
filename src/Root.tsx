import { Composition } from "remotion";
import { MapRouteVideo } from "./components/MapRouteVideo";
import { TseungKwanO } from "./components/TseungKwanO";
import { TseungKwanOBingAerial } from "./components/TseungKwanOBingAerial";
import { DevilsPeak } from "./components/StaticRouteVideo";
import { SiuMaShan } from "./components/SiuMaShan";
import { TaiTam } from "./components/TaiTam";
import { StanleyMound } from "./components/StanleyMound";
import { MountNicholson } from "./components/MountNicholson";
import { WanChaiGap } from "./components/WanChaiGap";
import { Central } from "./components/Central";
import { Kowloon } from "./components/Kowloon";
import { MongKok } from "./components/MongKok";
import { BeaconHill } from "./components/BeaconHill";
import { SaiKung } from "./components/SaiKung";
import { KowloonMongKok } from "./components/KowloonMongKok";
import { DevilsPeakBingAerial } from "./components/DevilsPeakBingAerial";
import { SiuMaShanBingAerial } from "./components/SiuMaShanBingAerial";
import { TaiTamBingAerial } from "./components/TaiTamBingAerial";
import { StanleyMoundBingAerial } from "./components/StanleyMoundBingAerial";
import { MountNicholsonBingAerial } from "./components/MountNicholsonBingAerial";
import { WanChaiGapBingAerial } from "./components/WanChaiGapBingAerial";
import { CentralBingAerial } from "./components/CentralBingAerial";
import { KowloonBingAerial } from "./components/KowloonBingAerial";
import { MongKokBingAerial } from "./components/MongKokBingAerial";
import { BeaconHillBingAerial } from "./components/BeaconHillBingAerial";
import { SaiKungBingAerial } from "./components/SaiKungBingAerial";
import { PhotosDevilsPeak } from "./components/PhotosDevilsPeak";
import { PhotosDevilsPeak02 } from "./components/PhotosDevilsPeak02";
import { FullRouteOverview } from "./components/FullRouteOverview";
import { FullRouteOverviewBW } from "./components/FullRouteOverviewBW";
import { FullRouteOverviewPeaks } from "./components/FullRouteOverviewPeaks";
import { GPXSegment, gpxSegmentSchema } from "./components/GPXSegment";
import {
  PhotoSlideshow,
  photoSlideshowSchema,
} from "./components/PhotoSlideshow";

const FPS = 30;
const DURATION_SECONDS = 60;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MapRouteVideo"
        // @ts-expect-error Remotion Composition generics
        component={MapRouteVideo}
        durationInFrames={FPS * DURATION_SECONDS}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 8,
        }}
      />
      <Composition
        id="TseungKwanO"
        // @ts-expect-error Remotion Composition generics
        component={TseungKwanO}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="DevilsPeak"
        // @ts-expect-error Remotion Composition generics
        component={DevilsPeak}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="SiuMaShan"
        // @ts-expect-error Remotion Composition generics
        component={SiuMaShan}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="TaiTam"
        // @ts-expect-error Remotion Composition generics
        component={TaiTam}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="StanleyMound"
        // @ts-expect-error Remotion Composition generics
        component={StanleyMound}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="MountNicholson"
        // @ts-expect-error Remotion Composition generics
        component={MountNicholson}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="WanChaiGap"
        // @ts-expect-error Remotion Composition generics
        component={WanChaiGap}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="Central"
        // @ts-expect-error Remotion Composition generics
        component={Central}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="Kowloon"
        // @ts-expect-error Remotion Composition generics
        component={Kowloon}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="MongKok"
        // @ts-expect-error Remotion Composition generics
        component={MongKok}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="BeaconHill"
        // @ts-expect-error Remotion Composition generics
        component={BeaconHill}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="SaiKung"
        // @ts-expect-error Remotion Composition generics
        component={SaiKung}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="01-TseungKwanO-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={TseungKwanOBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="02-DevilsPeak-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={DevilsPeakBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="03-SiuMaShan-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={SiuMaShanBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="04-TaiTam-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={TaiTamBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="05-StanleyMound-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={StanleyMoundBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="06-MountNicholson-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={MountNicholsonBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="07-WanChaiGap-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={WanChaiGapBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="08-Central-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={CentralBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="09-KowloonMongKok-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={KowloonMongKok}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="10-BeaconHill-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={BeaconHillBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="11-SaiKung-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={SaiKungBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="FullRouteOverview"
        // @ts-expect-error Remotion Composition generics
        component={FullRouteOverview}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="FullRouteOverview-BW"
        // @ts-expect-error Remotion Composition generics
        component={FullRouteOverviewBW}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="FullRouteOverview-Peaks"
        // @ts-expect-error Remotion Composition generics
        component={FullRouteOverviewPeaks}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="FullRouteOverview-NoHUD"
        // @ts-expect-error Remotion Composition generics
        component={FullRouteOverview}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          showHud: false,
        }}
      />
      <Composition
        id="FullRouteOverview-BW-NoHUD"
        // @ts-expect-error Remotion Composition generics
        component={FullRouteOverviewBW}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          showHud: false,
        }}
      />
      <Composition
        id="GPXSegment"
        component={GPXSegment}
        schema={gpxSegmentSchema}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          gpxFile: "MountDavisRoute.gpx",
          startKm: 0,
          endKm: 9999,
          durationSeconds: 20,
          provider: "ocean-composite" as const,
          providerEnd: "bing" as const,
          tileTransitionStart: 31,
          tileTransitionEnd: 50,
          zoom: 18,
          zoomReduction: 2,
          cameraStartZoom: 2,
          cameraEndZoom: 15,
          cameraZoomDelay: 15,
          cameraZoomEndDelay: 10,
          cameraAnchorX: 19,
          cameraAnchorY: 34,
          padding: 0.35,
          offsetX: 28,
          offsetY: 15,
          routeColor: "#ff4444",
          routeWidth: 2,
          dotSize: 17,
          dotPulseSpeed: 50,
          routeGlow: 124,
          routeCasing: 65,
          showPreviousRoute: false,
          showHud: false,
        }}
      />
      <Composition
        id="PhotoSlideshow"
        component={PhotoSlideshow}
        schema={photoSlideshowSchema}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          photos:
            "DSC09415.jpg,DSC09420.jpg,DSC09421.jpg,DSC09423.jpg,DSC09430.jpg,DSC09431.jpg,DSC09440.jpg,DSC09441.jpg",
          photosFolder: "photos-devils-peak",
          style: "ken-burns" as const,
          transitionType: "crossfade" as const,
          transitionDurationFrames: 9,
          photoDurationSeconds: 2,
          backgroundColor: "#000000",
          borderStyle: "none" as const,
          zoomIntensity: 15,
          zoomDirection: "alternate" as const,
          randomSeed: 42,
        }}
      />
      <Composition
        id="Photos-DevilsPeak"
        // @ts-expect-error Remotion Composition generics
        component={PhotosDevilsPeak}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="Photos-DevilsPeak-02"
        // @ts-expect-error Remotion Composition generics
        component={PhotosDevilsPeak02}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={3840}
        height={2160}
      />
      <Composition
        id="Backup-Kowloon-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={KowloonBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
      <Composition
        id="Backup-MongKok-BingAerial"
        // @ts-expect-error Remotion Composition generics
        component={MongKokBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
        }}
      />
    </>
  );
};
