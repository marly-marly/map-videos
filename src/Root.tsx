import { Composition } from "remotion";
import { MapRouteVideo } from "./components/MapRouteVideo";
import { DevilsPeak } from "./components/StaticRouteVideo";
import { SiuMaShan } from "./components/SiuMaShan";

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
        durationInFrames={FPS * 45}
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
