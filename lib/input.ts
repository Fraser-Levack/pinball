// Two-input control scheme: the left and right triggers (standard mapping buttons 6/7).
// Each trigger drives its flipper, both together pull the plunger, and either one starts a game.
// The keyboard offers one stand-in key per trigger for testing without a controller.

export interface InputSnapshot {
  left: boolean;
  right: boolean;
  plunger: boolean;
  start: boolean; // edge-triggered: a trigger was just pressed
  gamepad: string | null;
}

const TRIGGER_THRESHOLD = 0.25;

const LEFT_KEY = "KeyZ";
const RIGHT_KEY = "KeyM";

type Rumble = {
  playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>;
};

export class Input {
  private keys = new Set<string>();
  private prevLeft = false;
  private prevRight = false;

  private onDown = (e: KeyboardEvent) => {
    if (e.code === LEFT_KEY || e.code === RIGHT_KEY) e.preventDefault();
    this.keys.add(e.code);
  };
  private onUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onBlur = () => this.keys.clear();

  attach() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }

  private pad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  poll(): InputSnapshot {
    let left = this.keys.has(LEFT_KEY);
    let right = this.keys.has(RIGHT_KEY);

    const pad = this.pad();
    if (pad) {
      const trigger = (i: number) => (pad.buttons[i]?.value ?? 0) > TRIGGER_THRESHOLD;
      left ||= trigger(6); // LT
      right ||= trigger(7); // RT
    }

    const start = (left && !this.prevLeft) || (right && !this.prevRight);
    this.prevLeft = left;
    this.prevRight = right;
    return { left, right, plunger: left && right, start, gamepad: pad ? pad.id : null };
  }

  rumble(strong: number, weak: number, duration: number) {
    const pad = this.pad() as (Gamepad & { vibrationActuator?: Rumble }) | null;
    pad?.vibrationActuator?.playEffect?.("dual-rumble", {
      startDelay: 0,
      duration,
      strongMagnitude: strong,
      weakMagnitude: weak,
    })?.catch(() => {});
  }
}
