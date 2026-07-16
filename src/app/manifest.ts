import type { MetadataRoute } from "next";

// Basic install manifest so the game can be added to a home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Called It",
    short_name: "Called It",
    description: "Predict the match with your friends and see who called it.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#180a26",
    theme_color: "#180a26",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
