import { Composition } from "remotion";
import { MapRouteVideo } from "./components/MapRouteVideo";
import { StaticRouteVideo } from "./components/StaticRouteVideo";

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
        id="StaticRouteVideo"
        // @ts-expect-error Remotion Composition generics
        component={StaticRouteVideo}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{
          routeColor: "#ff4444",
          routeWidth: 6,
        }}
      />
    </>
  );
};
