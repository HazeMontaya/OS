type Props = {
  className?: string;
  title?: string;
};

export default function OsMark({ className = "", title = "OS" }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="os-gold-a" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff0b0" />
          <stop offset="0.48" stopColor="#d7b35a" />
          <stop offset="1" stopColor="#8f6730" />
        </linearGradient>
        <linearGradient id="os-gold-b" x1="47" y1="10" x2="18" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4d887" />
          <stop offset="1" stopColor="#aa7934" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 50.7 11.3 60 29.4 55.1 49 38 60H26L8.9 49 4 29.4l9.3-18.1L32 4Z"
        fill="none"
        stroke="url(#os-gold-a)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M32 11.5c11.3 0 20.5 9.2 20.5 20.5S43.3 52.5 32 52.5 11.5 43.3 11.5 32 20.7 11.5 32 11.5Z"
        fill="none"
        stroke="url(#os-gold-b)"
        strokeWidth="2.4"
        strokeDasharray="30 7 8 7"
        strokeLinecap="round"
      />
      <path d="m32 17 8 15-8 15-8-15 8-15Z" fill="url(#os-gold-a)" fillOpacity="0.14" stroke="url(#os-gold-a)" strokeWidth="1.4" />
      <path d="M20 32h8m8 0h8M32 20v8m0 8v8" stroke="#f4d887" strokeWidth="1.25" strokeLinecap="round" opacity="0.84" />
      <circle cx="32" cy="32" r="3.7" fill="#050403" stroke="#fff0b0" strokeWidth="1.4" />
      <circle cx="32" cy="32" r="1.15" fill="#fff0b0" />
    </svg>
  );
}
