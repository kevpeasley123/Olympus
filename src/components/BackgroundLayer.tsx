/** Static environment layers; all live state stays in the foreground interface. */
export function BackgroundLayer() {
  return <>
    <div className="background-image" aria-hidden="true" />
    <div className="background-vignette background-vignette--cinematic" aria-hidden="true" />
  </>;
}
