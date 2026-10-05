import Screen from "./screen";
import TttScreen from "./ttt-screen";
import VersusScreen from "./versus-screen";

/** Both party modes at once: Versus at the back, Tic Tac Toe overlapping it at the front, both running. */
export default function PartyScreen() {
  return (
    <div class="relative pb-[28%]">
      <div class="w-[74%]">
        <Screen>
          <VersusScreen />
        </Screen>
      </div>
      <div class="absolute right-0 bottom-0 w-[58%]">
        <Screen class="ring-white/20">
          <TttScreen />
        </Screen>
      </div>
    </div>
  );
}
