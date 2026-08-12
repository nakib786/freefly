/**
 * "The car is decoded and has been drawn at least once."
 *
 * The boot screen needs this because the expensive part of the 3D layer is not
 * the download. Once the GLB bytes are in, three.js still has to run the Draco
 * decoder over ~367k triangles, build the wheel rig, upload the textures and
 * compile shaders — a second or so of main-thread work on a mid-range phone. A
 * loader that reported "100%" when the last byte arrived would hand over to a
 * page that then froze and popped the car in, which is exactly the stutter the
 * loader exists to prevent. So the gate waits for a real frame.
 *
 * A module-level signal rather than context, matching driveState.ts: this is
 * written from inside useFrame, and it must not re-render the scene tree.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

let ready = false;

export const sceneReady = {
  get value() {
    return ready;
  },

  /** Called from the render loop on the first frame drawn with the car present. */
  mark() {
    if (ready) return;
    ready = true;
    for (const listener of [...listeners]) listener();
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
