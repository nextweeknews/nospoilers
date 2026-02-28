import type { CSSProperties } from "react";

const LOGO_ASSET_PATH = "/graphics/nospoilers.svg";

type BrandLogoProps = {
  accentColor: string;
  width?: number;
  style?: CSSProperties;
};

export const BrandLogo = ({ accentColor, width = 170, style }: BrandLogoProps) => {
  // The source artwork is a wide wordmark, so we preserve its shape with a fixed aspect ratio
  // and tint it using the active theme accent color. Masking lets the same SVG work in both
  // light and dark themes without duplicating color-specific files.
  const logoStyle: CSSProperties = {
    width,
    aspectRatio: "16 / 9",
    backgroundColor: accentColor,
    maskImage: `url(${LOGO_ASSET_PATH})`,
    maskSize: "contain",
    maskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskImage: `url(${LOGO_ASSET_PATH})`,
    WebkitMaskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    ...style
  };

  return <span role="img" aria-label="NoSpoilers" style={logoStyle} />;
};
