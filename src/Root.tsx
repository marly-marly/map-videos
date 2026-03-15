import { Composition } from "remotion";
import { MapRouteVideo } from "./components/MapRouteVideo";
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
        id="KowloonMongKok"
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
        id="DevilsPeak-BingAerial"
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
        id="SiuMaShan-BingAerial"
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
        id="TaiTam-BingAerial"
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
        id="StanleyMound-BingAerial"
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
        id="MountNicholson-BingAerial"
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
        id="WanChaiGap-BingAerial"
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
        id="Central-BingAerial"
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
        id="Kowloon-BingAerial"
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
        id="MongKok-BingAerial"
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
      <Composition
        id="BeaconHill-BingAerial"
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
        id="SaiKung-BingAerial"
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
    </>
  );
};
