import { HandView } from '../../design/HandView';

/** Large live preview used in the setup wizard (calibration and practice). */
export function CameraPreview() {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-nx-line" data-testid="camera-preview">
      <HandView />
    </div>
  );
}
