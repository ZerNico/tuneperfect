import { fallbackGradient } from "./ui/avatar";

/** A club's initial on a colour picked from its name: rounded square, so clubs read differently from people. */
export default function ClubBadge(props: { name: string; class?: string }) {
  return (
    <span
      class={`flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-linear-to-b text-lg font-black uppercase ${fallbackGradient(props.name)} ${props.class ?? ""}`}
      aria-hidden="true"
    >
      {props.name.at(0)}
    </span>
  );
}
