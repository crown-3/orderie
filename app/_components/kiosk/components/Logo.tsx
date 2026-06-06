interface Props {
  className?: string;
}

/** "mowiki" wordmark — Pacifico script in brand blue. */
const Logo = ({ className = "" }: Props) => (
  <span
    className={`font-logo text-brand leading-none select-none ${className}`}
  >
    mowiki
  </span>
);

export default Logo;
