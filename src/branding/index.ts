/**
 * BlueCloud brand definition — the single source of truth.
 *
 * Product name and logos are read from here so that no upstream file hardcodes them.
 * Keeping them in one place is what makes a Tactical RMM upgrade a merge of upstream's
 * code rather than an argument about our logo.
 */
import favicon from "@/branding/assets/favicon.ico";
import logo from "@/branding/assets/logo.png";
import logoReverse from "@/branding/assets/logo-reverse.png";
import logoSquare from "@/branding/assets/logo-square.png";

export const BRAND = {
  /** Shown in the toolbar, on the login card and as the browser title. */
  name: "BlueCloud RMM",
  company: "BlueCloud",
  /** White logo. For DARK surfaces — the app toolbar. */
  logoReverse,
  /** Standard logo. For LIGHT surfaces. */
  logo,
  /** 256x256 square. Login card, generated PDFs, script manager. */
  logoSquare,
  favicon,
  /** Palette, mirroring brand.sass. Exported for anything that needs a colour in JS. */
  colors: {
    primary: "#00C4FF",
    secondary: "#007294",
    dark: "#1B1319",
    light: "#F6F5F4",
  },
} as const;

export default BRAND;
