import { Composition } from "remotion";
import { segmentPropsSchema } from "./components/RouteSegmentVideo";
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
  IndyTracker,
  indyTrackerSchema,
  calculateIndyTrackerMetadata,
} from "./components/IndyTracker";
import {
  PhotoSlideshow,
  photoSlideshowSchema,
  calculatePhotoSlideshowMetadata,
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="01-TseungKwanO-BingAerial"
        schema={segmentPropsSchema}
        component={TseungKwanOBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "tseung-kwan-o-ocean-composite.png",
          tileTransitionStart: 16,
          tileTransitionEnd: 30,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="02-DevilsPeak-BingAerial"
        schema={segmentPropsSchema}
        component={DevilsPeakBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "devils-peak-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="03-SiuMaShan-BingAerial"
        schema={segmentPropsSchema}
        component={SiuMaShanBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "siu-ma-shan-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="04-TaiTam-BingAerial"
        schema={segmentPropsSchema}
        component={TaiTamBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "tai-tam-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="05-StanleyMound-BingAerial"
        schema={segmentPropsSchema}
        component={StanleyMoundBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "stanley-mound-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="06-MountNicholson-BingAerial"
        schema={segmentPropsSchema}
        component={MountNicholsonBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "mount-nicholson-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="07-WanChaiGap-BingAerial"
        schema={segmentPropsSchema}
        component={WanChaiGapBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "wan-chai-gap-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="08-Central-BingAerial"
        schema={segmentPropsSchema}
        component={CentralBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "central-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="09-KowloonMongKok-BingAerial"
        schema={segmentPropsSchema}
        component={KowloonMongKok}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "kowloon-mong-kok-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="10-BeaconHill-BingAerial"
        schema={segmentPropsSchema}
        component={BeaconHillBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "beacon-hill-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="11-SaiKung-BingAerial"
        schema={segmentPropsSchema}
        component={SaiKungBingAerial}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 20,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "sai-kung-ocean-composite.png",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
          gpxFile: "route.gpx",
          startKm: 0.0,
          endKm: 73.0,
          durationSeconds: 20,
          providerStart: "ocean-composite" as const,
          providerStart2: "none" as const,
          providerStart2BlendMode: "normal" as const,
          providerStartTransitionStart: 0,
          providerStartTransitionEnd: 10,
          provider: "ocean-composite" as const,
          provider2: "none" as const,
          provider2BlendMode: "normal" as const,
          providerEnd: "ocean-composite" as const,
          providerEnd2: "none" as const,
          providerEnd2BlendMode: "normal" as const,
          tileTransitionStart: 40,
          tileTransitionEnd: 55,
          fadeInColor: "",
          fadeOutColor: "",
          fadeInOutLength: 1.5,
          zoom: 15,
          zoomReduction: 2,
          cameraStartZoom: 140,
          cameraEndZoom: 382,
          cameraZoomDelay: 90,
          cameraZoomEndDelay: 100,
          cameraAnchorX: 19,
          cameraAnchorY: 34,
          padding: 50,
          offsetX: 0,
          offsetY: 0,
          routeColor: "#cc3232",
          routeWidth: 8,
          dotSize: 30,
          dotPulseSpeed: 50,
          routeGlow: 0,
          routeCasing: 12,
          routeShadow: 0,
          showPreviousRoute: false,
          reverseDrawing: true,
          cameraAnchorMode: "start" as const,
          cameraTracking: "still" as const,
          distanceScale: 110,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="IndyTracker"
        component={IndyTracker}
        schema={indyTrackerSchema}
        calculateMetadata={calculateIndyTrackerMetadata}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          gpxFile: "route.gpx",
          startKm: 0,
          endKm: 10,
          durationSeconds: 20,
          provider: "esri-street" as const,
          provider2: "hillshade" as const,
          provider2BlendMode: "darken" as const,
          providerEnd: "ocean-composite" as const,
          providerEnd2: "none" as const,
          providerEnd2BlendMode: "normal" as const,
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          zoom: 17,
          cameraZoom: 100,
          cameraTracking: "cinematic" as const,
          lookAhead: 0,
          routeColor: "#ff4444",
          routeWidth: 8,
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          routeShadow: 0,
          smoothRoute: 50,
          photos: "DSC09415.jpg,DSC09420.jpg,DSC09421.jpg,DSC09423.jpg",
          photosFolder: "photos-devils-peak",
          photoPositions: "2,2.5,3.5,6",
          photoStyle: "on-route" as const,
          photoSize: 15,
          photoTilt: 5,
          photoReveal: "fade" as const,
          photoRevealSpeed: 100,
          photoSeed: 42,
          photoBlendMode: "multiply" as const,
          photoBackdropOpacity: 100,
          photoMovement: "ken-burns" as const,
          photoTransition: "crossfade" as const,
          distanceScale: 112,
          showDistance: false,
          showElevation: false,
          distanceLabel: "",
          elevationLabel: "",
        }}
      />
      <Composition
        id="PhotoSlideshow"
        component={PhotoSlideshow}
        schema={photoSlideshowSchema}
        calculateMetadata={calculatePhotoSlideshowMetadata}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          photos:
            "0L6A0125.jpg,0L6A0131.jpg,0L6A0132.jpg,0L6A0133.jpg,0L6A0135.jpg,0L6A0145.jpg,0L6A0148.jpg,0L6A0126.jpg",
          photosFolder: "photos-mount-davis",
          style: "mosaic" as const,
          transitionType: "crossfade" as const,
          durationSeconds: 8,
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
        id="MountDavis01"
        component={PhotoSlideshow}
        schema={photoSlideshowSchema}
        calculateMetadata={calculatePhotoSlideshowMetadata}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          photos: "0L6A0125.jpg,0L6A0131.jpg,0L6A0132.jpg,0L6A0133.jpg",
          photosFolder: "photos-mount-davis",
          style: "mosaic" as const,
          transitionType: "crossfade" as const,
          durationSeconds: 8,
          transitionDurationFrames: 9,
          photoDurationSeconds: 2,
          backgroundColor: "#000000",
          borderStyle: "none" as const,
          zoomIntensity: 26,
          zoomDirection: "alternate" as const,
          randomSeed: 88,
        }}
      />
      <Composition
        id="MountDavis02"
        component={PhotoSlideshow}
        schema={photoSlideshowSchema}
        calculateMetadata={calculatePhotoSlideshowMetadata}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          photos: "0L6A0135.jpg,0L6A0145.jpg,0L6A0148.jpg,0L6A0126.jpg",
          photosFolder: "photos-mount-davis",
          style: "mosaic" as const,
          transitionType: "crossfade" as const,
          durationSeconds: 8,
          transitionDurationFrames: 9,
          photoDurationSeconds: 2,
          backgroundColor: "#000000",
          borderStyle: "none" as const,
          zoomIntensity: 26,
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
          dotSize: 100,
          dotPulseSpeed: 100,
          routeGlow: 100,
          routeCasing: 100,
          mapFileEnd: "",
          tileTransitionStart: 0,
          tileTransitionEnd: 0,
          showDistance: true,
          showElevation: true,
          distanceLabel: "",
          elevationLabel: "",
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
